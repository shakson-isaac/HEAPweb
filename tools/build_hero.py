#!/usr/bin/env python3
"""Write meta/hero_causal.json.gz -- the proteins the landing figure calls out.

The landing scatter places all 2,686 proteins by genetic against exposomic R².
That shows half the paper's claim: the exposome is written across the proteome.
The other half -- that almost none of it is causal -- needs the small set of
proteins carrying Tier-1 Mendelian randomization evidence INTO disease, so the
figure can name them against the cloud.

WHY THIS IS ITS OWN OBJECT. The tier table (s/mr_triad_tiers.json.gz) is 20,064
rows and 71 KB gzipped. The landing page is the first paint of the site and
already fetches the scatter; it is not going to pull the whole MR tier table to
find six protein names. This writes ~1 KB instead.

WHAT "CAUSAL" MEANS HERE, EXACTLY. A protein is included when at least one of
its protein -> disease edges reaches Tier 1 in either pQTL arm, cis or trans:
the tier_PDcis_* and tier_PDtrans_* columns. That is NOT the same quantity as
the manuscript's mediator-motif count (\\nMotifTierOne, six triads across three
proteins), which additionally requires the other five edges of the motif to take
particular values. Both are real; they answer different questions. The figure
labels this one as "Tier-1 evidence on disease" and must not be captioned as the
mediator motif.

Run AFTER the payload sections exist -- it reads one of them:
    python3 tools/build_payload.py ...      # writes s/mr_triad_tiers.json.gz
    python3 tools/build_hero.py
"""
import argparse
import gzip
import json
import os
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Protein -> disease, both instrument classes, both pQTL arms.
PD_COLS = (
    "tier_PDcis_UKB", "tier_PDcis_DECODE",
    "tier_PDtrans_UKB", "tier_PDtrans_DECODE",
)
RANK = {"Tier1plus": 2, "Tier1": 1}


def read_section(out, name):
    for cand in (f"s/{name}.json.gz", f"s/{name}.json"):
        path = os.path.join(out, cand)
        if os.path.exists(path):
            op = gzip.open if path.endswith(".gz") else open
            with op(path, "rt", encoding="utf-8") as fh:
                return json.load(fh)
    raise SystemExit(f"build_hero: {name} not found under {out}/s -- "
                     "build the payload sections first")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "build", "web", "v1"))
    ap.add_argument("--no-gzip", action="store_true")
    args = ap.parse_args()

    tiers = read_section(args.out, "mr_triad_tiers")
    arch = read_section(args.out, "geno_vs_expo_arch")

    missing = [c for c in PD_COLS if c not in tiers]
    if missing:
        raise SystemExit("build_hero: mr_triad_tiers is missing %s -- the tier "
                         "schema changed, so this derivation is stale"
                         % ", ".join(missing))

    best = {}        # protein -> 1 (Tier 1) or 2 (Tier 1+)
    diseases = {}    # protein -> set of diseases it reaches at Tier 1
    for i, prot in enumerate(tiers["Protein"]):
        for col in PD_COLS:
            r = RANK.get(tiers[col][i], 0)
            if not r:
                continue
            if r > best.get(prot, 0):
                best[prot] = r
            diseases.setdefault(prot, set()).add(tiers["Disease"][i])

    # Only call out a protein the figure actually draws, and carry its
    # coordinates so the page does not have to join two objects by hand.
    coord = {}
    for i, p in enumerate(arch["omic"]):
        g, e = arch.get("Genetic_plot", [])[i], arch.get("Exposome_plot", [])[i]
        if g is not None and e is not None:
            coord[p] = (g, e)

    rows = []
    for prot, rank in sorted(best.items(), key=lambda kv: (-kv[1], kv[0])):
        if prot not in coord:
            continue
        g, e = coord[prot]
        rows.append(OrderedDict(
            protein=prot,
            tier="Tier1plus" if rank == 2 else "Tier1",
            n_diseases=len(diseases[prot]),
            genetic=g,
            exposomic=e,
        ))

    dropped = sorted(set(best) - set(coord))
    obj = OrderedDict(
        version="v1",
        definition=("proteins with at least one protein -> disease MR edge at "
                    "Tier 1, in either pQTL arm, cis or trans. Not the mediator "
                    "motif count."),
        n_tier1=sum(1 for r in rows if r["tier"] == "Tier1"),
        n_tier1plus=sum(1 for r in rows if r["tier"] == "Tier1plus"),
        proteins=rows,
    )

    os.makedirs(os.path.join(args.out, "meta"), exist_ok=True)
    name = "meta/hero_causal.json" + ("" if args.no_gzip else ".gz")
    path = os.path.join(args.out, name)
    raw = json.dumps(obj, separators=(",", ":")).encode()
    if args.no_gzip:
        with open(path, "wb") as fh:
            fh.write(raw)
    else:
        with gzip.open(path, "wb", compresslevel=9) as fh:
            fh.write(raw)

    n = os.path.getsize(path)
    print(f"  [M] hero_causal        {len(rows)} proteins "
          f"({obj['n_tier1plus']} at Tier 1+) -> {n/1024:.1f} KB")
    print("      " + ", ".join(r["protein"] for r in rows))
    if dropped:
        print(f"      note: {len(dropped)} Tier-1 protein(s) absent from the "
              f"scatter and not drawn: {', '.join(dropped)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
