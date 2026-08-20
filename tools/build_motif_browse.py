#!/usr/bin/env python3
"""Derived tables for the MR page's explainer + entity browse layer.

Emits three website-only aggregates into build/derived:

  mr_motif_key.tsv      the A-E motif signature over the 6 numbered edges, plus
                        triad/protein counts -- the data behind main Fig 4b.
  mr_entity_motifs.tsv  per-entity motif counts: pick an exposure, protein or
                        disease and see how its triads distribute over motifs.
  mr_edge_key.tsv       the 6 numbered directed edges behind main Fig 4a, so the
                        DAG's numbering and the matrix's columns share a source.

Source of record for the triads is the R-built supplementary table
($HEAP_OUTPUT/mr_edges/summary/supp/mr_triads_wide.tsv, 18,780 motif-carrying
triads at the Tier-1 bar). These are presentation aggregates of it, not a second
derivation -- the motif assignment is read, never recomputed here.
"""
import csv, os, sys
from collections import defaultdict

HEAP_OUT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
WIDE = os.path.join(HEAP_OUT, "mr_edges", "summary", "supp", "mr_triads_wide.tsv")
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")

# The six directed edges, numbered as in main Fig 4a. The numbering is load-
# bearing: it is how the DAG and the motif matrix refer to the same edge.
EDGES = [
    ("1", "EP", "E_to_P", "Exposure", "Protein",  "exposure -> protein"),
    ("2", "PD", "P_to_D", "Protein",  "Disease",  "protein -> disease"),
    ("3", "ED", "E_to_D", "Exposure", "Disease",  "exposure -> disease"),
    ("4", "PE", "P_to_E", "Protein",  "Exposure", "protein -> exposure"),
    ("5", "DP", "D_to_P", "Disease",  "Protein",  "disease -> protein"),
    ("6", "DE", "D_to_E", "Disease",  "Exposure", "disease -> exposure"),
]

# Motif signatures, transcribed from the canonical rule in
# HEAP/scripts/visualizations/fig_mr_motif_overview.R:80-85 (and mirrored in
# summarize_mr_triads.R). "+" = edge required present, "-" = required ABSENT,
# "." = unconstrained. The negations are the whole point: motifs are recomputed
# at each evidence bar, never filtered down from a looser one, so counts are
# NOT monotonic as the bar rises.
MOTIFS = [
    ("A", "mediator",          "Mediator (E->P->D)",     "+", "+", "+", "-", "-", "-"),
    ("B", "biomarker",         "Biomarker",              "+", "-", "+", "-", "+", "-"),
    ("C", "exposure-marker",   "Exposure-marker",        "+", "-", "+", "-", "-", "."),
    ("D", "protein->exposure", "Reverse (P->E)",         "-", ".", ".", "+", ".", "."),
    ("E", "disease-liability", "Disease-liability (D->P)", ".", ".", ".", ".", "+", "+"),
]

def die(msg):
    sys.exit(f"build_motif_browse: {msg}")

def main():
    if not os.path.exists(WIDE):
        die(f"missing {WIDE}\n  build it with "
            "HEAP/scripts/analysis_summaries/build_mr_supp_tables.R")
    os.makedirs(OUTD, exist_ok=True)

    rows = []
    with open(WIDE) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            rows.append(r)
    if not rows:
        die("mr_triads_wide.tsv is empty")

    # --- motif key -----------------------------------------------------------
    # Counts come from the table, never from the hardcoded rule, so the matrix
    # cannot silently disagree with the triads it is meant to describe.
    by_motif_triads = defaultdict(int)
    by_motif_prot = defaultdict(set)
    for r in rows:
        m = (r["motif"] or "").strip()
        letter = m[:1]
        by_motif_triads[letter] += 1
        by_motif_prot[letter].add(r["Protein"])

    with open(os.path.join(OUTD, "mr_motif_key.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["motif", "name", "label", "sig_1_EP", "sig_2_PD", "sig_3_ED",
                    "sig_4_PE", "sig_5_DP", "sig_6_DE", "n_triads", "n_proteins"])
        for letter, name, label, *sig in MOTIFS:
            w.writerow([letter, name, label, *sig,
                        by_motif_triads.get(letter, 0),
                        len(by_motif_prot.get(letter, ()))])

    # --- edge key ------------------------------------------------------------
    with open(os.path.join(OUTD, "mr_edge_key.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["num", "code", "edge_dir", "from", "to", "label"])
        w.writerows(EDGES)

    # --- per-entity motif counts --------------------------------------------
    # One row per (entity, motif) plus an ALL row, so the browse layer can show
    # "this protein sits in N triads: 3 mediator, 40 disease-liability, ..."
    ent = defaultdict(lambda: defaultdict(lambda: {
        "triads": 0, "E": set(), "P": set(), "D": set()}))
    label_of, cat_of = {}, {}

    for r in rows:
        letter = (r["motif"] or " ")[:1]
        e, p, d = r["Exposure"], r["Protein"], r["Disease"]
        label_of[("exposure", e)] = e
        label_of[("protein", p)] = p
        label_of[("disease", d)] = d
        cat_of[("exposure", e)] = r.get("Exposure_category", "") or ""
        for key in (("exposure", e), ("protein", p), ("disease", d)):
            for m in (letter, "ALL"):
                slot = ent[key][m]
                slot["triads"] += 1
                slot["E"].add(e); slot["P"].add(p); slot["D"].add(d)

    with open(os.path.join(OUTD, "mr_entity_motifs.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["entity_type", "entity_id", "entity_label", "ecat", "motif",
                    "n_triads", "n_exposures", "n_proteins", "n_diseases"])
        for (etype, eid) in sorted(ent):
            for m in sorted(ent[(etype, eid)]):
                s = ent[(etype, eid)][m]
                w.writerow([etype, eid, label_of[(etype, eid)],
                            cat_of.get((etype, eid), ""), m, s["triads"],
                            len(s["E"]), len(s["P"]), len(s["D"])])

    n_ent = len(ent)
    print(f"  mr_motif_key.tsv      {len(MOTIFS)} motifs  "
          f"({sum(by_motif_triads.values()):,} triads)")
    print(f"  mr_edge_key.tsv       {len(EDGES)} directed edges")
    print(f"  mr_entity_motifs.tsv  {n_ent} entities")
    for t in ("exposure", "protein", "disease"):
        print(f"      {t:9s} {sum(1 for k in ent if k[0] == t)}")

if __name__ == "__main__":
    main()
