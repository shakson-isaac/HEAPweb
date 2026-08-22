#!/usr/bin/env python3
"""The Figure 5d "shared language" network, for ANY disease the reader picks.

WHAT THE PRINT FIGURE DOES, AND WHY IT CANNOT BE SHIPPED AS-IS
  scripts/support/build_shared_language_network.R:48-54 hardcodes the network
  to cardiometabolic disease: four disease regexes (T2D, obesity, lipid
  disorder, hypertension) and four curated exposure exemplars (strenuous
  sports, processed meat, walking pace, current smoking). That yields exactly
  28 nodes and 122 edges. Every other disease in the analysis is invisible.

  The underlying evidence is not narrow at all -- intervention_mr_edges.tsv is
  already disease-resolved, 71,338 rows covering 44 diseases. So this ships the
  INGREDIENTS per disease and lets the browser assemble the network, instead of
  baking one network per disease. Adding a disease later needs no rebuild here.

VOCABULARY IS THE PRINT FIGURE'S, deliberately
  Node columns  id, kind, label, class, breadth, R2_E   (+ the shard's disease)
  Edge columns  from, to, etype, tier, sign, weight     (+ the shard's disease)
  kind   exp_obs | exp_rct | protein | disease
  etype  obs | interv | gen_fwd | gen_rev
  so the interactive network and the printed one describe themselves the same
  way and a reader moving between them is not learning a second language.

  ONE VALUE IS NEW. The print figure's `class` is binary, causal | reporter,
  because its four diseases happened to produce only those two. Across all 44
  diseases a third case exists: a protein with a forward protein->disease edge
  that does NOT clear the Tier-1 cis gate (trans-instrumented, or cis demoted
  to Tier2 by LD confounding). Calling that "causal" would smuggle the 47
  LD-confounded cis edges the manuscript demoted back into the causal set;
  calling it "reporter" would be simply wrong about the direction. It is
  emitted as class="forward", and the browser can render it as the hedge it is.

EDGE SOURCES, and why two tables rather than one
  gen_rev (disease -> protein, the reporter edges) come from
    intervention_mr_edges.tsv, collapsed over exposures.
  gen_fwd (protein -> disease, the causal edges) come from the SAME file for
    which pairs exist, but their tier and colocalization come from
    mr_pd_tiered.tsv -- the canonical Fig-4 tier table. The edge file knows an
    edge is significant; only the tier table knows whether it is Tier-1 cis and
    whether coloc cleared PP.H4 >= 0.8. Reading tiers off significance alone is
    the mistake that would inflate the causal count.

Output -> build/derived/
  intervention_network_nodes.tsv   tier K, sharded on disease
  intervention_network_edges.tsv   tier K, sharded on disease
"""
import csv
import json
import math
import os
import re
import sys
from collections import defaultdict

OUT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
WEBSITE = os.environ.get("HEAP_WEBSITE_DIR",
                         "/n/groups/patel/IGLOO/UKB/HEAP/figures/website")
SUPPORT = os.path.join(OUT, "support", "intervention_compare")
R2_PATH = os.path.join(OUT, "module1_predictive_r2_score_partition",
                       "M1_base_lasso", "base", "lasso", "module1_component_r2.tsv")
TRIADS = os.path.join(OUT, "mr_edges", "summary", "supp", "mr_triads_wide.tsv")
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")

# A network is worth drawing when it has enough of both to read as a network.
# Genetic edges are what make it a DISEASE network -- observational and trial
# edges attach to proteins and would be there whatever disease was picked -- so
# the threshold counts those, not the total.
MIN_PROTEINS = 5
MIN_GENETIC_EDGES = 8

TIER_RANK = {"Null": 0, "Suggestive": 2, "Tier2": 3, "Tier1": 4, "Tier1plus": 5}


def read_tsv(path):
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def num(v):
    if v is None:
        return None
    v = v.strip()
    if v in ("", "NA", "NaN", "Inf", "-Inf"):
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return f if math.isfinite(f) else None


def fmt(v, nd=6):
    return "" if v is None else f"{v:.{nd}g}"


def sgn(v):
    return "" if v is None or v == 0 else ("1" if v > 0 else "-1")


# Port of heap_pretty_disease() (scripts/visualizations/common/label_helpers.R:152).
# Kept in step with it on purpose: a disease that reads one way in the paper and
# another way on the site is the same bug as two protein spellings.
_FG = re.compile(r"^finngen_R[0-9]+_")
_CHAPTER = re.compile(r"^[A-Z]+[0-9]+_")


# Port of HEAP_BRITISH_AMERICAN (label_helpers.R:67-88). Ported VERBATIM, gaps
# included: "lipidaemias" and "septicaemia" are not covered there either, so
# they are not covered here. The point is that a disease name reads identically
# on the site and in the paper -- silently fixing one side would break that,
# and the fix belongs upstream in label_helpers.R if it is wanted.
# Substitution is substring-based, so every entry must be safe inside a
# correctly-spelled American word (which is why analyse/organis are absent).
_BRITISH_AMERICAN = [
    ("behaviour", "behavior"), ("fibre", "fiber"), ("oedema", "edema"),
    ("oesophag", "esophag"), ("oestrog", "estrog"), ("ischaem", "ischem"),
    ("haem", "hem"), ("anaem", "anem"), ("rrhoea", "rrhea"), ("pnoea", "pnea"),
    ("tumour", "tumor"), ("leukaem", "leukem"), ("coeliac", "celiac"),
    ("paediatr", "pediatr"), ("gynaec", "gynec"), ("anaesth", "anesth"),
    ("foetal", "fetal"), ("foetus", "fetus"), ("caesar", "cesar"),
    ("orthopaed", "orthoped"), ("amoeb", "ameb"), ("colour", "color"),
    ("favour", "favor"), ("licence", "license"), ("defence", "defense"),
    ("catalogue", "catalog"), ("signalling", "signaling"),
    ("modelling", "modeling"), ("labelled", "labeled"), ("labelling", "labeling"),
    ("normalis", "normaliz"), ("standardis", "standardiz"),
    ("summaris", "summariz"), ("utilis", "utiliz"), ("recognis", "recogniz"),
    ("minimis", "minimiz"), ("maximis", "maximiz"), ("categoris", "categoriz"),
    ("prioritis", "prioritiz"), ("neighbour", "neighbor"), ("centre", "center"),
    ("grey", "gray"),
]


def americanize(x):
    for b, a in _BRITISH_AMERICAN:
        x = x.replace(b, a).replace(b.capitalize(), a.capitalize()) \
             .replace(b.upper(), a.upper())
    return x


def pretty_disease(x):
    x = str(x)
    is_fg = bool(_FG.match(x))
    x = re.sub(r"^age_[a-z][0-9]+_first_reported_", "", x)
    x = re.sub(r"_f[0-9]+_[0-9]+_[0-9]+$", "", x)
    if is_fg:
        x = _FG.sub("", x)
        # leading ICD chapter token (E4_, AB1_, I9_); acronyms like T2D_ stay
        x = _CHAPTER.sub("", x)
    return americanize(re.sub(r"_+", " ", x).strip())


def exposure_labels():
    """Reuse the site's own exposure labels (build_catalog.py reads the same
    file) so a node in the network is named what the search box names it."""
    path = os.path.join(WEBSITE, "fig_instrument_diagnostics.json")
    if not os.path.exists(path):
        print(f"  !! {path} missing -- exposure nodes fall back to prettified ids",
              file=sys.stderr)
        return {}
    with open(path, encoding="utf-8") as fh:
        return {r["exposure"]: r.get("label") for r in json.load(fh) if r.get("exposure")}


def pretty_exposure(eid, labels):
    lab = labels.get(eid)
    if lab:
        return lab
    return re.sub(r"_+", " ", re.sub(r"_f[0-9]+_[0-9]+_[0-9]+$", "", eid)).strip()


def forward_tier(pt):
    """Tier label for a forward protein->disease edge, from mr_pd_tiered.

    The print figure emits only "colocalized" and "cis (coloc pending)" because
    it filters to tier_rank >= 4 & cis first. Here nothing is filtered out, so
    the weaker forward evidence needs names of its own rather than being
    dressed in the strong ones."""
    if pt is None:
        return "", ""
    cls = (pt.get("edge_class") or "").strip()
    tier = (pt.get("mr_tier") or "").strip()
    rank = TIER_RANK.get(tier, 0)
    coloc = (pt.get("coloc_confirmed") or "").strip().upper() == "TRUE"
    if cls == "cis" and rank >= 4:
        return ("colocalized" if coloc else "cis (coloc pending)"), cls
    if cls == "cis" and tier == "Tier2":
        return "cis (LD-confounded)", cls
    if cls == "trans":
        return "trans (%s)" % (tier or "untiered"), cls
    return tier, cls


def disease_labels():
    """FinnGen codes are shouty abbreviations (E4_OBESITYCAL) and prettifying
    them alone yields "OBESITYCAL" -- a node label nobody can read. The triad
    table already pairs every FinnGen endpoint with the UK Biobank
    first-reported field it was matched to, which IS readable, plus its ICD-10
    chapter code. 39 of the 44 diseases are covered; the rest fall back to the
    prettified FinnGen code rather than being left blank."""
    if not os.path.exists(TRIADS):
        print(f"  !! {TRIADS} missing -- disease labels fall back to FinnGen codes",
              file=sys.stderr)
        return {}
    out = {}
    for r in read_tsv(TRIADS):
        out.setdefault(r["Disease"], (r.get("Disease_UKB", ""), r.get("ICD10", "")))
    return out


def main():
    edges_path = os.path.join(SUPPORT, "intervention_mr_edges.tsv")
    scatter_path = os.path.join(SUPPORT, "intervention_scatter_mr.tsv")
    tiered_path = os.path.join(SUPPORT, "mr_pd_tiered.tsv")
    for p in (edges_path, scatter_path, tiered_path):
        if not os.path.exists(p):
            sys.exit(f"build_intervention_network: missing {p}")
    os.makedirs(OUTD, exist_ok=True)

    mre = read_tsv(edges_path)
    scatter = read_tsv(scatter_path)
    tiered = read_tsv(tiered_path)
    labels = exposure_labels()
    dz_meta = disease_labels()
    print(f"  sources: mr_edges {len(mre):,}  scatter {len(scatter):,}  "
          f"mr_pd_tiered {len(tiered):,}")

    r2 = {}
    if os.path.exists(R2_PATH):
        r2 = {r["protein"]: r.get("R2_E", "") for r in read_tsv(R2_PATH)}
        print(f"  exposome R2 for node colour: {len(r2):,} proteins")
    else:
        print(f"  !! {R2_PATH} missing -- R2_E will be blank", file=sys.stderr)

    tier_by_pair = {(r["protein"], r["disease"]): r for r in tiered}

    # ---- collapse the edge list over exposures ------------------------------
    # The file is (mr_key x protein x disease): the SAME protein-disease edge is
    # repeated once per exposure that reads that protein, 71,338 rows for 2,531
    # distinct edges. A network node pair is one edge, so collapse to the
    # strongest evidence (smallest padj) and keep how many exposures carried it.
    best = {}
    n_exp_edge = defaultdict(set)
    for r in mre:
        k = (r["protein"], r["disease"], r["mr_edge_sig"])
        n_exp_edge[k].add(r["mr_key"])
        p = num(r["padj_edge"])
        cur = best.get(k)
        if cur is None or (p is not None and (num(cur["padj_edge"]) is None
                                              or p < num(cur["padj_edge"]))):
            best[k] = r
    print(f"  collapsed {len(mre):,} exposure-resolved rows -> {len(best):,} distinct "
          f"(protein, disease, edge type) edges")

    # ---- per-protein context from the intervention table --------------------
    # breadth = number of exposure TERMS that read this protein. That is the
    # print figure's definition (uniqueN(exposure_id)); breadth_eid counts base
    # exposures instead, which is the granularity the network's exposure nodes
    # use, so the two are emitted side by side rather than silently conflated.
    breadth, breadth_eid = defaultdict(set), defaultdict(set)
    trial = {}
    obs_best = {}
    cat_of = {}
    for r in scatter:
        p = r["protein"]
        breadth[p].add(r["exposure_id"])
        breadth_eid[p].add(r["Eid"])
        cat_of[r["Eid"]] = r["Category"]
        trial.setdefault(p, (num(r.get("HERITAGE_effect")),
                             num(r.get("GLP1_effect1")),
                             num(r.get("GLP1_effect2"))))
        # One observational edge per (base exposure, protein), taken at the
        # protein's STRONGEST level. Multi-level (one-hot) exposures otherwise
        # contribute several parallel edges for what is one relationship --
        # the same collapse build_shared_language_network.R:60 does.
        b = num(r.get("beta_HEAP"))
        if b is None:
            continue
        k = (r["Eid"], p)
        cur = obs_best.get(k)
        if cur is None or abs(b) > abs(num(cur["beta_HEAP"]) or 0):
            obs_best[k] = r
    obs_by_protein = defaultdict(list)
    for (eid, p), r in obs_best.items():
        obs_by_protein[p].append(r)
    print(f"  observational edges: {len(scatter):,} term-level pairs -> "
          f"{len(obs_best):,} (base exposure x protein) edges")

    # ---- assemble one network per disease -----------------------------------
    node_rows, edge_rows = [], []
    stats = []
    missing_tier = 0
    diseases = sorted({d for (_, d, _) in best})
    # Display labels, resolved BEFORE the loop because they can collide: three
    # FinnGen obesity endpoints and two T2D endpoints all point at the same UK
    # Biobank field, so a picker keyed on the label alone would show "Obesity"
    # three times and silently pick one. Colliding labels get the FinnGen
    # endpoint appended; unique ones stay clean.
    raw_label = {}
    for dz in diseases:
        ukb, _ = dz_meta.get(dz, ("", ""))
        lab = pretty_disease(ukb) if ukb else pretty_disease(dz)
        raw_label[dz] = (lab[:1].upper() + lab[1:]) if lab else dz
    seen = defaultdict(int)
    for lab in raw_label.values():
        seen[lab] += 1
    dz_label_of = {dz: (f"{lab} ({pretty_disease(dz)})" if seen[lab] > 1 else lab)
                   for dz, lab in raw_label.items()}

    for dz in diseases:
        ukb, icd = dz_meta.get(dz, ("", ""))
        dz_label = dz_label_of[dz]
        fwd, rev = {}, {}
        for (prot, d, kind), r in best.items():
            if d != dz:
                continue
            if kind == "DP":
                rev[prot] = r
            else:
                # keep the more specific instrument if both cis and trans exist
                cur = fwd.get(prot)
                if cur is None or (kind == "PDcis" and cur["mr_edge_sig"] != "PDcis"):
                    fwd[prot] = r
        proteins = sorted(set(fwd) | set(rev))

        dz_edges = []
        n_gen = 0
        for prot in proteins:
            cls = "reporter"
            if prot in fwd:
                pt = tier_by_pair.get((prot, dz))
                if pt is None:
                    missing_tier += 1
                tier, edge_class = forward_tier(pt)
                cls = "causal" if tier in ("colocalized", "cis (coloc pending)") else "forward"
                r = fwd[prot]
                dz_edges.append([
                    dz, prot, dz, "gen_fwd", tier, sgn(num(r["beta_edge"])),
                    fmt(abs(num(r["beta_edge"]) or 0)), edge_class or
                    ("cis" if r["mr_edge_sig"] == "PDcis" else "trans"),
                    r["mr_support"], r["padj_edge"],
                    len(n_exp_edge[(prot, dz, r["mr_edge_sig"])]), "",
                ])
                n_gen += 1
            if prot in rev:
                r = rev[prot]
                dz_edges.append([
                    dz, dz, prot, "gen_rev", "reporter (reverse)",
                    sgn(num(r["beta_edge"])), fmt(abs(num(r["beta_edge"]) or 0)),
                    "", r["mr_support"], r["padj_edge"],
                    len(n_exp_edge[(prot, dz, "DP")]), "",
                ])
                n_gen += 1

            node_rows.append([
                dz, prot, "protein", prot, cls, len(breadth.get(prot, ())),
                r2.get(prot, ""), len(breadth_eid.get(prot, ())), "",
            ])

            her, g1, g2 = trial.get(prot, (None, None, None))
            for src, eff in (("HERITAGE", her), ("GLP1-RA", g1 if g1 is not None else g2)):
                if eff is None:
                    continue
                dz_edges.append([dz, src, prot, "interv", "", sgn(eff), fmt(abs(eff)),
                                  "", "", "", "", ""])
            for r in obs_by_protein.get(prot, ()):
                b = num(r["beta_HEAP"])
                # `term` is the model term this edge was taken at -- the
                # strongest level of a multi-level exposure. Its own column, not
                # squeezed into n_exposures: a column that is a count on one
                # edge type and an identifier on another is unusable, and
                # build_payload's type recovery gives up on the whole column.
                dz_edges.append([dz, r["Eid"], prot, "obs", "", sgn(b), fmt(abs(b)),
                                  "", "", "", "", r["exposure_id"]])

        # source + disease nodes, added only when something attaches to them
        srcs = {e[1] for e in dz_edges if e[3] == "interv"}
        for s in sorted(srcs):
            node_rows.append([dz, s, "exp_rct", s, "", "", "", "", ""])
        eids = {e[1] for e in dz_edges if e[3] == "obs"}
        for eid in sorted(eids):
            node_rows.append([dz, eid, "exp_obs", pretty_exposure(eid, labels), "",
                              "", "", "", cat_of.get(eid, "")])
        node_rows.append([dz, dz, "disease", dz_label, "", "", "", "", icd])

        edge_rows.extend(dz_edges)
        stats.append((dz, dz_label, len(proteins), n_gen, len(dz_edges)))

    # `category` carries the exposure category on exp_obs nodes and the ICD-10
    # chapter on the disease node; it is blank for proteins and trials.
    node_cols = ["disease", "id", "kind", "label", "class", "breadth", "R2_E",
                 "breadth_eid", "category"]
    # n_exposures: how many exposures carried this genetic edge in the
    # exposure-resolved source (blank for obs/interv edges, which are one
    # exposure by construction). term: the model term an obs edge was taken at.
    edge_cols = ["disease", "from", "to", "etype", "tier", "sign", "weight",
                 "edge_class", "mr_support", "padj_edge", "n_exposures", "term"]
    with open(os.path.join(OUTD, "intervention_network_nodes.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t"); w.writerow(node_cols); w.writerows(node_rows)
    with open(os.path.join(OUTD, "intervention_network_edges.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t"); w.writerow(edge_cols); w.writerows(edge_rows)

    print(f"  intervention_network_nodes.tsv  {len(node_rows):,} rows x {len(node_cols)} cols")
    print(f"  intervention_network_edges.tsv  {len(edge_rows):,} rows x {len(edge_cols)} cols")
    if missing_tier:
        print(f"      {missing_tier} forward edge(s) have no mr_pd_tiered row; their tier "
              f"is blank rather than guessed from significance")

    drawable = [s for s in stats if s[2] >= MIN_PROTEINS and s[3] >= MIN_GENETIC_EDGES]
    for lo in (3, 5, 10, 20):
        print(f"      >={lo:2d} proteins: {sum(1 for s in stats if s[2] >= lo):3d} diseases")
    print(f"  {len(diseases)} diseases have any edge; {len(drawable)} clear the drawable "
          f"bar (>={MIN_PROTEINS} proteins and >={MIN_GENETIC_EDGES} genetic edges)")
    for dz, lab, np_, ng, ne in sorted(stats, key=lambda s: -s[3])[:12]:
        mark = "*" if (np_ >= MIN_PROTEINS and ng >= MIN_GENETIC_EDGES) else " "
        print(f"    {mark} {lab[:38]:38s} {np_:4d} proteins  {ng:4d} genetic  {ne:6d} edges")
    thin = len(stats) - len(drawable)
    print(f"    ({thin} disease(s) fall below it -- kept in the payload so the picker can "
          f"grey them out rather than pretend they do not exist)")

    # The print figure is one of these networks, cut to 18 proteins and 4
    # exposures. Report its diseases so a regression is visible.
    print_dz = [s for s in stats if re.search(r"T2D|OBESITY|LIPOPROT|HYPTENS", s[0])]
    print(f"  the printed Fig 5d covers {len(print_dz)} of these disease codes: "
          + ", ".join(f"{s[1]} ({s[2]}p/{s[3]}g)" for s in print_dz[:6]))


if __name__ == "__main__":
    main()
