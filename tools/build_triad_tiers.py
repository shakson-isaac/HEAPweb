#!/usr/bin/env python3
"""Per-edge final MR tier for every Tier-1 triad, both pQTL panels.

The triad table carries only PRESENCE flags (pEP ... pDE), which are true for
Tier1 OR Tier1plus. That collapses the two, so the site could not show which
edges are Tier 1+ -- the rung defined as cis-anchored, colocalized AND
replicated across both panels. Since Tier 1+ is the strongest claim HEAP makes
about an edge, hiding it behind a boolean loses the most interesting thing.

This joins mr_tiered_edges.tsv (which has mr_tier_final for both panels) onto
the triads, one column per (edge, panel).
"""
import argparse, csv, os

UKB_TRIADS = "/n/groups/patel/shakson_ukb/HEAP/docs/manuscript_stats/module5/mr_triad_motifs.tsv"
TIERED = "/n/groups/patel/IGLOO/UKB/HEAP/output/mr_edges/summary/mr_tiered_edges.tsv"

# suffix -> (edge_dir in mr_tiered_edges, endpoints of that direction)
EDGE = {
    "EP": ("E_to_P", "E", "P"), "PDcis": ("Pcis_to_D", "P", "D"),
    "PDtrans": ("Ptrans_to_D", "P", "D"), "ED": ("E_to_D", "E", "D"),
    "PEcis": ("Pcis_to_E", "P", "E"), "PEtrans": ("Ptrans_to_E", "P", "E"),
    "DP": ("D_to_P", "D", "P"), "DE": ("D_to_E", "D", "E"),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    tier = {}
    with open(TIERED) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            panel = "UKB" if r["dataset"] == "UKB" else "DECODE"
            tier[(panel, r["edge_dir"], r["src_id"], r["tgt_id"])] = r["mr_tier_final"]
    print(f"  tiered edges indexed: {len(tier):,}")

    cols = ["Exposure", "Protein", "Disease"] + [
        f"tier_{suf}_{panel}" for suf in EDGE for panel in ("UKB", "DECODE")]
    out = args.out or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                   "build", "derived", "mr_triad_tiers.tsv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    n, plus = 0, 0
    with open(UKB_TRIADS) as f, open(out, "w", newline="") as g:
        w = csv.DictWriter(g, fieldnames=cols, delimiter="\t", extrasaction="ignore")
        w.writeheader()
        for r in csv.DictReader(f, delimiter="\t"):
            E, P, D = r["Exposure"], r["Protein"], r["Disease"]
            node = {"E": E, "P": P, "D": D}
            row = {"Exposure": E, "Protein": P, "Disease": D}
            for suf, (edir, a, b) in EDGE.items():
                for panel in ("UKB", "DECODE"):
                    v = tier.get((panel, edir, node[a], node[b]), "")
                    row[f"tier_{suf}_{panel}"] = v
                    if v == "Tier1plus":
                        plus += 1
            w.writerow(row)
            n += 1
    print(f"  triads: {n:,}   Tier1plus cells: {plus:,}")
    print(f"  -> {out}")


if __name__ == "__main__":
    main()
