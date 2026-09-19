#!/usr/bin/env python3
"""Per-protein Olink <-> SomaScan concordance, as a site payload.

HEAP instruments proteins from two pQTL sources measured on two different
platforms: UK Biobank (Olink) and deCODE (SomaScan). When an edge replicates in
one panel and not the other, the first question is whether the two platforms
even measure that protein the same way.

The correlations come from Eldjarn et al., Nature 2023 (the deCODE paper) and
are integrated into HEAP's intervention comparison, per methods.tex:160:

  "We integrated correlations between SomaScan and Olink platforms for proteins
   described in Eldjarn et al., 2023 to reference potential transferability."

They ride along in fig_intervention_scatter as `olink_soma_r`; this pulls them
out keyed by protein so any page can show the transferability of a protein
before showing a cross-panel comparison of it.

Nothing is estimated here.
"""
import argparse, csv, json, os, statistics

SRC = "/n/groups/patel/IGLOO/UKB/HEAP/figures/website/fig_intervention_scatter.json"
CITATION = ("Eldjarn et al., Nature 2023 (deCODE); integrated per HEAP "
            "Online Methods, intervention comparison")


def band(r):
    """Plain-language transferability, so a bare r is not left to interpretation."""
    if r >= 0.8:
        return "high"
    if r >= 0.5:
        return "moderate"
    return "low"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=SRC)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    seen = {}
    with open(args.source) as f:
        for rec in json.load(f):
            p, r = rec.get("protein"), rec.get("olink_soma_r")
            if not p or r in (None, ""):
                continue
            try:
                seen[p] = float(r)
            except (TypeError, ValueError):
                continue

    vals = sorted(seen.values())
    print(f"  proteins with a platform correlation: {len(seen):,}")
    if vals:
        print(f"  median r = {statistics.median(vals):.3f}  "
              f"[{vals[0]:.3f}, {vals[-1]:.3f}]")
        lo = sum(1 for v in vals if v < 0.5)
        print(f"  low transferability (r < 0.5): {lo:,} "
              f"({100*lo/len(vals):.0f}%)")

    out = args.out or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "build", "derived", "platform_concordance.tsv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(["protein", "olink_soma_r", "transferability", "source"])
        for p in sorted(seen):
            w.writerow([p, f"{seen[p]:.4f}", band(seen[p]), CITATION])
    print(f"  -> {out}")


if __name__ == "__main__":
    main()
