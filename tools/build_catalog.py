#!/usr/bin/env python3
"""Build the HEAP website's tier-M objects: catalog, headline numbers, search index.

Tier M (WEBSITE_PLAN.md section 10) is the small stuff every page needs and no page
should compute: the manuscript's own numbers, the list of shipped datasets, and the
entities the global search box completes. Three objects, all < 100 KB gz:

    <out>/meta/headline.json.gz      manuscript macros, parsed (plan section 3)
    <out>/catalog.json.gz            the /data catalog (plan sections 6.11 + 7)
    <out>/meta/search_index.json.gz  proteins + exposures + diseases (plan section 7)

Every number comes from a file on disk; nothing here is hand-typed. The headline
numbers are parsed out of `HEAP_manuscript/macros/*.tex`, which is the manuscript's
single source of truth for prose statistics, so the site cannot drift from the paper.
The catalog is generated from `HEAP_manuscript/config/supp_tables.tsv`, so the site
and the supplement cannot disagree about what data exists.

Ledger goes to `build/web/manifest_catalog.tsv`, NOT the `manifest.tsv` that
build_payload.py owns -- the two builders run independently and must not clobber
each other. sync_gcs.py can be pointed at either with --ledger.

Runs on O2, where the source data lives. It cannot run in CI.
"""
import argparse
import csv
import datetime
import glob
import gzip
import hashlib
import io
import json
import math
import os
import re
import sys
from collections import OrderedDict, defaultdict

DEFAULT_MACROS = "/n/groups/patel/shakson_ukb/HEAP_manuscript/macros"
DEFAULT_TABLES = "/n/groups/patel/shakson_ukb/HEAP_manuscript/config/supp_tables.tsv"
DEFAULT_STATS = "/n/groups/patel/shakson_ukb/HEAP/docs/manuscript_stats"
DEFAULT_SOURCE = "/n/groups/patel/IGLOO/UKB/HEAP/figures/website"

# Any API object must stay under 100 KB gz (plan section 11); the search index is
# fetched on every page, so it gets a tighter self-imposed budget.
SEARCH_BUDGET = 200 * 1024

# delivery -> the supplement's three-tier model (build_supp_tables.R header).
TIERS = {
    "workbook": (1, "Supplementary Table"),
    "data": (2, "Supplementary Data"),
    "deposit": (3, "Repository deposit"),
}


def clean(v):
    """JSON-legal scalar. NaN/Inf are valid Python json but *invalid* JSON --
    a browser's JSON.parse() rejects them, so they must become null."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def dumps(obj):
    # allow_nan=False makes a stray NaN a loud error instead of invalid JSON
    return json.dumps(obj, separators=(",", ":"), allow_nan=False).encode("utf-8")


def gzip_bytes(raw):
    """Deterministic gzip: mtime=0 so identical data hashes identically across
    runs. Without this every rebuild would look changed and re-upload the world."""
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as f:
        f.write(raw)
    return buf.getvalue()


class Writer:
    def __init__(self, out, gz=True):
        self.out, self.gz = out, gz
        self.entries = []

    def write(self, relpath, obj):
        raw = dumps(obj)
        if self.gz:
            relpath += ".gz"
            body = gzip_bytes(raw)
        else:
            body = raw
        path = os.path.join(self.out, relpath)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        self.entries.append(
            {
                "path": relpath,
                "sha256": hashlib.sha256(body).hexdigest(),
                "bytes": len(body),
                "raw_bytes": len(raw),
            }
        )
        return len(body)


# --------------------------------------------------------------------------
# 1. headline numbers  <-  HEAP_manuscript/macros/*.tex
# --------------------------------------------------------------------------
# A macro VALUE can contain braces -- LaTeX digit grouping writes 2,686 as
# `2{,}686` -- so the value is read by walking balanced braces, not by a regex.
# `\{(.*?)\}` would return "2{," and silently ship a wrong number.
def _braced(s, i):
    """s[i] must be '{'. Return (content, index just past the matching '}')."""
    depth, j, out = 0, i, []
    while j < len(s):
        c = s[j]
        if c == "\\" and j + 1 < len(s):
            out.append(s[j:j + 2])
            j += 2
            continue
        if c == "{":
            depth += 1
            if depth == 1:
                j += 1
                continue
        elif c == "}":
            depth -= 1
            if depth == 0:
                return "".join(out), j + 1
        out.append(c)
        j += 1
    raise ValueError("unbalanced brace at offset %d" % i)


# LaTeX in a *value* is display markup, not data. Only forms actually present in
# macros/*.tex are translated; anything left holding a backslash is reported.
_TEX = [
    ("{,}", ","),          # digit grouping: 2{,}686
    ("\\,", ","),          # thin-space grouping, same intent
    ("\\char`~", "~"),     # \char`~95\%  ->  ~95%
    ("\\char`\\~", "~"),
    ("\\%", "%"),
    ("\\ensuremath", ""),
    ("\\approx", "~"),
    ("\\sim", "~"),
    ("\\pm", "+/-"),
    ("\\times", "x"),
    ("\\geq", ">="), ("\\ge", ">="),
    ("\\leq", "<="), ("\\le", "<="),
    ("~", "~"),
]

# "2,686" / "-0.78" / "~95%" / "0.2%" -- a bare quantity, optionally approximate,
# optionally a percentage. Anything else (e.g. "six") stays raw-only.
_NUM = re.compile(
    r"^(?P<approx>~)?\s*(?P<sign>[-+])?"
    r"(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
    r"\s*(?P<pct>%)?$"
)


def detex(v):
    for a, b in _TEX:
        v = v.replace(a, b)
    return v.strip()


def parse_value(raw):
    """raw is already de-TeXed. Returns the extra fields a number earns."""
    m = _NUM.match(raw)
    if not m:
        return {}
    txt = m.group("num").replace(",", "")
    f = float(txt)
    if m.group("sign") == "-":
        f = -f
    out = {"value": int(f) if f.is_integer() and abs(f) < 2 ** 53 else f}
    if m.group("pct"):
        out["unit"] = "percent"      # value is 66, display is "66%"
    if m.group("approx"):
        out["approx"] = True
    return out


_SECTION = re.compile(r"^%\s*-{2,}\s*(.*?)\s*-{2,}\s*$")


def parse_macros(paths):
    """Parse \\newcommand definitions into {name: {raw, value?, note?, ...}}.

    Several macros can share one line; the trailing comment describes the line, so
    it is attached to each macro defined on it (e.g. medGenRtwo/maxGenRtwo share
    "genetic unique R2 (median; max)"). Comment lines that precede a definition are
    kept separately as `context` -- that is where the real caveats live (the FURIN
    motif rule, the Steiger re-tiering), and they must not be lost."""
    macros, dupes, residue = OrderedDict(), [], []
    for path in paths:
        section, pending = "", []
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.rstrip("\n")
                stripped = line.strip()
                if stripped.startswith("%"):
                    m = _SECTION.match(stripped)
                    if m:
                        section, pending = detex(m.group(1)), []
                    else:
                        body = detex(stripped.lstrip("%").strip())
                        if body:
                            pending.append(body)
                    continue
                if "\\newcommand" not in line:
                    if not stripped:
                        pending = []          # blank line ends a comment block
                    continue

                found, i = [], 0
                while True:
                    k = line.find("\\newcommand", i)
                    if k < 0:
                        break
                    j = line.find("{", k)
                    if j < 0:
                        break
                    name, j = _braced(line, j)
                    if j >= len(line) or line[j] != "{":
                        i = j                 # \newcommand{\x}[1]{...}: not a number
                        continue
                    value, j = _braced(line, j)
                    found.append((name.lstrip("\\").strip(), value))
                    i = j
                if not found:
                    continue

                tail = line[i:]
                c = tail.find("%")
                note = detex(tail[c + 1:].strip()) if c >= 0 else ""
                for name, value in found:
                    raw = detex(value)
                    if "\\" in raw:
                        residue.append((name, raw))
                    e = OrderedDict(raw=raw)
                    e.update(parse_value(raw))
                    if note:
                        e["note"] = note
                    if section:
                        e["section"] = section
                    if pending:
                        e["context"] = " ".join(pending)
                    e["file"] = os.path.basename(path)
                    if name in macros:
                        dupes.append(name)
                    macros[name] = e
                pending = []
    return macros, dupes, residue


# --------------------------------------------------------------------------
# 2. catalog  <-  HEAP_manuscript/config/supp_tables.tsv
# --------------------------------------------------------------------------
def read_tsv_dicts(path):
    """Header-driven; column ORDER in supp_tables.tsv is not a contract."""
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def resolve(src, stats_root):
    """Source resolution, mirroring build_supp_tables.R:129 exactly:
       absolute paths are used as-is, everything else hangs off STATS_ROOT."""
    src = (src or "").strip()
    if not src:
        return None
    return src if src.startswith("/") else os.path.join(stats_root, src)


def delim_for(path):
    return "," if path.lower().endswith(".csv") else "\t"


def read_header(path):
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.reader(f, delimiter=delim_for(path)):
            return [c.strip() for c in row]
    return []


def count_rows(path):
    """Data rows = newlines - header. Counted on bytes so a 1 GB table costs a
    scan and no memory. A quoted field containing a newline would over-count;
    none of these R-written tables embed one."""
    n, last = 0, b""
    with open(path, "rb") as f:
        while True:
            b = f.read(1 << 22)
            if not b:
                break
            n += b.count(b"\n")
            last = b[-1:]
    if last and last != b"\n":
        n += 1                                  # no trailing newline
    return max(n - 1, 0)


def iso_day(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%d")


def describe_file(path, want_rows):
    cols = read_header(path)
    d = OrderedDict(
        kind="file",
        size_bytes=os.path.getsize(path),
        n_rows=count_rows(path) if want_rows else None,
        n_cols=len(cols),
        columns=cols,
        updated=iso_day(os.path.getmtime(path)),
    )
    return d


def describe_dir(path):
    """A directory source (per-exposure PES weights, per-specification association
    folders) has no single file to read. Same fallback build_supp_tables.R uses for
    its preview -- describe the folder and take the column list off one file inside
    it -- but walked recursively: pes_weights is 160 per-exposure SUBfolders, so a
    top-level-only scan reports 2 files and 0.2 MB for a 9 MB, 480-file resource.

    The representative file is the LARGEST tabular one, not the first: the sidecars
    (`*_metadata.txt`, key/value, no header) sort ahead of the real table but are a
    thousandth its size."""
    files, dirs, size, mtime, cand = 0, 0, 0, 0, []
    for root, subdirs, names in os.walk(path):
        subdirs.sort()
        dirs += len(subdirs)
        for name in sorted(names):
            fp = os.path.join(root, name)
            try:
                st = os.stat(fp)
            except OSError:                     # dangling symlink
                continue
            files += 1
            size += st.st_size
            mtime = max(mtime, st.st_mtime)
            if name.endswith((".tsv", ".csv", ".txt")) and name != "manifest.tsv" \
                    and not name.upper().startswith("README"):
                cand.append((st.st_size, os.path.relpath(fp, path)))
    d = OrderedDict(
        kind="directory",
        size_bytes=size,
        n_files=files,
        n_rows=None,
        updated=iso_day(mtime or os.path.getmtime(path)),
    )
    if dirs:
        d["n_subdirs"] = dirs
    if cand:
        rel = max(cand)[1]
        cols = read_header(os.path.join(path, rel))
        d["example_file"] = rel
        d["n_cols"] = len(cols)
        d["columns"] = cols
    return d


def build_catalog(tables_path, stats_root, want_rows):
    rows = read_tsv_dicts(tables_path)
    need = {"key", "source", "sheet", "title", "delivery", "status", "group"}
    have = set(rows[0].keys()) if rows else set()
    if not need <= have:
        sys.exit("!! %s is missing column(s): %s" % (tables_path, sorted(need - have)))

    datasets, missing, statuses = [], [], defaultdict(int)
    for r in rows:
        statuses[(r.get("status") or "").strip()] += 1
        if (r.get("status") or "").strip() != "active":
            continue
        delivery = (r.get("delivery") or "").strip()
        tier, tier_label = TIERS.get(delivery, (None, delivery))
        sheet = (r.get("sheet") or "").strip()
        path = resolve(r.get("source"), stats_root)

        d = OrderedDict(
            key=(r.get("key") or "").strip(),
            title=(r.get("title") or "").strip(),
            sheet=sheet if sheet and sheet != "-" else None,   # "-" = no workbook sheet
            delivery=delivery,
            tier=tier,
            tier_label=tier_label,
            group=(r.get("group") or "").strip(),
            source=(r.get("source") or "").strip(),
            path=path,
        )
        for extra in ("zip_path", "split_col", "zip_name"):
            v = (r.get(extra) or "").strip()
            if v:
                d[extra] = v

        # A source string need not be a path at all -- the GWAS deposit row reads
        # "gwas_regenie/ per-exposure <exposure>.regenie". Never crash, never drop.
        if path and os.path.isdir(path):
            d["available"] = True
            d.update(describe_dir(path))
        elif path and os.path.isfile(path):
            d["available"] = True
            d.update(describe_file(path, want_rows))
        else:
            d["available"] = False
            missing.append((d["key"], path or d["source"]))
        datasets.append(d)

    groups = OrderedDict()
    for d in datasets:
        g = groups.setdefault(d["group"], {"group": d["group"], "n": 0, "keys": []})
        g["n"] += 1
        g["keys"].append(d["key"])

    catalog = OrderedDict(
        version="v1",
        config=os.path.abspath(tables_path),
        stats_root=stats_root,
        n_datasets=len(datasets),
        n_available=sum(1 for d in datasets if d["available"]),
        n_missing=len(missing),
        groups=list(groups.values()),
        datasets=datasets,
    )
    return catalog, missing, statuses


# --------------------------------------------------------------------------
# 3. search index  <-  figures/website/*.json
# --------------------------------------------------------------------------
def iter_records(path, chunk=1 << 22):
    """Stream a JSON array of objects one record at a time.

    fig_expo_protein_assoc.json is 116 MB of pretty-printed JSON (~454k records).
    json.load() would fit in memory here, but raw_decode over a sliding buffer is
    the same speed (~1 s), bounded in memory, and indifferent to whether R wrote
    the file pretty-printed or compact."""
    dec = json.JSONDecoder()
    buf, pos, started = "", 0, False
    with open(path, encoding="utf-8") as f:
        while True:
            more = f.read(chunk)
            if more:
                buf, pos = buf[pos:] + more, 0
            while True:
                while pos < len(buf) and buf[pos] in " \t\r\n,":
                    pos += 1
                if not started and pos < len(buf) and buf[pos] == "[":
                    started, pos = True, pos + 1
                    continue
                if pos >= len(buf) or buf[pos] == "]":
                    break
                try:
                    obj, pos = dec.raw_decode(buf, pos)
                except ValueError:
                    break                       # truncated record: read more
                yield obj
            if not more:
                return


def build_search_index(source, disease_sources, warn):
    assoc = os.path.join(source, "fig_expo_protein_assoc.json")
    diag = os.path.join(source, "fig_instrument_diagnostics.json")
    gems = [s if s.startswith("/") else os.path.join(source, s) for s in disease_sources]

    proteins, expo_cat, expo_broad = set(), OrderedDict(), {}
    if os.path.exists(assoc):
        for r in iter_records(assoc):
            p = r.get("protein")
            if p:
                proteins.add(p)
            e = r.get("exposure_id")
            if e and e not in expo_cat:
                expo_cat[e] = clean(r.get("Category"))
                expo_broad[e] = clean(r.get("broad"))
    else:
        warn("search: missing %s -- no proteins, no exposure ids" % assoc)

    labels = {}
    if os.path.exists(diag):
        for r in json.load(open(diag, encoding="utf-8")):
            e = r.get("exposure")
            if e:
                labels[e] = (clean(r.get("label")), clean(r.get("category")))
    else:
        warn("search: missing %s -- exposures will have no human labels" % diag)

    exposures = []
    unlabeled, recat = [], []
    for e in sorted(set(expo_cat) | set(labels)):
        label, dcat = labels.get(e, (None, None))
        cat = expo_cat.get(e) or dcat
        if label is None:
            unlabeled.append(e)
        if dcat and expo_cat.get(e) and dcat != expo_cat[e]:
            recat.append((e, expo_cat[e], dcat))
        row = OrderedDict(id=e, label=label, category=cat)
        if expo_broad.get(e):
            row["broad"] = expo_broad[e]
        exposures.append(row)
    if unlabeled:
        warn("search: %d exposure(s) have no label in fig_instrument_diagnostics.json "
             "(label=null): %s" % (len(unlabeled), ", ".join(unlabeled[:3])))
    if recat:
        warn("search: %d exposure(s) categorized differently by the two sources; "
             "kept the association file's: %s" % (len(recat), recat[:2]))

    # Diseases come from a figure export, and no single export carries all of the
    # \nDiseasesGEM outcomes -- fig_gem_landscape.json holds the GEM quadrant subset.
    # --disease-source is repeatable so the union can be widened without a code edit;
    # the count is cross-checked against the macro below either way.
    seen = {}
    for gem in gems:
        if not os.path.exists(gem):
            warn("search: missing %s -- no diseases from it" % gem)
            continue
        for r in iter_records(gem):
            i, lab = r.get("DZ_ID"), r.get("disease")
            if i and i not in seen:
                seen[i] = lab
    diseases = [OrderedDict(id=i, label=seen[i]) for i in sorted(seen)]

    idx = OrderedDict(
        version="v1",
        counts=OrderedDict(proteins=len(proteins), exposures=len(exposures),
                           diseases=len(diseases)),
        sources=OrderedDict(
            proteins=os.path.basename(assoc),
            exposures=[os.path.basename(assoc), os.path.basename(diag)],
            diseases=[os.path.basename(g) for g in gems],
        ),
        proteins=sorted(proteins),
        exposures=exposures,
        diseases=diseases,
    )
    return idx


# --------------------------------------------------------------------------
def write_ledger(path, entries):
    """Same four columns build_payload.py's manifest.tsv uses, separate file so the
    two builders never clobber each other. Existing rows are kept (a --only run
    rebuilds one object), except those this run replaced."""
    old = {}
    if os.path.exists(path):
        with open(path) as f:
            next(f, None)
            for line in f:
                p = line.rstrip("\n").split("\t")
                if len(p) == 4:
                    old[p[0]] = {"path": p[0], "sha256": p[1],
                                 "bytes": int(p[2]), "raw_bytes": int(p[3])}
    fresh = {e["path"].removesuffix(".gz") for e in entries}
    merged = {p: e for p, e in old.items() if p.removesuffix(".gz") not in fresh}
    for e in entries:
        merged[e["path"]] = e
    with open(path, "w") as f:
        f.write("path\tsha256\tbytes\traw_bytes\n")
        for e in sorted(merged.values(), key=lambda x: x["path"]):
            f.write(f"{e['path']}\t{e['sha256']}\t{e['bytes']}\t{e['raw_bytes']}\n")
    return len(merged)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--macros", default=DEFAULT_MACROS,
                    help="dir of manuscript macro .tex files (or one file)")
    ap.add_argument("--tables", default=DEFAULT_TABLES, help="supp_tables.tsv")
    ap.add_argument("--stats", default=os.environ.get("HEAP_STATS_DIR", DEFAULT_STATS),
                    help="STATS_ROOT for relative sources in supp_tables.tsv")
    ap.add_argument("--source", default=os.environ.get("HEAP_WEBSITE_DIR", DEFAULT_SOURCE),
                    help="figures/website dir the search index reads")
    ap.add_argument("--disease-source", action="append", default=None,
                    help="figure export the disease list is read from, relative to "
                         "--source (repeatable; default fig_gem_landscape.json)")
    ap.add_argument("--out", default=None, help="default: <repo>/build/web/v1")
    ap.add_argument("--only", action="append",
                    choices=["headline", "catalog", "search"],
                    help="build one object (repeatable)")
    ap.add_argument("--no-rows", action="store_true",
                    help="skip catalog row counts (they scan ~0.7 GB of TSV)")
    ap.add_argument("--no-gzip", action="store_true")
    args = ap.parse_args()

    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = args.out or os.path.join(repo, "build", "web", "v1")
    os.makedirs(out, exist_ok=True)
    want = set(args.only or ["headline", "catalog", "search"])

    w = Writer(out, gz=not args.no_gzip)
    warnings = []

    def warn(msg):
        warnings.append(msg)
        print("  !! " + msg, file=sys.stderr)

    macros = {}
    if "headline" in want:
        if os.path.isdir(args.macros):
            paths = sorted(glob.glob(os.path.join(args.macros, "*.tex")))
        else:
            paths = [args.macros]
        if not paths:
            warn("headline: no .tex under %s" % args.macros)
        macros, dupes, residue = parse_macros(paths)
        for d in sorted(set(dupes)):
            warn("headline: macro \\%s defined twice; kept the last" % d)
        for name, raw in residue:
            warn("headline: \\%s value still holds LaTeX: %r" % (name, raw))
        obj = OrderedDict(
            version="v1",
            n_macros=len(macros),
            sources=[os.path.abspath(p) for p in paths],
            macros=macros,
        )
        n = w.write("meta/headline.json", obj)
        numeric = sum(1 for m in macros.values() if "value" in m)
        print(f"  [M] headline           {len(macros):5d} macros "
              f"({numeric} numeric, {len(macros)-numeric} text) -> {n/1024:7.1f} KB")

    if "catalog" in want:
        cat, missing, statuses = build_catalog(args.tables, args.stats, not args.no_rows)
        n = w.write("catalog.json", cat)
        src_bytes = sum(d.get("size_bytes") or 0 for d in cat["datasets"])
        print(f"  [M] catalog            {cat['n_datasets']:5d} active datasets "
              f"({cat['n_missing']} missing, {src_bytes/1073741824:.1f} GB on disk) "
              f"-> {n/1024:7.1f} KB")
        print("      status in config: "
              + ", ".join(f"{k}={v}" for k, v in sorted(statuses.items())))
        for key, path in missing:
            warn("catalog: source does not exist for %s -> %s" % (key, path))

    if "search" in want:
        idx = build_search_index(args.source,
                                 args.disease_source or ["fig_gem_landscape.json"],
                                 warn)
        n = w.write("meta/search_index.json", idx)
        c = idx["counts"]
        print(f"  [M] search_index       {c['proteins']} proteins, "
              f"{c['exposures']} exposures, {c['diseases']} diseases "
              f"-> {n/1024:7.1f} KB")
        if w.gz and n > SEARCH_BUDGET:
            warn("search_index is %.1f KB gz, over the %.0f KB budget -- shard it "
                 "or drop a field; NOT truncated" % (n / 1024, SEARCH_BUDGET / 1024))

        # The macros are the manuscript's claim; the exports are the data behind it.
        # A disagreement is a real finding, so say it out loud rather than reconcile.
        if macros:
            for name, got, what in (("nProteins", c["proteins"], "proteins"),
                                    ("nExposures", c["exposures"], "exposures"),
                                    ("nDiseasesGEM", c["diseases"], "diseases")):
                m = macros.get(name)
                if not m or "value" not in m:
                    warn("check: macro \\%s missing or non-numeric" % name)
                elif m["value"] != got:
                    warn("check: \\%s = %s but the export has %d %s"
                         % (name, m["raw"], got, what))
                else:
                    print(f"      check  \\{name} = {m['raw']} matches the export")

    ledger = os.path.join(os.path.dirname(out.rstrip("/")), "manifest_catalog.tsv")
    total = write_ledger(ledger, w.entries)

    print(f"\n  objects   {len(w.entries)} written, {total} in ledger")
    print(f"  payload   {sum(e['bytes'] for e in w.entries)/1024:,.1f} KB")
    print(f"  out       {out}")
    print(f"  ledger    {ledger}")
    if warnings:
        print(f"  warnings  {len(warnings)} (see above)")


if __name__ == "__main__":
    main()
