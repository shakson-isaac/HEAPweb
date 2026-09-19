#!/usr/bin/env python3
"""Tier E: pre-join HEAP's figure exports into one bundle per entity.

`build_payload.py` ships tiers S and K -- one blob per *section*. An entity page
(§6.3 protein, §6.4 exposure of docs/WEBSITE_PLAN.md) needs eight or nine of
those sections at once, which is eight or nine requests for one page. Tier E
does that join **at build time**: one object per protein / per exposure holding
every section that mentions it, so the page fires ONE request of ~30 KB.

    <out>/e/protein/<SYMBOL>.json.gz     {"<section_id>": {col:[v,...]}, ...}
    <out>/e/protein/_index.json.gz       keys, filenames, byte sizes, aliases
    <out>/e/exposure/<SLUG>.json.gz      same shape
    <out>/e/exposure/_index.json.gz

The bundle drops the key column from every section -- on a protein page every
row of every section is that protein, so repeating the symbol 900 times is pure
weight. The real key -> filename mapping lives in `_index.json`, because
exposure ids carry dots and parentheses-turned-dots that a filename must not.

Encoding primitives (columnar layout, deterministic gzip, NaN scrubbing,
whole-column type recovery, filename sanitizing, the Writer/ledger) are
IMPORTED from build_payload.py rather than copied, so tiers S/K and E cannot
drift apart. The ledger is written to `manifest_entities.tsv` -- a separate file
from build_payload.py's `manifest.tsv`, so the two packers never clobber one
another when they run side by side.

    python3 tools/build_entities.py

Runs on O2, where figures/website/ lives; the source data is not in this repo.


TWO TRAPS THIS FILE EXISTS TO HANDLE
------------------------------------
1. The id COLUMN NAME varies across exports while the VALUES do not: a protein
   is `protID` in the mediation/MR exports, `protein` in the ExWAS ones and
   `Protein` in fig_mr_edges -- but it is "A1BG" in all of them. ID_COLUMNS is
   an ORDERED preference list per entity, and the order is load-bearing:
   fig_tissue_enrichment carries BOTH `cID` (the exposure id) and `exposure`
   (a human display label), so `cID` must be tried first or every tissue page
   would key on "Age first had sexual".

2. The id VALUES are near-consistent, not consistent. Four proteins are spelled
   with a hyphen in the ExWAS-family exports (HLA-A, HLA-DRA, HLA-E, ERVV-1)
   and with an underscore in the mediation/MR family (HLA_A, ...), because one
   pipeline pushed symbols through R column names and the other did not. That
   is why a naive union counts 2,690 proteins against the manuscript's
   \\nProteins = 2,686. Bundles are therefore joined on a normalized key
   (hyphen -> underscore, upper-cased) and published under the un-mangled
   spelling; every collapsed spelling is reported on stderr and recorded in
   `_index.json`'s "aliases" so the frontend can resolve either form and nobody
   has to rediscover this. `--no-merge-aliases` restores the raw 2,690 view.
"""
import argparse
import gc
import hashlib
import json
import os
import re
import statistics
import sys
import time
from collections import OrderedDict, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_payload import DEFAULT_SOURCE, Writer, sanitize, to_columnar  # noqa: E402

# Ordered by preference; first column PRESENT in a source wins. See trap 1.
ID_COLUMNS = {
    "protein": ("protID", "protein", "Protein"),
    "exposure": ("exposure_id", "cID", "Eid", "exposure", "p1"),
    "disease": ("DZ_ID", "Disease", "disease", "disease_age_col"),
}

# figure export -> section id in the bundle -> which entities it is keyed by.
# Section ids match tools/web_sections.tsv where that config already names the
# figure, and are otherwise the figure id minus its `fig_` prefix. A source
# listed under several entities is loaded ONCE and split, which matters: the two
# ExWAS tables alone are 290 MB of JSON.
SOURCES = (
    ("fig_mediation_main", "mediation_main", ("protein", "disease")),
    ("fig_mr_priority", "mr_priority", ("protein", "disease")),
    ("fig_gem_landscape", "gem_landscape", ("protein", "disease")),
    ("fig_mediation_volcano", "mediation_volcano", ("protein", "disease")),
    ("fig_mr_edges", "mr_edges", ("protein", "disease")),
    ("fig_exwas_miami", "exwas_miami", ("protein", "exposure")),
    ("fig_expo_protein_assoc", "expo_protein_assoc", ("protein", "exposure")),
    ("fig_gxe_assoc", "gxe_assoc", ("protein", "exposure")),
    ("fig_intervention_scatter", "intervention_scatter", ("protein", "exposure")),
    ("fig_tissue_enrichment", "tissue_enrichment", ("exposure",)),
    ("fig_pathway_enrichment", "pathway_enrichment", ("exposure",)),
    ("fig_instrument_diagnostics", "instrument_diagnostics", ("exposure",)),
    ("fig_pes_predictive_accuracy", "pes_predictive_accuracy", ("exposure",)),
)

# Disease pages are blocked on G2 (no disease metadata table yet), so disease
# bundles are wired but not built unless asked for with --entity disease.
DEFAULT_ENTITIES = ("protein", "exposure")

RESERVED = {"_index"}  # a key must never sanitize onto the index filename


def norm_key(entity, raw):
    """The JOIN key. Not published -- `display_key` picks what the user sees."""
    s = str(raw).strip()
    if entity == "protein":
        # Hyphen and underscore are the same character to one pipeline and not
        # the other; case never varies but folding it is free insurance.
        return s.replace("-", "_").upper()
    return s


def display_key(entity, spellings):
    """Pick the published spelling among the variants that share a join key.

    For proteins prefer the hyphenated form: mangling only ever runs one way
    (`HLA-A` -> `HLA_A`), so a hyphen can only have come from the true HGNC
    symbol. Composite assay names (AMY1A_AMY1B_AMY1C) have no hyphen variant
    and are untouched. Lexicographic min is the deterministic tie-break."""
    if entity == "protein":
        hyphenated = sorted(s for s in spellings if "-" in s)
        if hyphenated:
            return hyphenated[0]
    return sorted(spellings)[0]


def pick_id_column(entity, cols):
    for c in ID_COLUMNS[entity]:
        if c in cols:
            return c
    return None


def rss_gb():
    try:
        with open("/proc/self/statm") as f:
            return int(f.read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / 2**30
    except OSError:
        return float("nan")


class Entity:
    """Accumulates {join_key: {section_id: columnar}} for one entity type."""

    def __init__(self, name, merge_aliases=True):
        self.name = name
        self.merge = merge_aliases
        self.bundles = defaultdict(OrderedDict)
        self.spellings = defaultdict(dict)  # join key -> {raw: [section ids]}
        self.sections = []                  # bundle section order = load order
        self.blank = 0                      # rows dropped for a missing id

    def key_of(self, raw):
        return norm_key(self.name, raw) if self.merge else str(raw).strip()

    def absorb(self, sid, records, cols):
        """Group one source by this entity's id and columnar-encode it."""
        key_col = pick_id_column(self.name, cols)
        if key_col is None:
            print(f"  !! {sid}: no {self.name} id column among {cols}", file=sys.stderr)
            return None

        groups = defaultdict(list)
        for r in records:
            raw = r.get(key_col)
            if raw is None or str(raw).strip() == "":
                self.blank += 1
                continue
            k = self.key_of(raw)
            groups[k].append(r)
            # Which sources spelled this key which way -- recorded once per
            # (key, spelling, source), never once per row: on a 940k-row table
            # the per-row form is millions of pointless list appends.
            seen = self.spellings[k]
            s = str(raw).strip()
            if s not in seen:
                seen[s] = [sid]
            elif seen[s][-1] != sid:
                seen[s].append(sid)

        n_keys = len(groups)
        # Pop as we go so each group's records are freed while the columnar
        # copy is being built, instead of holding both whole tables at once.
        for k in list(groups):
            self.bundles[k][sid] = to_columnar(groups.pop(k), cols, drop={key_col})
        self.sections.append(sid)
        return key_col, n_keys

    def alias_map(self):
        """{alternate spelling: published spelling} for every collapsed key."""
        out = {}
        for k, seen in self.spellings.items():
            if len(seen) > 1:
                pub = display_key(self.name, seen)
                for raw in seen:
                    if raw != pub:
                        out[raw] = pub
        return dict(sorted(out.items()))

    def report_aliases(self):
        rows = []
        for k, seen in sorted(self.spellings.items()):
            if len(seen) > 1:
                pub = display_key(self.name, seen)
                rows.append((pub, {r: sorted(set(s)) for r, s in seen.items()}))
        if not rows:
            return
        print(f"\n  KEY ALIASING ({self.name}): {len(rows)} key(s) had >1 spelling "
              f"across sources; they are ONE entity and were merged.")
        for pub, seen in rows:
            for raw, sids in sorted(seen.items()):
                mark = "published" if raw == pub else f"-> {pub}"
                print(f"    {raw:<24s} {mark:<16s} {', '.join(sids)}")


def parent_map(keys):
    """Exposure only: fig_exwas_miami keys per LEVEL of an ordinal exposure
    (`..._f1558_0_02`) while every other source keys the VARIABLE
    (`..._f1558_0_0`). Those are different keys and are NOT merged -- merging
    would fabricate rows. Instead the level -> variable link is recorded so a
    variable's page can offer its levels. Only emitted when the parent is
    itself a real bundle, so nothing is invented."""
    field = re.compile(r"^(.*_f\d+_\d+_\d+)(.+)$")
    have, out = set(keys), {}
    for k in keys:
        m = field.match(k)
        if m and m.group(1) in have and m.group(1) != k:
            out[k] = m.group(1)
    return dict(sorted(out.items()))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--source", default=os.environ.get("HEAP_WEBSITE_DIR", DEFAULT_SOURCE))
    ap.add_argument("--out", default=None, help="default: <repo>/build/web/v1")
    ap.add_argument("--entity", action="append", choices=sorted(ID_COLUMNS),
                    help=f"repeatable; default: {' '.join(DEFAULT_ENTITIES)}")
    ap.add_argument("--only", action="append",
                    help="figure or section id to load (repeatable); for debugging")
    ap.add_argument("--no-gzip", action="store_true")
    ap.add_argument("--no-merge-aliases", action="store_true",
                    help="keep HLA_A and HLA-A as two entities (the raw 2,690 view)")
    args = ap.parse_args()

    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = args.out or os.path.join(repo, "build", "web", "v1")
    os.makedirs(out, exist_ok=True)

    wanted = tuple(args.entity or DEFAULT_ENTITIES)
    ents = OrderedDict((e, Entity(e, merge_aliases=not args.no_merge_aliases))
                       for e in wanted)
    w = Writer(out, gz=not args.no_gzip)
    missing, src_total = [], 0

    print(f"  entities  {', '.join(wanted)}")
    print(f"  source    {args.source}\n")

    for figure, sid, for_entities in SOURCES:
        use = [e for e in for_entities if e in ents]
        if not use:
            continue
        if args.only and figure not in args.only and sid not in args.only:
            continue

        path = os.path.join(args.source, figure + ".json")
        if not os.path.exists(path):
            missing.append((sid, figure))
            print(f"  !! SKIP {sid:24s} <- {figure}.json not exported by HEAP",
                  file=sys.stderr)
            continue

        t0 = time.time()
        src_bytes = os.path.getsize(path)
        src_total += src_bytes
        with open(path) as f:
            records = json.load(f)
        if not isinstance(records, list) or not records:
            missing.append((sid, figure + " (empty)"))
            print(f"  !! SKIP {sid:24s} <- {figure}.json is empty", file=sys.stderr)
            del records
            continue

        # union of keys, first-seen order -- R can emit ragged records
        cols = list(OrderedDict((c, None) for r in records for c in r.keys()))
        got = []
        for e in use:
            res = ents[e].absorb(sid, records, cols)
            if res:
                got.append(f"{res[1]:,} {e}s on {res[0]}")

        del records
        gc.collect()
        print(f"  [{sid:24s}] {src_bytes/1048576:7.1f} MB  ->  "
              f"{' | '.join(got) if got else 'no usable id column':44s}"
              f"  {time.time()-t0:5.1f}s  rss {rss_gb():.1f} GB")

    # ---- write one bundle per entity, then its index -------------------------
    totals = {}
    for name, e in ents.items():
        if not e.bundles:
            print(f"\n  !! {name}: nothing to write", file=sys.stderr)
            continue

        pub = {k: display_key(name, e.spellings[k]) for k in e.bundles}
        order = sorted(e.bundles, key=lambda k: pub[k])
        section_ix = {s: i for i, s in enumerate(e.sections)}

        keys, files, nbytes, nraw, rows, has = [], [], [], [], [], []
        used = {}
        for k in order:
            key = pub[k]
            fname = sanitize(key)
            if fname in RESERVED or (fname in used and used[fname] != key):
                fname = f"{fname}-{hashlib.sha1(key.encode()).hexdigest()[:6]}"
            used[fname] = key
            bundle = e.bundles[k]
            n = w.write(f"e/{name}/{fname}.json", bundle)
            keys.append(key)
            files.append(fname + (".json.gz" if w.gz else ".json"))
            nbytes.append(n)
            nraw.append(w.entries[-1]["raw_bytes"])
            rows.append(sum(len(next(iter(c.values()))) if c else 0
                            for c in bundle.values()))
            has.append(sum(1 << section_ix[s] for s in bundle))

        index = OrderedDict(
            version="v1", entity=name, gzipped=w.gz, base=f"e/{name}/",
            id_columns=list(ID_COLUMNS[name]), sections=list(e.sections),
            n=len(keys), keys=keys, files=files, bytes=nbytes,
            raw_bytes=nraw, rows=rows, has=has, aliases=e.alias_map(),
        )
        if name == "exposure":
            index["parents"] = parent_map(keys)
        w.write(f"e/{name}/_index.json", index)

        med, mx = statistics.median(nbytes), max(nbytes)
        totals[name] = sum(nbytes)
        print(f"\n  [E] {name:9s} {len(keys):5,d} bundles   "
              f"median {med/1024:6.1f} KB   max {mx/1024:6.1f} KB   "
              f"total {sum(nbytes)/1048576:6.1f} MB   "
              f"({keys[nbytes.index(mx)]} is largest)")
        if e.blank:
            print(f"      {e.blank:,} row(s) dropped for a blank id")
        e.report_aliases()
        if name == "exposure" and index["parents"]:
            print(f"\n  LEVEL KEYS (exposure): {len(index['parents'])} key(s) are a "
                  f"single LEVEL of an exposure that other sources key as one\n"
                  f"    variable (e.g. {next(iter(index['parents']))}). Kept "
                  f"separate; the link is in _index.json \"parents\".")
        e.bundles.clear()
        gc.collect()

    # Ledger of what was built: relpath / sha256 / bytes, the record sync_gcs.py
    # checks the tree against before uploading. It lives one level ABOVE the
    # synced tree so it is never itself published. Deliberately NOT
    # manifest.tsv -- build_payload.py owns that name, and the two packers run
    # side by side. NOTE: sync_gcs.py reads one ledger and rejects any file in
    # build/web/v1 that is not in it, so publishing tier E needs it pointed at
    # both ledgers (see README / DATA_PIPELINE.md).
    ledger = os.path.join(os.path.dirname(out.rstrip("/")), "manifest_entities.tsv")
    with open(ledger, "w") as f:
        f.write("path\tsha256\tbytes\traw_bytes\n")
        for en in sorted(w.entries, key=lambda x: x["path"]):
            f.write(f"{en['path']}\t{en['sha256']}\t{en['bytes']}\t{en['raw_bytes']}\n")

    out_total = sum(en["bytes"] for en in w.entries)
    print(f"\n  objects   {len(w.entries):,}")
    print(f"  source    {src_total/1048576:,.1f} MB")
    print(f"  payload   {out_total/1048576:,.1f} MB"
          + (f"   ({src_total/out_total:.0f}x smaller)" if out_total else ""))
    for name, t in totals.items():
        print(f"    {name:9s} {t/1048576:8.1f} MB")
    print(f"  out       {out}/e/")
    print(f"  ledger    {ledger}")
    if missing:
        print("  NOT EXPORTED BY HEAP -- rerun build_figures.R for these:")
        for sid, fig in missing:
            print(f"    {sid:28s} <- {fig}")


if __name__ == "__main__":
    main()
