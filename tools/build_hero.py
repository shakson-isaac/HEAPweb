#!/usr/bin/env python3
"""Write meta/hero_causal.json.gz -- the three evidence layers the landing figure draws.

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

# Three directions, each at Tier 1, each answering a different question about a
# protein that tracks an exposure:
#
#   P -> D  the protein moves disease risk          a causal intermediate
#   D -> P  disease liability moves the protein     a disease reporter
#   E -> P  the exposure moves the protein          an exposome reporter
#
# These are not exclusive. Every P->D protein is also both kinds of reporter,
# and most reporters are both -- which is the point, and why the figure shows
# one layer at a time rather than three colors at once.
LAYERS = {
    # The causal layer is NOT read from the tier table. It is the colocalized
    # cis protein -> disease set, which is what \nCausalCore counts (eight) and
    # what the paper's narrative means by a putative causal intermediate.
    #
    # Reading it from mr_triad_tiers gave six, because that table only holds
    # COMPLETE exposure-protein-disease triads: ALCAM and SOST colocalize on a
    # protein -> disease edge but never pair with an exposure there, so they
    # were invisible. Six disagreed with the project's own published macro.
    # (2026-10-05)
    "disease_reporter": ("tier_DP_UKB", "tier_DP_DECODE"),
    "exposome_reporter": ("tier_EP_UKB", "tier_EP_DECODE"),
}
COLOC_MIN = 0.8
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
    coloc = read_section(args.out, "mr_coloc")
    arch = read_section(args.out, "geno_vs_expo_arch")

    missing = [c for cols in LAYERS.values() for c in cols if c not in tiers]
    if missing:
        raise SystemExit("build_hero: mr_triad_tiers is missing %s -- the tier "
                         "schema changed, so this derivation is stale"
                         % ", ".join(missing))

    # --- the causal set: colocalized cis protein -> disease -------------------
    # `protID` is the PROTEIN side; `target` is the disease. Reading `target`
    # for a protein symbol silently returns nothing, which is how the earlier
    # version concluded ALCAM had no colocalization.
    causal_best, causal_dis = {}, {}
    for i, prot in enumerate(coloc["protID"]):
        if coloc["edge_dir"][i] != "Pcis_to_D":
            continue
        if not str(coloc["status"][i]).startswith("Colocalized"):
            continue
        if float(coloc["PP.H4"][i]) < COLOC_MIN:
            continue
        causal_best[prot] = max(causal_best.get(prot, 0.0), float(coloc["PP.H4"][i]))
        causal_dis.setdefault(prot, set()).add(coloc["target"][i])

    best = {}        # layer -> protein -> 1 (Tier 1) or 2 (Tier 1+)
    diseases = {}    # unused for the causal layer; kept for the reporter layers
    for layer, cols in LAYERS.items():
        seen = best.setdefault(layer, {})
        for i, prot in enumerate(tiers["Protein"]):
            for col in cols:
                r = RANK.get(tiers[col][i], 0)
                if not r:
                    continue
                if r > seen.get(prot, 0):
                    seen[prot] = r
                if layer == "causal":
                    diseases.setdefault(prot, set()).add(tiers["Disease"][i])

    # Only call out a protein the figure actually draws, and carry its
    # coordinates so the page does not have to join two objects by hand.
    coord = {}
    for i, p in enumerate(arch["omic"]):
        g, e = arch.get("Genetic_plot", [])[i], arch.get("Exposome_plot", [])[i]
        if g is not None and e is not None:
            coord[p] = (g, e)

    # The causal layer is small enough to name on the figure, so it carries its
    # coordinates and tier. The two reporter layers run to ~500 proteins each and
    # are drawn as a wash, so they only need the names.
    # Whether each colocalized protein ALSO reaches Tier 1 on a cis P -> D edge
    # in the triad table. Six of the eight do; ALCAM and SOST have no rows there
    # at all, so this is recorded rather than assumed.
    cis_cols = ("tier_PDcis_UKB", "tier_PDcis_DECODE")
    tier1_cis = set()
    for i, prot in enumerate(tiers["Protein"]):
        if any(tiers[c][i] in ("Tier1", "Tier1plus") for c in cis_cols):
            tier1_cis.add(prot)

    rows = []
    for prot, pph4 in sorted(causal_best.items(), key=lambda kv: (-kv[1], kv[0])):
        if prot not in coord:
            continue
        g, e = coord[prot]
        rows.append(OrderedDict(
            protein=prot,
            pp_h4=round(pph4, 3),
            tier1_cis=prot in tier1_cis,
            n_diseases=len(causal_dis[prot]),
            genetic=g,
            exposomic=e,
        ))

    dropped = sorted(set(causal_best) - set(coord))
    obj = OrderedDict(
        version="v1",
        definition=("`proteins` is the causal core: cis-pQTL colocalized with "
                    "the disease signal at PP.H4 >= 0.8, either pQTL arm -- the "
                    "set \\nCausalCore counts. `tier1_cis` records whether each "
                    "also reaches Tier 1 on a cis P -> D edge. "
                    "`disease_reporter` and `exposome_reporter` are Tier-1 "
                    "D -> P and E -> P. The three overlap by design."),
        n_tier1_cis=sum(1 for r in rows if r["tier1_cis"]),
        proteins=rows,
        disease_reporters=sorted(set(best["disease_reporter"]) & set(coord)),
        exposome_reporters=sorted(set(best["exposome_reporter"]) & set(coord)),
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
    print(f"  [M] hero_causal        causal {len(rows)} "
          f"({obj['n_tier1_cis']} also Tier-1 cis), disease reporters "
          f"{len(obj['disease_reporters'])}, exposome reporters "
          f"{len(obj['exposome_reporters'])} -> {n/1024:.1f} KB")
    print("      causal: " + ", ".join(r["protein"] for r in rows))
    if dropped:
        print(f"      note: {len(dropped)} Tier-1 protein(s) absent from the "
              f"scatter and not drawn: {', '.join(dropped)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
