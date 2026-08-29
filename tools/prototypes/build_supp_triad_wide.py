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
"""PROPOSAL: the WIDE Supplementary Table -- one row per triad.

Companion to the long file. The workbook keeps one row per triad so the sheet
stays readable and proportionate (the largest existing sheet is 25,414 rows;
all 21 together are 59,472). The long file is where per-edge filtering happens.

This is the CURRENT sheet upgraded, not a new object: same row definition as
mr_triad_motifs.tsv, plus the three things it could not show --
  * the deCODE panel, so cross-panel replication is checkable
  * mr_tier_final per edge, so Tier 1+ is visible rather than collapsed
  * the resolved colocalization verdict, instead of "pending"
"""
import argparse, csv, os

LONG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived", "supp_mr_triads_long.tsv")
# edge suffix -> (direction, edge_class) as they appear in the long file
EDGE = [("EP", "E_to_P", "genome-wide"), ("PDcis", "P_to_D", "cis"),
        ("PDtrans", "P_to_D", "trans"), ("ED", "E_to_D", "genome-wide"),
        ("PEcis", "P_to_E", "cis"), ("PEtrans", "P_to_E", "trans"),
        ("DP", "D_to_P", "genome-wide"), ("DE", "D_to_E", "genome-wide")]
PROTEIN_EDGE = {"EP", "PDcis", "PDtrans", "PEcis", "PEtrans", "DP"}
ID = ["triad_id", "Exposure", "Exposure_category", "Protein",
      "Disease", "Disease_UKB", "ICD10", "motif"]


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
    ap.add_argument("--long", default=LONG)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    triads, order = {}, []
    with open(args.long) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            t = r["triad_id"]
            if t not in triads:
                triads[t] = {k: r.get(k, "") for k in ID}
                order.append(t)
            suf = next((s for s, d, c in EDGE
                        if d == r["direction"] and c == r["edge_class"]), None)
            if suf is None:
                continue
            # protein-free edges are identical across panels; store them once
            panel = "UKB" if r["panel"] == "both" else r["panel"]
            tag = "UKB" if panel == "UKB" else "dCODE"
            row = triads[t]
            row[f"beta_{suf}_{tag}"] = r["beta"]
            row[f"se_{suf}_{tag}"] = r["se"]
            row[f"padj_{suf}_{tag}"] = r["padj"]
            row[f"tier_{suf}_{tag}"] = r["mr_tier_final"]
            if r["coloc_verdict"] not in ("not_tested", "not_available", ""):
                row[f"coloc_{suf}_{tag}"] = r["coloc_verdict"]
                row[f"colocPPH4_{suf}_{tag}"] = r["coloc_PP_H4"]

    cols = list(ID)
    for suf, _d, _c in EDGE:
        tags = ["UKB", "dCODE"] if suf in PROTEIN_EDGE else ["UKB"]
        for tag in tags:
            cols += [f"beta_{suf}_{tag}", f"se_{suf}_{tag}",
                     f"padj_{suf}_{tag}", f"tier_{suf}_{tag}"]
            if suf in ("PDcis", "PEcis"):
                cols += [f"coloc_{suf}_{tag}", f"colocPPH4_{suf}_{tag}"]

    out = args.out or os.path.join(os.path.dirname(args.long), "supp_mr_triads_wide.tsv")
    with open(out, "w", newline="") as g:
        w = csv.DictWriter(g, fieldnames=cols, delimiter="\t", extrasaction="ignore")
        w.writeheader()
        for t in order:
            w.writerow(triads[t])
    print(f"  triads: {len(order):,}   columns: {len(cols)}")
    print(f"  -> {out}  ({os.path.getsize(out)/1048576:.1f} MB)")


if __name__ == "__main__":
    main()
