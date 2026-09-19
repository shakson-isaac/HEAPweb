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
"""PROPOSAL: the wide triad table over the FULL tested universe.

Two products from one shape:
  Supplementary TABLE  the 18,780 motif-carrying triads   (build_supp_triad_wide.py)
  Supplementary DATA   all 199,646 tested triads          (this script)

Same columns either way, so a reader who learns one has learned both. The Data
file is the transparency artifact: every combination that was tested, including
the great majority carrying no motif at all, so "absent from the table" and
"tested and found null" are distinguishable.

motif is the Tier-1 motif where the triad carries one and empty otherwise --
NOT the nominal motif_label in MRmotifs.tsv, which is a different rule and would
contradict the paper (84 mediator triads rather than 6).
"""
import argparse, csv, os, sys

S = "/n/groups/patel/IGLOO/UKB/HEAP/output/mr_edges/summary"
UKB_ALL = f"{S}/MRmotifs.tsv"
DEC_ALL = f"{S}/DECODE/MRmotifs.tsv"
TIERED  = f"{S}/mr_tiered_edges.tsv"
COLOC   = "/n/groups/patel/IGLOO/UKB/HEAP/output/support/coloc/coloc_results.tsv"
TIER1   = "/n/groups/patel/shakson_ukb/HEAP/docs/manuscript_stats/module5/mr_triad_motifs.tsv"

EDGE = [("EP","E_to_P","genome-wide","E","P"), ("PDcis","P_to_D","cis","P","D"),
        ("PDtrans","P_to_D","trans","P","D"), ("ED","E_to_D","genome-wide","E","D"),
        ("PEcis","P_to_E","cis","P","E"), ("PEtrans","P_to_E","trans","P","E"),
        ("DP","D_to_P","genome-wide","D","P"), ("DE","D_to_E","genome-wide","D","E")]
TDIR = {"EP":"E_to_P","PDcis":"Pcis_to_D","PDtrans":"Ptrans_to_D","ED":"E_to_D",
        "PEcis":"Pcis_to_E","PEtrans":"Ptrans_to_E","DP":"D_to_P","DE":"D_to_E"}
PROTEIN_EDGE = {"EP","PDcis","PDtrans","PEcis","PEtrans","DP"}
ID = ["triad_id","Exposure","Exposure_category","Protein","Disease","Disease_UKB","ICD10","motif"]


def num(x):
    try:
        v = float(x); return v if v == v else None
    except (TypeError, ValueError): return None


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
    ap.add_argument("--out", default=None)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    tier = {}
    with open(TIERED) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            p = "UKB" if r["dataset"] == "UKB" else "dCODE"
            tier[(p, r["edge_dir"], r["src_id"], r["tgt_id"])] = r["mr_tier_final"]
    print(f"  tiers indexed:  {len(tier):,}", flush=True)

    coloc = {}
    if os.path.exists(COLOC):
        with open(COLOC) as f:
            for r in csv.DictReader(f, delimiter="\t"):
                p = "UKB" if r["arm"] == "UKB" else "dCODE"
                h3, h4 = num(r.get("PP.H3")), num(r.get("PP.H4"))
                v = ("colocalized" if h4 is not None and h4 >= 0.8
                     else "distinct_variants" if h3 is not None and h3 >= 0.8
                     else "ambiguous")
                coloc[(p, r["edge_dir"], r["protID"], r["target"])] = (v, r.get("PP.H4", ""))
    print(f"  coloc verdicts: {len(coloc):,}", flush=True)

    motif = {}
    with open(TIER1) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            motif[(r["Exposure"], r["Protein"], r["Disease"])] = r["motif"]
    print(f"  Tier-1 motifs:  {len(motif):,}", flush=True)

    dec = {}
    with open(DEC_ALL) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            dec[(r["Exposure"], r["Protein"], r["Disease"])] = r
    print(f"  deCODE triads:  {len(dec):,}", flush=True)

    cols = list(ID)
    for suf, _d, _c, _a, _b in EDGE:
        for tag in (["UKB", "dCODE"] if suf in PROTEIN_EDGE else ["UKB"]):
            cols += [f"beta_{suf}_{tag}", f"se_{suf}_{tag}",
                     f"padj_{suf}_{tag}", f"tier_{suf}_{tag}"]
            if suf in ("PDcis", "PEcis"):
                cols += [f"coloc_{suf}_{tag}", f"colocPPH4_{suf}_{tag}"]

    out = args.out or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                   "build", "derived", "supp_mr_triads_wide_ALL.tsv")
    n, withmotif = 0, 0
    with open(UKB_ALL) as f, open(out, "w", newline="") as g:
        w = csv.DictWriter(g, fieldnames=cols, delimiter="\t", extrasaction="ignore")
        w.writeheader()
        for r in csv.DictReader(f, delimiter="\t"):
            if args.limit and n >= args.limit:
                break
            E, P, D = r["Exposure"], r["Protein"], r["Disease"]
            node = {"E": E, "P": P, "D": D}
            m = motif.get((E, P, D), "")
            if m: withmotif += 1
            row = {"triad_id": f"{E}|{P}|{D}", "Exposure": E,
                   "Exposure_category": r.get("ExposureCategory", ""), "Protein": P,
                   "Disease": D, "Disease_UKB": r.get("Disease_UKB", ""),
                   "ICD10": r.get("ICD10", ""), "motif": m}
            dr = dec.get((E, P, D))
            for suf, direction, cls, a, b in EDGE:
                for tag, src in (("UKB", r), ("dCODE", dr)):
                    if tag == "dCODE" and (suf not in PROTEIN_EDGE or src is None):
                        continue
                    row[f"beta_{suf}_{tag}"] = src.get(f"beta_{suf}", "")
                    row[f"se_{suf}_{tag}"] = src.get(f"se_{suf}", "")
                    row[f"padj_{suf}_{tag}"] = src.get(f"padj_{suf}", "")
                    row[f"tier_{suf}_{tag}"] = tier.get(
                        (tag, TDIR[suf], node[a], node[b]), "")
                    if suf in ("PDcis", "PEcis"):
                        c = coloc.get((tag, TDIR[suf], P, node[b]))
                        if c:
                            row[f"coloc_{suf}_{tag}"], row[f"colocPPH4_{suf}_{tag}"] = c
            w.writerow(row)
            n += 1
            if n % 50000 == 0:
                print(f"    {n:,} triads", flush=True)
    print(f"\n  triads: {n:,}   with a Tier-1 motif: {withmotif:,}   columns: {len(cols)}")
    print(f"  -> {out}  ({os.path.getsize(out)/1048576:.1f} MB)")


if __name__ == "__main__":
    main()
