#!/usr/bin/env python3
"""Per-locus regional data for the colocalization viewer.

A PP.H4 of 0.998 is a number, not evidence anyone can check. The regional plot
shows why: the cis-pQTL and the disease association rising over the same
variants, coloured by LD to the lead. The LD is what separates one shared causal
variant (PP.H4) from two distinct variants in LD (PP.H3), so it is the part that
carries the argument -- and it cannot be computed in the browser.

Sources, both written by HEAP/scripts/support/coloc/export_coloc_web.R:
  <locus>_plot_table.tsv   snp, chr, pos, p_trait1, p_trait2, r2
  <locus>_genes.tsv        gene, start, end, strand

r2 comes from PLINK against the 1000G EUR panel, the same call
ModuleMR/COLOC/LocusZoom.R makes for the print figure, so the site and the
figure colour identically.

Deliberately NOT sourced from an external API (FinnGen, Open Targets): those
serve a different variant set with different QC than the one that produced our
posterior, and a reader comparing the plot to PP.H4 would see a disagreement we
could not explain.

Loci whose harmonized table was never retained are reported, not silently
dropped -- the viewer greys them rather than pretending they do not exist.
"""
import csv, glob, json, os, re, sys

HEAP_OUT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
WEB = os.path.join(HEAP_OUT, "support", "coloc", "web")
FIG = "/n/groups/patel/IGLOO/UKB/HEAP/figures/website/fig_mr_coloc.json"
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")

# Thin variants that are baseline on BOTH tracks. They are visually identical
# and dominate the row count; anything a reader would look at is kept.
KEEP_MLOG = 1.0


def mlog(p):
    """-log10(p), guarding p=0 (which appears for very strong pQTLs)."""
    try:
        v = float(p)
    except (TypeError, ValueError):
        return None
    if v != v:
        return None
    if v <= 0:
        return 320.0                      # below double precision; effectively infinite
    import math
    return round(-math.log10(v), 4)


def main():
    if not os.path.exists(FIG):
        sys.exit(f"build_coloc_locus: missing {FIG}")
    os.makedirs(OUTD, exist_ok=True)

    with open(FIG) as fh:
        summ = json.load(fh)
    summ = summ if isinstance(summ, list) else summ.get("data", summ)

    # Index the exported loci by both naming schemes:
    #   <arm>__<protein>__<disease>          current runner (arm explicit)
    #   <lead>_<protein>_<disease-tail>      legacy flat outputs
    by_id, by_pair = {}, {}
    for f in sorted(glob.glob(os.path.join(WEB, "*_plot_table.tsv"))):
        stem = os.path.basename(f)[: -len("_plot_table.tsv")]
        if "__" in stem:
            by_id[stem] = stem
            continue
        m = re.match(r"^(rs\d+)_([A-Za-z0-9_.-]+?)_([A-Z0-9_]+)$", stem)
        if m:
            _, prot, dz = m.groups()
            by_pair[(prot, dz)] = stem
        else:
            print(f"  ?? unparsed locus stem: {stem}", file=sys.stderr)

    snp_rows, gene_rows, meta_rows, packed = [], [], [], 0
    for r in summ:
        prot, tgt, arm = r["protID"], r["target"], r["arm"]
        locus_id = f"{arm}__{prot}__{tgt}"
        stem = by_id.get(locus_id)
        if stem is None and arm == "UKB":
            # Legacy files came from the UK Biobank Olink pipeline. deCODE
            # instruments a different variant set, so serving one arm's SNPs
            # under the other's label would misstate what was colocalized.
            stem = by_pair.get((prot, re.sub(r"^finngen_R12_", "", tgt)))
        if stem is None:
            continue

        with open(os.path.join(WEB, f"{stem}_plot_table.tsv")) as fh:
            for s in csv.DictReader(fh, delimiter="\t"):
                m1, m2 = mlog(s["p_trait1"]), mlog(s["p_trait2"])
                if m1 is None and m2 is None:
                    continue
                if max(m1 or 0, m2 or 0) < KEEP_MLOG:
                    continue
                try:
                    r2 = round(float(s["r2"]), 4)
                except (TypeError, ValueError):
                    r2 = ""
                snp_rows.append([locus_id, s["snp"], s["chr"], int(s["pos"]),
                                 "" if m1 is None else m1,
                                 "" if m2 is None else m2, r2])

        # Anchor provenance. r2 is to the lead variant unless the lead is
        # absent from the 1000G panel, in which case the export anchors on the
        # strongest in-panel variant instead. The viewer must say which, or the
        # colours quietly mean something other than what a reader assumes.
        mf = os.path.join(WEB, f"{stem}_meta.tsv")
        if os.path.exists(mf):
            with open(mf) as fh:
                for mrow in csv.DictReader(fh, delimiter="\t"):
                    meta_rows.append([
                        locus_id, mrow.get("lead", ""), mrow.get("anchor", ""),
                        mrow.get("anchor_is_lead", ""), mrow.get("n_variants", ""),
                        mrow.get("chr", ""),
                    ])
                    break

        gf = os.path.join(WEB, f"{stem}_genes.tsv")
        if os.path.exists(gf):
            with open(gf) as fh:
                for g in csv.DictReader(fh, delimiter="\t"):
                    gene_rows.append([locus_id, g["gene"], int(g["start"]),
                                      int(g["end"]), g["strand"]])
        packed += 1

    with open(os.path.join(OUTD, "mr_coloc_locus.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["locus_id", "snp", "chr", "pos", "mlog10p_pqtl",
                    "mlog10p_disease", "r2"])
        w.writerows(snp_rows)

    with open(os.path.join(OUTD, "mr_coloc_genes.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["locus_id", "gene", "start", "end", "strand"])
        w.writerows(gene_rows)

    with open(os.path.join(OUTD, "mr_coloc_locus_meta.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["locus_id", "lead", "anchor", "anchor_is_lead", "n_variants", "chr"])
        w.writerows(meta_rows)

    n_proxy = sum(1 for r in meta_rows if r[3] not in ("TRUE", "True", "1"))
    print(f"  mr_coloc_locus.tsv  {len(snp_rows):,} variants across {packed} locus/loci")
    print(f"  mr_coloc_locus_meta.tsv  {len(meta_rows)} loci "
          f"({n_proxy} LD-anchored on a proxy, lead absent from the panel)")
    print(f"  mr_coloc_genes.tsv  {len(gene_rows):,} genes")
    print(f"      coloc pairs in summary : {len(summ)}")
    print(f"      with a regional view   : {packed}")
    print(f"      awaiting the rerun     : {len(summ) - packed}")
    if packed < len(summ):
        print("      -> bash slurm/coloc/HEAPcoloc_locus.sh, then "
              "Rscript scripts/support/coloc/export_coloc_web.R")


if __name__ == "__main__":
    main()
