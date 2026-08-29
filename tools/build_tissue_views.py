#!/usr/bin/env python3
"""The two entry points the enrichment page could not answer.

The page only ever answered "given an exposure, which tissues light up". A
reader arriving with a protein or a tissue in mind had nowhere to start. These
two tables invert it.

  mr/protein view   pick a PROTEIN -> its GTEx median expression across all 54
                    tissues, its tissue-specificity score, and its Human Protein
                    Atlas subcellular location.
  tissue view       pick a TISSUE -> which exposures enrich for it, and which
                    panel proteins are most specific to it.

Sources, all local -- no external API. GTEx is already on disk at v10, which is
the same GTEx the enrichment was computed against, so the site cannot drift from
the paper:
  gtex_protein_tissue_medians.tsv  built by HEAP/scripts/support/, 2,659 panel
                                   proteins x 54 tissues
  GTEX_tau_scores.csv              tau in [0,1]: 0 = uniform across tissues,
                                   1 = confined to one
  HPA/subcellular_location.tsv     where in the cell the protein sits
  tissue_enrichment.csv            per-exposure GTEx tissue GSEA
"""
import csv, os, sys
from collections import defaultdict

E = os.environ.get("HEAP_ENRICH",
                   "/n/groups/patel/IGLOO/UKB/HEAP/output/module4_enrichment")
HPA = "/n/groups/patel/IGLOO/UKB/HPA"
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")
Q = 0.05


def num(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def main():
    os.makedirs(OUTD, exist_ok=True)

    # ---- tau: tissue specificity, one row per gene ------------------------
    tau, maxexpr = {}, {}
    with open(os.path.join(E, "GTEX_tau_scores.csv")) as fh:
        for r in csv.DictReader(fh):
            g = r["Description"]
            t = num(r["tau_score"])
            if t is None:
                continue
            # A symbol can carry several Ensembl ids; keep the most expressed,
            # matching how the median table resolves duplicates.
            m = num(r["max_expr"]) or 0
            if g not in tau or m > maxexpr.get(g, -1):
                tau[g], maxexpr[g] = t, m

    # ---- HPA subcellular ---------------------------------------------------
    loc = {}
    f_hpa = os.path.join(HPA, "subcellular_location.tsv")
    if os.path.exists(f_hpa):
        with open(f_hpa) as fh:
            for r in csv.DictReader(fh, delimiter="\t"):
                g = r.get("Gene name")
                if not g:
                    continue
                loc[g] = (r.get("Main location", ""),
                          r.get("Additional location", ""),
                          r.get("Reliability", ""))

    # ---- protein x tissue, with the protein's own context ------------------
    rows = []
    per_gene = defaultdict(list)
    with open(os.path.join(E, "gtex_protein_tissue_medians.tsv")) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            v = num(r["median_tpm"])
            if v is None:
                continue
            per_gene[r["gene"]].append((r["tissue"], v, r["n_samples"]))

    n_tau = n_loc = 0
    for gene, tv in sorted(per_gene.items()):
        vals = [v for _, v, _ in tv]
        top = max(vals) if vals else 0
        main, extra, rel = loc.get(gene, ("", "", ""))
        if gene in tau:
            n_tau += 1
        if gene in loc:
            n_loc += 1
        for tissue, v, ns in sorted(tv):
            rows.append([
                gene, tissue, v, ns,
                # Share of the protein's own maximum, so a profile is readable
                # without knowing the absolute TPM scale of that protein.
                round(v / top, 4) if top > 0 else "",
                tau.get(gene, ""), main, extra, rel,
            ])

    with open(os.path.join(OUTD, "protein_tissue_profile.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["gene", "tissue", "median_tpm", "n_samples", "frac_of_max",
                    "tau", "hpa_main_location", "hpa_additional_location",
                    "hpa_reliability"])
        w.writerows(rows)

    # ---- tissue -> exposures that enrich for it ----------------------------
    te = []
    with open(os.path.join(E, "tissue_enrichment.csv")) as fh:
        for r in csv.DictReader(fh):
            q = num(r["p.adjust"])
            nes = num(r["NES"])
            if q is None or nes is None or q >= Q:
                continue
            te.append([r["Description"], r["cID"], round(nes, 4), q,
                       "up" if nes > 0 else "down", r["setSize"]])
    with open(os.path.join(OUTD, "tissue_exposures.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["tissue", "exposure", "nes", "q", "dir", "set_size"])
        w.writerows(sorted(te))

    print(f"  protein_tissue_profile.tsv  {len(rows):,} rows  "
          f"{len(per_gene)} proteins x 54 tissues")
    print(f"      with a tau score           {n_tau}/{len(per_gene)}")
    print(f"      with an HPA location       {n_loc}/{len(per_gene)}")
    print(f"  tissue_exposures.tsv        {len(te):,} significant pairs  "
          f"{len({t for t, *_ in te})} tissues x {len({e for _, e, *_ in te})} exposures")


if __name__ == "__main__":
    main()
