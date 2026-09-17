#!/usr/bin/env python3
"""Pack HEAP website exports into small, shardable, gzipped payloads.

Reads the tidy JSON that HEAP's `heap_export_website()` writes to
`<figures>/website/<figure_id>.json` and emits a browser-ready payload tree:

    <out>/manifest.json          index the frontend fetches first
    <out>/manifest.tsv           relpath / sha256 / bytes  (sync_gcs.py reads this)
    <out>/s/<section>.json.gz            tier S: one columnar blob per section
    <out>/k/<section>/_keys.json.gz      tier K: key -> shard filename
    <out>/k/<section>/<key>.json.gz      tier K: one columnar blob per key

Two encodings do the heavy lifting:
  * columnar  {"col":[v, ...]} instead of [{"col":v}, ...]  -- drops the repeated
    key names, which on a 1.2M-row table is most of the bytes.
  * sharding  one object per key, so a page fetches only the protein it renders.

Runs on O2, where figures/website/ lives. It cannot run in CI -- the source data
is not in the repo.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from collections import OrderedDict, defaultdict

from heap_ids import canonical_protein, protein_canon

DEFAULT_SOURCE = "/n/groups/patel/IGLOO/UKB/HEAP/figures/website"
DEFAULT_STATS = "/n/groups/patel/shakson_ukb/HEAP/docs/manuscript_stats"
DEFAULT_DEPOSIT = "/n/groups/patel/IGLOO/UKB/HEAP/output/supp_deposit"
# Tables this repo derives by joining published HEAP outputs (tools/build_*.py).
# No new estimation happens in them -- see build_decode_triads.py.
DEFAULT_DERIVED = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "build", "derived")
SAFE = re.compile(r"[^A-Za-z0-9._-]+")
PROTEIN_KEYS = {"protID", "protein", "Protein", "prot"}


def sanitize(key):
    """Filesystem/URL-safe shard filename. The real key stays in _keys.json."""
    s = SAFE.sub("-", str(key)).strip("-")
    return s or "_blank"


def clean(v):
    """JSON-legal scalar. NaN/Inf are valid Python json but *invalid* JSON --
    a browser's JSON.parse() rejects them, so they must become null."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


# R's exporters sometimes emit a numeric or logical column as character, so a
# column can arrive as ["0.0934", "1.2537"] or ["True", "False"]. Left alone
# those sort lexically ("10" < "9") and Plotly reads them as categories, so a
# whole-column type is recovered here -- once, at pack time.
_BOOL = {"TRUE": True, "FALSE": False, "True": True, "False": False}


def _retype(values):
    """Recover a column's type, but only when EVERY non-null value agrees.

    Leading zeros ("007") and leading '+' are left as strings: they are
    identifiers whose text form carries meaning, not quantities."""
    seen = [v for v in values if v is not None and v != ""]
    if not seen or not all(isinstance(v, str) for v in seen):
        return values

    if all(v in _BOOL for v in seen):
        return [None if v is None or v == "" else _BOOL[v] for v in values]

    for v in seen:
        t = v[1:] if v[:1] == "-" else v
        if t[:1] == "+" or (len(t) > 1 and t[0] == "0" and t[1].isdigit()):
            return values
        try:
            float(v)
        except ValueError:
            return values
    out = []
    for v in values:
        if v is None or v == "":
            out.append(None)
        else:
            f = float(v)
            out.append(int(f) if f.is_integer() and abs(f) < 2**53 else f)
    return out


def to_columnar(records, cols, drop=None):
    drop = drop or set()
    return OrderedDict(
        (c, _retype([clean(r.get(c)) for r in records]))
        for c in cols
        if c not in drop
    )


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


# ---------------------------------------------------------------------------
# Incremental packing
#
# A full run re-reads and re-packs all 117 sections. A typical edit changes
# three, and the other 114 are re-read off NFS only to produce byte-identical
# output -- about forty minutes of pure waste per iteration on this filesystem.
#
# The cache records, per section, the sha256 of its SOURCE file and the manifest
# entry that source produced. On a later run a section is skipped only when the
# source hash still matches AND every output file it produced is still on disk.
# Anything else -- changed source, missing shard, unreadable cache -- repacks.
#
# The manifest is still assembled from every section, changed or not. That is
# the difference between this and the existing --only flag, which rebuilds the
# manifest from the sections it packed and leaves every other page reporting
# "unknown section".
def source_stamp(path):
    """(mtime_ns, size) -- a stat, not a read.

    An earlier version hashed the file. That is stronger, but hashing every
    source means reading every source, which is the exact cost the cache exists
    to avoid: on this NFS mount it took longer than packing. mtime+size is what
    make and rsync trust, and a source that is rewritten with identical size and
    an unchanged mtime is not a case this pipeline produces -- every generator
    here writes a fresh file. `--force` covers the paranoid case.
    """
    st = os.stat(path)
    return [st.st_mtime_ns, st.st_size]


def load_cache(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def cache_usable(rec, out_dir):
    """A cache hit must still have its output on disk.

    SAMPLED, not exhaustive. A sharded section can be thousands of files and
    every os.path.exists on this mount is an NFS round trip -- verifying all
    21,315 outputs took longer than the packing it was meant to skip. First and
    last are checked, which catches a deleted or half-written directory; a
    surgically removed middle shard would slip through, and `--force` is the
    answer if that is ever a real worry.
    """
    if not rec or "entry" not in rec or "outputs" not in rec:
        return False
    outs = rec["outputs"]
    if not outs:
        return False
    for o in (outs[0], outs[-1]):
        if not os.path.exists(os.path.join(out_dir, o["path"])):
            return False
    return True


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


def read_tsv_records(path):
    """Read a TSV as records. Used for sources that are analysis summary tables
    rather than figure exports -- e.g. the canonical Tier-1 MR triad tables,
    which are the same files the supplement's S_mr_triads / S_mr_motifs are
    built from. Reading those directly means the site cannot drift from the
    supplement, and cannot accidentally pick up the nominal-significance
    motif_* columns of MRmotifs.tsv, which are a different (non-nested) rule."""
    with open(path, newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def read_config(path):
    rows = []
    with open(path) as f:
        header = f.readline().rstrip("\n").split("\t")
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            rows.append(dict(zip(header, line.split("\t"))))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "web_sections.tsv"))
    ap.add_argument("--source", default=os.environ.get("HEAP_WEBSITE_DIR", DEFAULT_SOURCE))
    ap.add_argument("--stats", default=os.environ.get("HEAP_STATS_DIR", DEFAULT_STATS),
                    help="root for source_kind=stats_tsv sections")
    ap.add_argument("--deposit", default=os.environ.get("HEAP_DEPOSIT_DIR", DEFAULT_DEPOSIT),
                    help="root for source_kind=deposit_tsv sections")
    ap.add_argument("--derived", default=DEFAULT_DERIVED,
                    help="root for source_kind=derived_tsv sections")
    ap.add_argument("--out", default=None, help="default: <repo>/build/web/v1")
    ap.add_argument("--only", action="append", help="section_id or page to build (repeatable)")
    ap.add_argument("--no-gzip", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="ignore the incremental cache and repack every section")
    args = ap.parse_args()

    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = args.out or os.path.join(repo, "build", "web", "v1")
    os.makedirs(out, exist_ok=True)

    cfg = read_config(args.config)
    w = Writer(out, gz=not args.no_gzip)

    pages = OrderedDict()
    skipped, missing = [], []
    reused = []
    src_total = 0
    cache_path = os.path.join(os.path.dirname(out.rstrip("/")), ".pack_cache.json")
    cache = {} if args.force else load_cache(cache_path)
    new_cache = {}

    for row in cfg:
        sid, page = row["section_id"], row["page"]
        if row.get("status", "on") != "on":
            skipped.append((sid, "status=" + row.get("status", "")))
            continue
        if args.only and sid not in args.only and page not in args.only:
            continue

        kind = (row.get("source_kind") or "figure").strip() or "figure"
        if kind == "stats_tsv":
            src = os.path.join(args.stats, row["source_figure"])
        elif kind == "derived_tsv":
            src = os.path.join(args.derived, row["source_figure"])
        elif kind == "deposit_tsv":
            # The supplementary data deposit. Richer than the figure exports:
            # it carries beta, SE, N and the covariate specification, which is
            # what lets the site show effect sizes and switch specifications
            # instead of only what one figure happened to plot.
            src = os.path.join(args.deposit, row["source_figure"])
        else:
            src = os.path.join(args.source, row["source_figure"] + ".json")
        if not os.path.exists(src):
            missing.append((sid, row["source_figure"]))
            continue

        src_bytes = os.path.getsize(src)
        src_total += src_bytes

        # Incremental: reuse this section's previous output when the source is
        # unchanged and everything it produced is still on disk.
        stamp = source_stamp(src)
        hit = cache.get(sid)
        if (not args.force and hit and hit.get("stamp") == stamp
                and cache_usable(hit, out)):
            pages.setdefault(page, []).append(hit["entry"])
            w.entries.extend(hit["outputs"])
            new_cache[sid] = hit
            reused.append(sid)
            continue
        w_mark = len(w.entries)

        records = (read_tsv_records(src)
                   if kind in ("stats_tsv", "deposit_tsv", "derived_tsv")
                   else json.load(open(src)))
        if not isinstance(records, list) or not records:
            missing.append((sid, row["source_figure"] + " (empty)"))
            continue

        # union of keys, first-seen order -- R can emit ragged records
        cols = list(OrderedDict((c, None) for r in records for c in r.keys()))
        key_col = (row.get("key_column") or "").strip()
        tier = row.get("tier", "S").strip().upper()

        entry = {
            "section_id": sid,
            "title": row.get("title", sid),
            "chart_hint": row.get("chart_hint", ""),
            "source_figure": row["source_figure"],
            "source_kind": kind,
            # Instrument arm. The MR analysis has two (UKB, deCODE) and most
            # exports carry no arm column, so the site would otherwise present
            # one arm of a two-arm analysis with nothing saying so.
            # "in-data" means the section's own rows carry it.
            "arm": (row.get("arm") or "").strip(),
            "tier": tier,
            "columns": cols,
            "n_rows": len(records),
        }

        if tier == "K" and key_col:
            if key_col not in cols:
                print(f"  !! {sid}: key_column '{key_col}' not in {cols}", file=sys.stderr)
                missing.append((sid, "bad key_column"))
                continue
            # Protein keys are published under the TRUE HGNC symbol. The
            # mediation/MR exports carry R-safe spellings (HLA_A for HLA-A)
            # because HEAP_loader.R:870 rewrites hyphens; without this the site
            # would shard the same protein under two different names.
            canon = protein_canon(args.source) if key_col in PROTEIN_KEYS else {}
            renamed = {}
            groups = defaultdict(list)
            for r in records:
                k = r.get(key_col)
                if canon:
                    c = canonical_protein(k, canon)
                    if c != k:
                        renamed[k] = c
                    k = c
                groups[k].append(r)
            if renamed:
                print(f"       canonicalized {len(renamed)} protein id(s): "
                      + ", ".join(f"{a}->{b}" for a, b in sorted(renamed.items())))

            keys, used, total = OrderedDict(), {}, 0
            for k in sorted(groups, key=lambda x: (x is None, str(x))):
                fname = sanitize(k)
                if fname in used and used[fname] != k:  # collision after sanitizing
                    fname = f"{fname}-{hashlib.sha1(str(k).encode()).hexdigest()[:6]}"
                used[fname] = k
                keys[str(k)] = fname
                total += w.write(
                    f"k/{sid}/{fname}.json",
                    to_columnar(groups[k], cols, drop={key_col}),
                )
            w.write(f"k/{sid}/_keys.json", {"key_column": key_col, "keys": keys})
            entry.update(key_column=key_col, n_keys=len(keys),
                         base=f"k/{sid}/", keys_path=f"k/{sid}/_keys.json")
            print(f"  [K] {sid:28s} {src_bytes/1048576:8.1f} MB -> "
                  f"{len(keys):5d} shards, {total/1048576:6.2f} MB "
                  f"({total/len(keys)/1024:.1f} KB each)")
        else:
            n = w.write(f"s/{sid}.json", to_columnar(records, cols))
            entry["path"] = f"s/{sid}.json"
            print(f"  [S] {sid:28s} {src_bytes/1048576:8.1f} MB -> {n/1024:8.1f} KB")

        pages.setdefault(page, []).append(entry)
        # Everything this section wrote, so a later run can prove it is intact.
        # dict(entry), not entry: the .gz fixup below mutates the objects in
        # `pages`, and a shared reference would carry that mutation into the
        # cache and compound it on every subsequent run.
        new_cache[sid] = {"stamp": stamp, "entry": dict(entry),
                          "outputs": list(w.entries[w_mark:])}

    if w.gz:  # record the .gz suffix the client must request
        # IDEMPOTENT. Cached entries come back from a previous run with the
        # suffix already applied -- the cache holds the same dict object this
        # loop mutates -- so appending unconditionally produced .gz.gz and then
        # .gz.gz.gz, and every section 404'd. Only add it when it is missing.
        for secs in pages.values():
            for e in secs:
                for f in ("path", "keys_path"):
                    if f in e and not e[f].endswith(".gz"):
                        e[f] += ".gz"

    manifest = {"version": "v1", "gzipped": w.gz,
                "pages": [{"page": p, "sections": s} for p, s in pages.items()]}
    w.write("manifest.json", manifest)
    with open(cache_path, "w") as f:
        json.dump(new_cache, f)
    print(f"  packed {len(new_cache) - len(reused)}, reused {len(reused)} unchanged")
    if reused:
        print("    reused: " + ", ".join(sorted(reused)))

    # Ledger of what was built. Lives OUTSIDE the synced tree: it is the record
    # committed to git, not an asset the browser fetches.
    ledger = os.path.join(os.path.dirname(out.rstrip("/")), "manifest.tsv")
    with open(ledger, "w") as f:
        f.write("path\tsha256\tbytes\traw_bytes\n")
        for e in sorted(w.entries, key=lambda x: x["path"]):
            f.write(f"{e['path']}\t{e['sha256']}\t{e['bytes']}\t{e['raw_bytes']}\n")

    out_total = sum(e["bytes"] for e in w.entries)
    print(f"\n  objects   {len(w.entries):,}")
    print(f"  source    {src_total/1048576:,.1f} MB")
    print(f"  payload   {out_total/1048576:,.1f} MB"
          + (f"   ({src_total/out_total:.0f}x smaller)" if out_total else ""))
    print(f"  out       {out}")
    if skipped:
        print("  skipped (status off): " + ", ".join(s for s, _ in skipped))
    if missing:
        print("  NOT EXPORTED BY HEAP -- rerun build_figures.R for these:")
        for sid, fig in missing:
            print(f"    {sid:28s} <- {fig}")


if __name__ == "__main__":
    main()
