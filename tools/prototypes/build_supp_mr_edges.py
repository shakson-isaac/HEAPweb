#!/usr/bin/env python3
# =============================================================================
# DECOMMISSIONED -- NOT THE GENERATOR OF RECORD.
#
# The MR supplementary tables are produced by:
#     HEAP/scripts/analysis_summaries/build_mr_supp_tables.R
# and land in $HEAP_OUTPUT/mr_edges/summary/supp/. HEAP_manuscript reads them
# from there via config/supp_tables.tsv. Nothing in the manuscript build calls
# this file.
#
# This prototype is retained ONLY as a cross-check oracle: diffing the R output
# against it is what caught the PEtrans edge-endpoint bug (P->E written as D->E),
# which produced a file of correct shape and plausible values but 9,656 wrong
# tier lookups. That is worth keeping. Regenerating a shipped table from here is
# not -- two generators for one artifact is how the shipped copy silently drifts
# from the one the manuscript describes.
#
# To run it as a cross-check, pass --cross-check explicitly.
# =============================================================================
"""PROPOSAL: per-panel MR edge tables for Supplementary Data.

Two files that already exist describe the SAME 77,573 (UKB) / 58,593 (deCODE)
edges, one row each, and are two columns short of one being a superset:

  mr_sensitivity_long.tsv   43 cols  estimates + every diagnostic, but no
                                     mr_tier_final and no cross-panel replication
  mr_tiered_edges.tsv       14 cols  the verdict summary -- and NO effect sizes,
                                     so the shipped Supplementary Data currently
                                     contains no beta, SE or p-value at all

This joins them into one 45-column table per panel, which makes
mr_tiered_edges.tsv redundant for shipping purposes.

Why per panel rather than one stacked file: the two panels are different
instrument sources measured on different assay platforms (UK Biobank Olink,
deCODE SomaScan), and a reader almost always wants one or the other. The
`panel` and `platform` columns still allow stacking with rbind.
"""
import argparse, csv, os, sys

S = "/n/groups/patel/IGLOO/UKB/HEAP/output/mr_edges/summary"
PANELS = {
    "UKB":    dict(sens=f"{S}/mr_sensitivity_long.tsv",        tag="UKB",
                   platform="Olink",    label="UK Biobank"),
    "DECODE": dict(sens=f"{S}/DECODE/mr_sensitivity_long.tsv", tag="DECODE",
                   platform="SomaScan", label="deCODE"),
}
TIERED = f"{S}/mr_tiered_edges.tsv"
KEY = ("edge_dir", "src_id", "tgt_id")
# carried over from the verdict table; absent from the sensitivity file
ADD = ["mr_tier_final", "replicated"]


def _refuse_unless_cross_check():
    """Decommissioned: only runnable as an explicit cross-check (see banner)."""
    import sys
    if "--cross-check" in sys.argv:
        sys.argv.remove("--cross-check")
        return
    sys.exit(
        "DECOMMISSIONED: this prototype no longer generates supplementary tables.\n"
        "Generator of record: HEAP/scripts/analysis_summaries/build_mr_supp_tables.R\n"
        "To run it anyway as a cross-check oracle, pass --cross-check."
    )


def main():
    _refuse_unless_cross_check()
    ap = argparse.ArgumentParser()
    ap.add_argument("--panel", choices=list(PANELS), required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    cfg = PANELS[args.panel]

    verdict = {}
    with open(TIERED) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            if r["dataset"] != cfg["tag"]:
                continue
            verdict[tuple(r[k] for k in KEY)] = {k: r.get(k, "") for k in ADD}
    print(f"  {args.panel}: verdicts indexed {len(verdict):,}")

    with open(cfg["sens"]) as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    print(f"  {args.panel}: sensitivity rows {len(rows):,}")

    # `panel` and `platform` are stated explicitly so a stacked file is
    # self-describing; `instrument_type` replaces the source's "polygenic",
    # which reads as a polygenic score rather than a multi-SNP GWAS instrument.
    base = [c for c in rows[0]]
    cols = ["panel", "platform", "instrument_type"] + base + ADD
    missing = 0
    with open(args.out, "w", newline="") as g:
        w = csv.DictWriter(g, fieldnames=cols, delimiter="\t", extrasaction="ignore")
        w.writeheader()
        for r in rows:
            v = verdict.get(tuple(r[k] for k in KEY))
            if v is None:
                missing += 1
                v = {k: "" for k in ADD}
            ec, ed = r.get("edge_class", ""), r.get("edge_dir", "")
            r["instrument_type"] = ("cis-pQTL" if ec == "cis" else
                                    "trans-pQTL" if ec == "trans" else
                                    "exposure GWAS" if ed.startswith("E_") else
                                    "disease GWAS")
            r["panel"] = cfg["label"]
            r["platform"] = cfg["platform"]
            r.update(v)
            w.writerow(r)
    if missing:
        print(f"  WARNING: {missing:,} edges had no verdict row", file=sys.stderr)
    print(f"  -> {args.out}  ({len(rows):,} x {len(cols)}, "
          f"{os.path.getsize(args.out)/1048576:.1f} MB)")


if __name__ == "__main__":
    main()
