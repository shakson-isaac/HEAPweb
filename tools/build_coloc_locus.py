#!/usr/bin/env python3
"""Per-SNP regional data for the colocalization viewer.

A PP.H4 of 0.998 is a number, not evidence anyone can check. The regional plot
is the thing that shows WHY: the pQTL and the disease association rising and
falling over the same variants in the same window. This packs the harmonized
per-SNP table behind each coloc pair so the site can draw it.

Source is <locus>_harmonized_snps.tsv, written by
HEAP/scripts/support/coloc/run_coloc_locus.R:295 -- the exact variant set that
coloc.abf consumed, so the plot and the posterior cannot disagree.

COVERAGE: only loci whose harmonized table was retained are packed. At the time
of writing that is 1 of 65 pairs; the rest ran before the output was kept, and a
rerun of run_coloc_locus.R across the manifest lights them up with no change
here or in the frontend. Loci without per-SNP data are reported, not silently
dropped -- the viewer greys them rather than pretending they do not exist.

Deliberately NOT sourced from an external API (FinnGen, Open Targets). Those
would serve a different variant set with different QC than the one that produced
our PP.H4, and a reader comparing the plot to the posterior would see a
disagreement we could not explain. LD colouring is the exception and is fetched
client-side, because we never computed LD at all.
"""
import csv, glob, json, os, re, sys

HEAP_OUT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
COLOC = os.path.join(HEAP_OUT, "support", "coloc")
FIG = "/n/groups/patel/IGLOO/UKB/HEAP/figures/website/fig_mr_coloc.json"
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")

# Thin far-from-lead noise: everything at p > 0.1 on BOTH tracks is visually
# identical baseline. Keeps the shard small without touching anything a reader
# would look at.
KEEP_MLOG = 1.0

def num(v):
    try:
        f = float(v)
        return f if f == f else None          # drop NaN
    except (TypeError, ValueError):
        return None

def main():
    os.makedirs(OUTD, exist_ok=True)
    if not os.path.exists(FIG):
        sys.exit(f"build_coloc_locus: missing {FIG}")

    with open(FIG) as fh:
        summ = json.load(fh)
    summ = summ if isinstance(summ, list) else summ.get("data", summ)

    files = sorted(glob.glob(os.path.join(COLOC, "*_harmonized_snps.tsv")))
    # <lead>_<protein>_<diseasetail>_harmonized_snps.tsv
    by_pair = {}
    for f in files:
        stem = os.path.basename(f)[: -len("_harmonized_snps.tsv")]
        m = re.match(r"^(rs\d+)_([A-Za-z0-9_.-]+?)_([A-Z0-9_]+)$", stem)
        if not m:
            print(f"  ?? unparsed locus stem: {stem}", file=sys.stderr)
            continue
        lead, prot, dz = m.groups()
        by_pair[(prot, dz)] = (f, lead)

    rows_out, keys = [], []
    n_have = 0
    for r in summ:
        prot, tgt = r["protID"], r["target"]
        tail = re.sub(r"^finngen_R12_", "", tgt)
        # Arm matters. The legacy-named files (<lead>_<prot>_<disease>) come
        # from the UK Biobank Olink pipeline; deCODE instruments a different
        # variant set entirely, so serving one arm's SNPs under the other's
        # label would misstate what was colocalized.
        hit = by_pair.get((prot, tail)) if r["arm"] == "UKB" else None
        locus_id = f"{r['arm']}__{prot}__{tgt}"
        if hit is None:
            continue
        path, lead = hit
        n_have += 1
        with open(path) as fh:
            for s in csv.DictReader(fh, delimiter="\t"):
                m1 = num(s.get("minus_log10_pval"))     # pQTL track
                m2 = num(s.get("mlogp"))                # disease track
                pos = num(s.get("pos.1"))
                if pos is None or (m1 is None and m2 is None):
                    continue
                if max(m1 or 0, m2 or 0) < KEEP_MLOG:
                    continue
                rows_out.append([
                    locus_id, s["SNP"], s.get("chr.1", ""), int(pos),
                    "" if m1 is None else round(m1, 4),
                    "" if m2 is None else round(m2, 4),
                    num(s.get("beta.1")) or "", num(s.get("beta.2")) or "",
                    "TRUE" if s["SNP"] == lead else "FALSE",
                ])
        keys.append(locus_id)

    with open(os.path.join(OUTD, "mr_coloc_locus.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["locus_id", "snp", "chr", "pos", "mlog10p_pqtl",
                    "mlog10p_disease", "beta_pqtl", "beta_disease", "is_lead"])
        w.writerows(rows_out)

    print(f"  mr_coloc_locus.tsv  {len(rows_out):,} SNPs across {n_have} locus/loci")
    print(f"      coloc pairs in summary : {len(summ)}")
    print(f"      with per-SNP data      : {n_have}")
    print(f"      awaiting rerun         : {len(summ) - n_have}")
    if n_have < len(summ):
        print("      -> rerun HEAP/scripts/support/coloc/run_coloc_locus.R over "
              "coloc_manifest.tsv to retain the rest")

if __name__ == "__main__":
    main()
