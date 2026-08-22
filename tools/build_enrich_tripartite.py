#!/usr/bin/env python3
"""Exposure -> biological program -> tissue, for every exposure.

The printed panel (Fig 2d; Fig 2b in the code) shows this tripartite for a
CURATED set of exemplar exposures -- HEAP_TRIPARTITE_EXEMPLARS picks one per
group with a clean direction, which is why exposure_program_edges.tsv holds 38
edges over 10 exposures. The underlying GSEA is not narrowed: pathway_enrichment
covers 114 exposures over all 112 pathways. This rebuilds the same edges for
every exposure so the reader can ask why the exemplars were the exemplars.

Edge semantics follow the figure caption exactly:
  exposure -> program   coloured by direction (up = increased, down = decreased),
                        weighted by the NUMBER OF ENRICHED PATHWAYS
  program  -> tissue    grey, weighted by the NUMBER OF SUPPORTING EXPOSURES

The program -> tissue backbone is taken as published rather than recomputed. It
is built from leading-edge protein overlap (>=3 shared genes, same NES sign) in
module2_program_tissue_edges.R, and that overlap needs HEAPgsea.qs, an R object
this pipeline cannot read. Recomputing it from the summary tables would be a
different quantity wearing the same name.
"""
import csv, os, sys
from collections import defaultdict

E = os.environ.get("HEAP_ENRICH",
                   "/n/groups/patel/IGLOO/UKB/HEAP/output/module4_enrichment")
PT = os.path.join(E, "program_tissue")
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")
Q = 0.05


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main():
    os.makedirs(OUTD, exist_ok=True)

    # pathway -> program cluster, the curated map the printed panel uses
    p2c = {}
    with open(os.path.join(PT, "cluster_membership.tsv")) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            p2c[r["Description"]] = r["clust"]

    # ---- exposure -> program --------------------------------------------
    agg = defaultdict(lambda: {"npath": 0, "up": 0, "dn": 0, "net": 0.0,
                               "paths": []})
    unmapped = set()
    with open(os.path.join(E, "pathway_enrichment.csv")) as fh:
        for r in csv.DictReader(fh):
            q = num(r["p.adjust"])
            nes = num(r["NES"])
            if q is None or nes is None or q >= Q:
                continue
            clust = p2c.get(r["Description"])
            if clust is None:
                unmapped.add(r["Description"])
                continue
            a = agg[(r["cID"], clust)]
            a["npath"] += 1
            a["net"] += nes
            a["up" if nes > 0 else "dn"] += 1
            a["paths"].append(r["Description"])

    with open(os.path.join(OUTD, "enrich_exposure_program.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["exposure", "program", "npath", "n_up", "n_dn",
                    "net_nes", "dir", "pathways"])
        for (exp, clust), a in sorted(agg.items()):
            w.writerow([exp, clust, a["npath"], a["up"], a["dn"],
                        round(a["net"], 4),
                        "up" if a["net"] > 0 else "down",
                        "; ".join(sorted(a["paths"]))])

    # ---- program -> tissue: taken as published ---------------------------
    prog_tissue = []
    with open(os.path.join(PT, "program_tissue_edges.tsv")) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            prog_tissue.append([r["clust"], r["organ"], r["n_exp"],
                                r["n_up"], r["n_dn"]])
    with open(os.path.join(OUTD, "enrich_program_tissue.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["program", "organ", "n_exp", "n_up", "n_dn"])
        w.writerows(prog_tissue)

    # ---- exposure -> tissue, so a selected exposure can light its own -----
    # The backbone above is global (how many exposures support each program ->
    # tissue link). This is the selected exposure's OWN tissue enrichment, which
    # is a different question and must not be conflated with it.
    et = []
    with open(os.path.join(E, "tissue_enrichment.csv")) as fh:
        for r in csv.DictReader(fh):
            q = num(r["p.adjust"])
            nes = num(r["NES"])
            if q is None or nes is None or q >= Q:
                continue
            et.append([r["cID"], r["Description"], round(nes, 4), q,
                       "up" if nes > 0 else "down", r["setSize"]])
    with open(os.path.join(OUTD, "enrich_exposure_tissue.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["exposure", "tissue", "nes", "q", "dir", "set_size"])
        w.writerows(et)

    exps = {e for e, _ in agg}
    progs = {c for _, c in agg}
    print(f"  enrich_exposure_program.tsv  {len(agg):,} edges  "
          f"{len(exps)} exposures x {len(progs)} programs")
    print(f"  enrich_program_tissue.tsv    {len(prog_tissue)} edges "
          f"(as published, leading-edge overlap)")
    print(f"  enrich_exposure_tissue.tsv   {len(et):,} significant exposure-tissue pairs")
    print(f"      exemplar panel covered 10 exposures; this covers {len(exps)}")
    if unmapped:
        print(f"  !! {len(unmapped)} pathway(s) had no program cluster: "
              f"{sorted(unmapped)[:3]}", file=sys.stderr)


if __name__ == "__main__":
    main()
