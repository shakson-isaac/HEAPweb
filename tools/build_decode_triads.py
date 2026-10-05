#!/usr/bin/env python3
"""deCODE corroboration of the protein-involving edges, per Tier-1 triad.

The site's triad DAG reads `mr_triad_motifs.tsv` -- the canonical Tier-1 table
the supplement's S_mr_triads sheet is built from, which is the UK Biobank pQTL
panel. The same triads were also run against the deCODE (SomaScan) panel, and
that output already exists at mr_edges/summary/DECODE/MRmotifs.tsv; it had
simply never been joined to the Tier-1 set.

Both panels use the same aggregation (build_mr_tables.R): the primary estimate
is IVW / Wald ratio, and p-values are BH-adjusted within edge_dir. So the two
columns are directly comparable -- no re-derivation, no new method choice.

This is a join of two published tables, emitted as a site payload. It creates
no new analysis: nothing is estimated here that was not already estimated.
"""
import argparse, csv, os, sys

UKB = "/n/groups/patel/shakson_ukb/HEAP/docs/manuscript_stats/module5/mr_triad_motifs.tsv"
DEC = "/n/groups/patel/IGLOO/UKB/HEAP/output/mr_edges/summary/DECODE/MRmotifs.tsv"
# deCODE is an alternative PROTEIN panel (SomaScan), so every edge with the
# protein at either end can be recomputed there:
#     protein as outcome   E->P, D->P
#     protein as exposure  P->D, P->E
#
# The two edges with no protein in them -- E->D and D->E -- come from the UKB /
# FinnGen GWAS and are identical across arms. The data confirms it: D->E is
# 4,719 edges in both, and the ASGR1 triad's E->D is +0.1990 +/- 0.0617 in both.
# They are excluded here because carrying a duplicate column would imply deCODE
# had something independent to say about them.
#
# So a deCODE triad still needs E->D / D->E from UKB / FinnGen to be a triad at
# all. deCODE corroborates the protein-involving edges; it does not classify.
# The motif stays UK Biobank-anchored, which is what the manuscript's Tier 1+
# rung already encodes.
EDGES = ["EP", "PDcis", "PDtrans", "PEcis", "PEtrans", "DP"]
KEY = ("Exposure", "Protein", "Disease")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ukb", default=UKB)
    ap.add_argument("--decode", default=DEC)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    want = set()
    with open(args.ukb) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            want.add(tuple(r[k] for k in KEY))
    print(f"  Tier-1 triads: {len(want):,}")

    # motif_label from the deCODE table is deliberately NOT carried through:
    # it cannot be a standalone classification (no E->P), so publishing it would
    # invite reading "Other (has hits)" as deCODE demoting a UKB motif-A triad.
    cols = list(KEY) + [f"{p}_{e}" for e in EDGES for p in ("beta", "se", "padj")]
    rows, seen = [], set()
    with open(args.decode) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            k = tuple(r[k_] for k_ in KEY)
            if k not in want or k in seen:
                continue
            seen.add(k)
            out = {c: r.get(c, "") for c in KEY}
            for e in EDGES:
                for p in ("beta", "se", "padj"):
                    out[f"{p}_{e}"] = r.get(f"{p}_{e}", "")
            rows.append(out)

    missing = len(want) - len(seen)
    print(f"  matched in deCODE: {len(rows):,}" + (f"   MISSING {missing:,}" if missing else "   (complete)"))

    out = args.out or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "build", "derived", "mr_triads_decode.tsv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter="\t", extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"  -> {out}")


if __name__ == "__main__":
    main()
