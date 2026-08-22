#!/usr/bin/env python3
"""Exposure-first: what does this exposure touch, and which proteins carry it.

The enrichment page has only ever answered exposure -> tissue as a heatmap cell.
This shards the same question by exposure so a body map can light the tissues,
and adds the step that was missing: for each (exposure, tissue) the EXACT
proteins that drove the enrichment.

That last part is the leading edge from the GSEA (`core_enrichment`), extracted
by HEAP/scripts/support/export_gsea_leading_edge.R. It is deliberately not the
obvious substitute -- the exposure's associated proteins intersected with the
tissue's gene set -- because that ignores rank and sweeps in proteins that sat
below the enrichment peak and contributed nothing to it.
"""
import csv, os, sys
from collections import defaultdict

E = os.environ.get("HEAP_ENRICH",
                   "/n/groups/patel/IGLOO/UKB/HEAP/output/module4_enrichment")
LE = os.path.join(E, "gsea_leading_edge.tsv")
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
    if not os.path.exists(LE):
        sys.exit(f"build_bodymap: missing {LE}\n  run "
                 "HEAP/scripts/support/export_gsea_leading_edge.R first")
    os.makedirs(OUTD, exist_ok=True)

    # ---- leading edge, sharded by exposure --------------------------------
    rows, per_term = [], defaultdict(int)
    with open(LE) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            q = num(r["p.adjust"])
            nes = num(r["NES"])
            if q is None or nes is None or q >= Q:
                continue
            rows.append([
                r["exposure"], r["kind"], r["term"], r["term_label"], r["gene"],
                round(nes, 4), q, "up" if nes > 0 else "down", r["setSize"],
            ])
            per_term[(r["exposure"], r["kind"], r["term"])] += 1

    with open(os.path.join(OUTD, "bodymap_leading_edge.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["exposure", "kind", "term", "term_label", "gene",
                    "nes", "q", "dir", "set_size"])
        w.writerows(rows)

    # ---- one row per (exposure, term): what the body map paints ------------
    seen = {}
    for exp, kind, term, label, gene, nes, q, d, ss in rows:
        seen.setdefault((exp, kind, term), [label, nes, q, d, ss])
    summ = []
    for (exp, kind, term), (label, nes, q, d, ss) in sorted(seen.items()):
        summ.append([exp, kind, term, label, nes, q, d, ss,
                     per_term[(exp, kind, term)]])
    with open(os.path.join(OUTD, "bodymap_terms.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(["exposure", "kind", "term", "term_label", "nes", "q", "dir",
                    "set_size", "n_leading_edge"])
        w.writerows(summ)

    exps = {r[0] for r in rows}
    tis = {r[2] for r in rows if r[1] == "tissue"}
    pat = {r[2] for r in rows if r[1] == "pathway"}
    genes = {r[4] for r in rows}
    print(f"  bodymap_leading_edge.tsv  {len(rows):,} rows  "
          f"{len(exps)} exposures, {len(genes):,} proteins")
    print(f"  bodymap_terms.tsv         {len(summ):,} (exposure, term) pairs")
    print(f"      tissues {len(tis)}   pathways {len(pat)}")
    n = len(rows) / max(1, len(exps))
    print(f"      ~{n:.0f} leading-edge rows per exposure shard")


if __name__ == "__main__":
    main()
