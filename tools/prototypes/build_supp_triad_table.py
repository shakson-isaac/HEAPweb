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
"""PROPOSAL: a long-format Supplementary Table for the MR triads.

Not adopted. This builds the candidate so its shape can be judged against real
data, and so adopting it is a decision rather than a build. It writes nowhere
near the manuscript; the author owns the registry row, the legend and the
\\Tref citation.

WHY CHANGE THE CURRENT TABLE
  mr_triad_motifs.tsv is wide: one row per triad, 37 columns, and the
  provenance of each estimate is ENCODED IN THE COLUMN NAME -- `beta_PDcis`
  means beta, protein->disease, cis-instrumented, UK Biobank panel (implicitly).
  Consequences for a reader with a spreadsheet:
    * "show me every cis-anchored edge with q < 0.05" needs an unpivot first
    * the deCODE panel is absent entirely, so cross-panel replication -- which
      the Tier 1+ rung is DEFINED by -- cannot be checked from the table
    * an edge's tier, instrument count and colocalization live in a different
      file, so the table cannot stand alone

THE PROPOSED RECORD
  one row per (triad x direction x instrument class x panel)
  every provenance field is its own column; nothing is implied by a name;
  cis and trans are never collapsed, because a reader filtering for
  cis-anchored evidence must be able to separate them.
"""
import argparse, csv, os, sys
from collections import defaultdict

UKB_TRIADS = "/n/groups/patel/shakson_ukb/HEAP/docs/manuscript_stats/module5/mr_triad_motifs.tsv"
DEC_TRIADS = "/n/groups/patel/IGLOO/UKB/HEAP/output/mr_edges/summary/DECODE/MRmotifs.tsv"
TIERED     = "/n/groups/patel/IGLOO/UKB/HEAP/output/mr_edges/summary/mr_tiered_edges.tsv"
# Resolved colocalization verdicts. mr_tiered_edges.tsv carries coloc_status
# "pending", which is a WORK QUEUE MARKER, not a result -- aggregate_coloc.R
# exists precisely to "replace the 'pending' coloc_status with a verdict".
# Shipping "pending" would read as an unfinished analysis when the analysis is
# done; this joins the verdict instead. Colocalization applies only to cis
# protein-origin edges, so every other row is legitimately "not_tested".
COLOC      = "/n/groups/patel/IGLOO/UKB/HEAP/output/support/coloc/coloc_results.tsv"

# suffix in the wide table -> (direction, edge_class, edge_dir in mr_tiered_edges)
EDGE = [
    # "polygenic" is the source table's word; it reads as "polygenic score",
    # which these are not. Renamed to "genome-wide" at the boundary, because
    # that names the real distinction between the three classes -- where the
    # variants come from, not how many there are:
    #   cis          variants at the protein's own locus
    #   trans        variants elsewhere in the genome, for the protein
    #   genome-wide  variants for a NON-protein trait (an exposure or a disease)
    # `trans` is also multi-variant (median 9), so a count-based name would not
    # have separated them. instrument_type says which trait supplies them.
    ("EP",      "E_to_P",       "genome-wide", "E_to_P"),
    ("PDcis",   "P_to_D",       "cis",           "Pcis_to_D"),
    ("PDtrans", "P_to_D",       "trans",         "Ptrans_to_D"),
    ("ED",      "E_to_D",       "genome-wide", "E_to_D"),
    ("PEcis",   "P_to_E",       "cis",           "Pcis_to_E"),
    ("PEtrans", "P_to_E",       "trans",         "Ptrans_to_E"),
    ("DP",      "D_to_P",       "genome-wide", "D_to_P"),
    ("DE",      "D_to_E",       "genome-wide", "D_to_E"),
]
# lane: what role the protein plays, which is what makes the platform meaningful
LANE = {"E_to_P": "protein_outcome", "D_to_P": "protein_outcome",
        "P_to_D": "pQTL", "P_to_E": "pQTL",
        "E_to_D": "protein_free", "D_to_E": "protein_free"}
PLATFORM = {"UKB": "Olink", "deCODE": "SomaScan"}


def sources(direction, panel):
    """Explicit instrument and outcome sample for a direction under a panel."""
    plat = PLATFORM[panel]
    prot = f"{'UK Biobank' if panel == 'UKB' else 'deCODE'} {plat}"
    ex, dz = "UK Biobank exposure GWAS", "FinnGen R12"
    return {
        "E_to_P": (ex, prot), "D_to_P": (dz, prot),
        "P_to_D": (f"{prot} pQTL", dz), "P_to_E": (f"{prot} pQTL", ex),
        "E_to_D": (ex, dz), "D_to_E": (dz, ex),
    }[direction]


def num(x):
    try:
        v = float(x)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


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
    ap.add_argument("--limit", type=int, default=0, help="prototype on N triads")
    args = ap.parse_args()

    # per-edge tier / instrument count / colocalization, keyed for lookup
    tier = {}
    with open(TIERED) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            panel = "UKB" if r["dataset"] == "UKB" else "deCODE"
            tier[(panel, r["edge_dir"], r["src_id"], r["tgt_id"])] = r
    print(f"  tiered edges indexed: {len(tier):,}")

    coloc = {}
    if os.path.exists(COLOC):
        with open(COLOC) as f:
            for r in csv.DictReader(f, delimiter="\t"):
                panel = "UKB" if r["arm"] == "UKB" else "deCODE"
                coloc[(panel, r["edge_dir"], r["protID"], r["target"])] = r
        print(f"  coloc verdicts indexed: {len(coloc):,}")
    else:
        print("  WARNING: no coloc_results.tsv; coloc columns will be blank", file=sys.stderr)

    wide = {}
    for panel, path in (("UKB", UKB_TRIADS), ("deCODE", DEC_TRIADS)):
        with open(path) as f:
            for r in csv.DictReader(f, delimiter="\t"):
                wide[(panel, r["Exposure"], r["Protein"], r["Disease"])] = r
    print(f"  wide triad rows indexed: {len(wide):,}")

    # A triad-level long table necessarily REPEATS each edge: an E->P edge
    # appears once per disease paired with it. So mr_tiered_edges.tsv has 4,703
    # Tier-1 edges while this table has 41,608 Tier-1 ROWS -- the same evidence,
    # counted differently. edge_id makes the underlying edge addressable, so
    # "how many Tier-1 edges" is unique(edge_id) rather than a row count.
    cols = ["triad_id", "edge_id", "Exposure", "Exposure_category", "Protein", "Disease", "Disease_UKB", "ICD10",
            "motif", "direction", "lane", "edge_class", "instrument_type",
            "panel", "platform",
            "instrument_source", "outcome_source", "design",
            "beta", "se", "ci_lo", "ci_hi", "padj", "significant",
            "nsnp", "mr_tier", "mr_tier_final", "tier_reason",
            "het_status", "replicated_across_panels",
            "coloc_verdict", "coloc_PP_H3", "coloc_PP_H4", "coloc_lead_snp"]

    out = args.out or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                   "build", "derived", "supp_mr_triads_long.tsv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    n = 0
    with open(UKB_TRIADS) as f, open(out, "w", newline="") as g:
        w = csv.DictWriter(g, fieldnames=cols, delimiter="\t", extrasaction="ignore")
        w.writeheader()
        for t, base in enumerate(csv.DictReader(f, delimiter="\t")):
            if args.limit and t >= args.limit:
                break
            E, P, D = base["Exposure"], base["Protein"], base["Disease"]
            for suf, direction, cls, tdir in EDGE:
                lane = LANE[direction]
                panels = ["UKB"] if lane == "protein_free" else ["UKB", "deCODE"]
                for panel in panels:
                    src = wide.get((panel, E, P, D))
                    if src is None:
                        continue
                    b, se = num(src.get(f"beta_{suf}")), num(src.get(f"se_{suf}"))
                    q = num(src.get(f"padj_{suf}"))
                    if b is None:
                        continue
                    ins, outp = sources(direction, panel)
                    panel_label = "both" if lane == "protein_free" else panel
                    # split-sample only when BOTH sides are UK Biobank
                    design = "split_sample" if ("UK Biobank" in ins and "UK Biobank" in outp) else "two_cohort"
                    src_id, tgt_id = ({"E_to_P": (E, P), "P_to_D": (P, D), "E_to_D": (E, D),
                                       "P_to_E": (P, E), "D_to_P": (D, P), "D_to_E": (D, E)})[direction]
                    te = tier.get((panel, tdir, src_id, tgt_id), {})
                    # PP.H4 >= 0.8 is the hard gate (aggregate_coloc.R); PP.H3 >= 0.8
                    # means two distinct variants in LD, i.e. the MR edge is an artifact.
                    cr = coloc.get((panel, tdir, P, tgt_id), {})
                    h3, h4 = num(cr.get("PP.H3")), num(cr.get("PP.H4"))
                    if h4 is None:
                        verdict = "not_tested" if cls != "cis" or lane != "pQTL" else "not_available"
                    elif h4 >= 0.8:
                        verdict = "colocalized"
                    elif h3 is not None and h3 >= 0.8:
                        verdict = "distinct_variants"
                    else:
                        verdict = "ambiguous"
                    # "polygenic" is the source table's word for a multi-SNP GWAS
                    # instrument; it reads as "polygenic score", which these are not.
                    # edge_class keeps the raw value for traceability; instrument_type
                    # says what actually supplies the instrument.
                    itype = ({"cis": "cis-pQTL", "trans": "trans-pQTL"}.get(cls)
                             or ("exposure GWAS" if direction.startswith("E_")
                                 else "disease GWAS"))
                    w.writerow({
                        "triad_id": f"{E}|{P}|{D}",
                        "edge_id": f"{panel}:{direction}:{cls}:{src_id}:{tgt_id}",
                        "instrument_type": itype,
                        "Exposure": E, "Exposure_category": base.get("Exposure category", ""),
                        "Protein": P, "Disease": D,
                        "Disease_UKB": base.get("Disease_UKB", ""), "ICD10": base.get("ICD10", ""),
                        "motif": base.get("motif", ""), "direction": direction, "lane": lane,
                        "edge_class": cls, "panel": panel_label,
                        "platform": "" if lane == "protein_free" else PLATFORM[panel],
                        "instrument_source": ins, "outcome_source": outp, "design": design,
                        "beta": f"{b:.6g}", "se": "" if se is None else f"{se:.6g}",
                        "ci_lo": "" if se is None else f"{b - 1.96 * se:.6g}",
                        "ci_hi": "" if se is None else f"{b + 1.96 * se:.6g}",
                        "padj": "" if q is None else f"{q:.6g}",
                        "significant": "" if q is None else ("TRUE" if q < 0.05 else "FALSE"),
                        "nsnp": te.get("nsnp", ""), "mr_tier": te.get("mr_tier", ""),
                        "mr_tier_final": te.get("mr_tier_final", ""),
                        # why the edge landed on that rung, and the sensitivity
                        # provenance behind it -- the point of a transparency table
                        "tier_reason": te.get("tier_reason", ""),
                        "het_status": te.get("het_status", ""),
                        "replicated_across_panels": te.get("replicated", ""),
                        "coloc_verdict": verdict,
                        "coloc_PP_H3": "" if h3 is None else f"{h3:.4g}",
                        "coloc_PP_H4": "" if h4 is None else f"{h4:.4g}",
                        "coloc_lead_snp": cr.get("lead_snp", ""),
                    })
                    n += 1
    print(f"  rows written: {n:,}   columns: {len(cols)}")
    print(f"  -> {out}  ({os.path.getsize(out)/1048576:.1f} MB)")


if __name__ == "__main__":
    main()
