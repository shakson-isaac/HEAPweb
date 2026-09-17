#!/usr/bin/env python3
"""One concordance table: HEAP exposure->protein effects beside the trials that
moved the same proteins, annotated with MR direction, under five covariate
specifications.

The Interventions page used to be a stack of pre-baked scatter figures, one per
question. This replaces them with a single table whose ANNOTATION LEVEL the
reader controls: significance across studies, MR overlap, edge direction
(P->D vs D->P), cis vs trans, platform replication, point size from the
Olink-SomaScan reliability.

FOUR SOURCES, JOINED HERE
  1  support/intervention_compare/intervention_scatter_mr.tsv   25,414 pairs
       the pair universe: (exposure term x protein) with beta_HEAP, the trial
       effects, and the strongest MR edge for that exposure.
  2  supp_deposit/S15_intervention_concordance.tsv              same 25,414
       the SAME rows, but carrying the trial standard errors, which (1) drops.
  3  mr_edges/summary/supp/mr_triads_wide.tsv                   18,780 triads
       MR direction, instrument class and colocalization -- which neither
       intervention table has. Aggregated to one row per protein; see
       aggregate_mr_by_protein() for exactly how, and for why the flags are
       "somewhere in this protein's triads", not "for this exposure".
  4  supp_deposit/assoc_E_specs/<spec>.tsv                      5 x ~29,640
       the same associations under four other adjustments.

WHY THE SPEC SWITCH IS LEGITIMATE WITHOUT RERUNNING ANY R
  beta_HEAP in (1) IS beta_test from the base specification -- they differ only
  by the deposit's 4-decimal rounding (median |diff| 1.8e-05, max 4.9e-04; SE
  agrees to 2e-06). So swapping in another spec's beta_test is a real
  specification change, computed by HEAP, not a re-estimate invented here.
  assert_base_reproduces_beta_heap() re-checks that on every run and aborts if
  it stops holding -- that check is the entire licence for this approach, so it
  is not optional and must not be downgraded to a warning.

  Use beta_test, the HELD-OUT split. beta_train differs from beta_HEAP by a
  median of 1.8e-02 -- three orders of magnitude larger -- because it is a
  different estimand, not a rounding of the same one.

  A TRAP THE READER WILL FALL INTO, so the page must not encourage it: an
  effect that shrinks under base_plus_bmi has NOT been shown to be mediated by
  BMI. Adjustment cannot separate mediation from confounding. `what_varies`
  says only what the specification changed; nothing here licenses a mediation
  claim (project_bmi_adjustment_not_mediation).

WHAT "MEASURED" MEANS PER TRIAL -- the distinction that must not collapse
  A blank trial effect can mean two completely different things, and the
  deposit cannot tell them apart because both trial tables were filtered to
  their significant hits before HEAP ever saw them:
      * the trial never assayed this protein
      * the trial assayed it and found nothing
  For GLP1 the assay panel is recoverable: STEP1/STEP2 sheets list all 6,386
  genes tested (1,233 of our 1,488), so glp1_measured separates "not on the
  panel" from "on the panel, q>=0.05" for 726 proteins that would otherwise
  read as absent.
  For HERITAGE it is NOT recoverable: its Supplemental Table 1 contains only
  q<0.01 rows (max q in the file = 0.0100), so the assayed panel is not in the
  published file. heritage_measured is therefore emitted EMPTY -- unknown --
  rather than being back-filled from the hit list, which would assert that the
  193 reported proteins are the whole panel. heritage_reported carries the fact
  we do have.

Output -> build/derived/
  intervention_concordance_full.tsv     tier K, sharded on exposure_id
  intervention_spec_correlations.tsv    tier S, per exposure x spec x trial
"""
import csv
import math
import os
import statistics
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlsx_min

OUT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
TRIALS = os.environ.get("HEAP_INTERVENTIONS", "/n/groups/patel/IGLOO/UKB/Interventions")
SUPPORT = os.path.join(OUT, "support", "intervention_compare")
DEPOSIT = os.path.join(OUT, "supp_deposit")
SPECDIR = os.path.join(DEPOSIT, "assoc_E_specs")
TRIADS = os.path.join(OUT, "mr_edges", "summary", "supp", "mr_triads_wide.tsv")
PD_TIERED = os.path.join(SUPPORT, "mr_pd_tiered.tsv")
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")

# Rounding slack between the deposit's beta_HEAP and the spec's beta_test. The
# observed max is 4.9e-04; 1e-3 leaves room for one more rounded decimal and
# nothing else. Widening this to make a failure go away defeats the check.
BETA_TOL = 1e-3

# MR tier ladder, worst to best. "" is an edge that arm never tested (a blank
# cell in mr_triads_wide), which is NOT the same as "Null" (tested, not
# significant) -- keeping them apart is the point of starting the ladder at -1.
TIER_RANK = {"": -1, "NA": -1, "Null": 0, "Reverse": 1, "Suggestive": 2,
             "Tier2": 3, "Tier1": 4, "Tier1plus": 5}
CAUSAL_TIERS = {"Tier1", "Tier1plus"}
COLOC_PPH4_MIN = 0.8      # the manuscript's hard coloc gate (project_module5_coloc)


def read_tsv(path):
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def num(v):
    if v is None:
        return None
    v = v.strip()
    if v == "" or v in ("NA", "NaN", "Inf", "-Inf"):
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return f if math.isfinite(f) else None


def fmt(v, nd=6):
    return "" if v is None else f"{v:.{nd}g}"


# ---------------------------------------------------------------------------
# Student-t tail, so the recomputed correlations carry the same p-value the R
# pipeline reports: 2 * pt(-|t|, df). No scipy on O2's python3, and pulling one
# in for a single distribution is not worth a dependency.
# ---------------------------------------------------------------------------
def _betacf(a, b, x):
    tiny, eps = 1e-30, 3e-16
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    if abs(d) < tiny:
        d = tiny
    d, h = 1.0 / d, 1.0 / d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        c = 1.0 + aa / c
        if abs(d) < tiny:
            d = tiny
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        c = 1.0 + aa / c
        if abs(d) < tiny:
            d = tiny
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            break
    return h


def _betai(a, b, x):
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    lbeta = (math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
             + a * math.log(x) + b * math.log1p(-x))
    if x < (a + 1.0) / (a + b + 2.0):
        return math.exp(lbeta) * _betacf(a, b, x) / a
    return 1.0 - math.exp(lbeta) * _betacf(b, a, 1.0 - x) / b


def t_two_sided_p(t, df):
    if df <= 0 or not math.isfinite(t):
        return None
    return _betai(df / 2.0, 0.5, df / (df + t * t))


# ---------------------------------------------------------------------------
# MR: one row per PROTEIN, from many triads
# ---------------------------------------------------------------------------
def aggregate_mr_by_protein(triads):
    """Collapse mr_triads_wide (one row per exposure x protein x disease) to one
    row per protein.

    HOW, EXACTLY -- this is an ANY-TRIAD, ANY-ARM aggregate:
      best_*_tier   the highest tier that edge type reaches in ANY triad, in
                    EITHER arm (UKB or deCODE), on the ladder above.
      has_PD_cis / has_PD_trans / has_DP
                    that best tier is Tier1 or Tier1plus. NOT "non-Null": Tier2
                    is the LD-confounded cis tier the manuscript demotes on
                    purpose (project_module5_coloc, 47 demoted cis edges), so
                    counting it as a causal edge would re-inflate exactly the
                    number that was deliberately deflated. Tier2 is still
                    visible in best_PD_cis_tier for anyone who wants it.
      *_arms        which arm(s) reach that best tier: UKB / dCODE / both.
      coloc_PDcis   some triad's cis coloc is called "colocalized";
      coloc_PPH4_max / coloc_cleared  the strongest PP.H4 and whether it
                    reaches 0.8, the manuscript's hard gate.

    WHAT THIS IS NOT: it is not per-exposure and not per-disease. A protein
    flagged has_PD_cis may carry that cis edge to a different disease than the
    row's own best_disease. The row-level columns (mr_edge_sig, mr_support,
    best_disease) are the per-exposure statement; these are the protein's MR
    record overall. Taking the first triad instead -- which is what a naive
    merge does -- would report whichever exposure sorted first, an arbitrary
    choice that changes if the file is re-sorted.
    """
    def best(rows, col_ukb, col_dec):
        rank, tier, arms = -1, "", []
        for r in rows:
            for tag, col in (("UKB", col_ukb), ("dCODE", col_dec)):
                v = (r.get(col) or "").strip()
                k = TIER_RANK.get(v, -1)
                if k > rank:
                    rank, tier, arms = k, v, [tag]
                elif k == rank and k >= 0 and tag not in arms:
                    arms.append(tag)
        return tier, rank, ("both" if len(arms) == 2 else (arms[0] if arms else ""))

    by_protein = defaultdict(list)
    for r in triads:
        by_protein[r["Protein"]].append(r)

    agg = {}
    for prot, rows in by_protein.items():
        cis_t, cis_r, cis_arm = best(rows, "tier_PDcis_UKB", "tier_PDcis_dCODE")
        tra_t, tra_r, tra_arm = best(rows, "tier_PDtrans_UKB", "tier_PDtrans_dCODE")
        dp_t, dp_r, dp_arm = best(rows, "tier_DP_UKB", "tier_DP_dCODE")
        pph4 = [num(r.get(c)) for r in rows
                for c in ("colocPPH4_PDcis_UKB", "colocPPH4_PDcis_dCODE")]
        pph4 = [v for v in pph4 if v is not None]
        pph4_max = max(pph4) if pph4 else None
        coloc = any((r.get(c) or "").strip() == "colocalized" for r in rows
                    for c in ("coloc_PDcis_UKB", "coloc_PDcis_dCODE"))
        has_cis = cis_t in CAUSAL_TIERS
        has_tra = tra_t in CAUSAL_TIERS
        has_dp = dp_t in CAUSAL_TIERS
        fwd = has_cis or has_tra
        agg[prot] = {
            "mr_in_triads": "TRUE",
            "mr_n_triads": len(rows),
            "mr_n_diseases": len({r["Disease"] for r in rows}),
            "mr_n_exposures": len({r["Exposure"] for r in rows}),
            "has_PD_cis": "TRUE" if has_cis else "FALSE",
            "has_PD_trans": "TRUE" if has_tra else "FALSE",
            "has_DP": "TRUE" if has_dp else "FALSE",
            "best_PD_cis_tier": cis_t,
            "best_PD_trans_tier": tra_t,
            "best_PD_tier": cis_t if cis_r >= tra_r else tra_t,
            "best_DP_tier": dp_t,
            "PD_cis_arms": cis_arm,
            "PD_trans_arms": tra_arm,
            "DP_arms": dp_arm,
            "coloc_PDcis": "TRUE" if coloc else "FALSE",
            "coloc_PPH4_max": fmt(pph4_max),
            "coloc_cleared": ("TRUE" if (pph4_max is not None and pph4_max >= COLOC_PPH4_MIN)
                              else "FALSE"),
            # mr_role is NOT set here: it is the union of this view and
            # mr_pd_tiered's (see aggregate_pd_tiered), so it is resolved once
            # both are in hand. Deciding it from triads alone filed ALCAM and
            # SOST as reporters when they are Tier-1 cis causal.
            "_fwd_in_triads": fwd,
            "_has_dp": has_dp,
        }
    return agg


def aggregate_pd_tiered(tiered):
    """Second, INDEPENDENT per-protein MR view, from mr_pd_tiered.tsv.

    WHY A SECOND TABLE AT ALL -- this cost a real miscount before it was added.
    mr_triads_wide is a TRIAD table: one row per exposure x protein x disease,
    so it only sees a protein->disease edge that sits inside a COMPLETE triad
    with some exposure. Two of the eight Tier-1 cis proteins do not:
        ALCAM  no triad rows at all; its Tier-1 cis edge to T2D_WIDE is
               invisible to the triad table
        SOST   has one triad, for a different disease; its Tier-1 cis edge to
               osteoporosis is not in it
    Aggregating triads alone therefore reports 6 causal-cis proteins where the
    canonical Fig-4 tier table has 8, and ALCAM and SOST get filed as
    reporters. mr_pd_tiered.tsv is not triad-constrained and is the table Fig 4
    itself is built from, so it is the complete view of the protein->disease
    arm. Both are emitted: has_PD_* answers "inside a triad", pdt_* answers
    "at all", and mr_role uses the union so nothing causal is missed.

    The gate is the print figure's: tier_rank >= 4 (Tier1 / Tier1plus). Tier2 is
    the LD-confounded cis tier and stays out of the causal flag.
    """
    by_protein = defaultdict(list)
    for r in tiered:
        by_protein[r["protein"]].append(r)
    agg = {}
    for prot, rows in by_protein.items():
        def rank(r):
            try:
                return int(r["tier_rank"])
            except (TypeError, ValueError):
                return 0
        top = max(rows, key=rank)
        causal = [r for r in rows if rank(r) >= 4]
        cis1 = [r for r in causal if (r.get("edge_class") or "").strip() == "cis"]
        agg[prot] = {
            "pdt_in_table": "TRUE",
            "pdt_n_edges": len(rows),
            "pdt_best_tier": top.get("mr_tier", ""),
            "pdt_best_edge_class": top.get("edge_class", ""),
            "pdt_top_disease": top.get("disease", "") if rank(top) >= 4 else "",
            "pdt_cis_tier1": "TRUE" if cis1 else "FALSE",
            "pdt_n_causal_diseases": len({r["disease"] for r in causal}),
            "pdt_coloc_confirmed": "TRUE" if any(
                (r.get("coloc_confirmed") or "").strip().upper() == "TRUE"
                for r in rows) else "FALSE",
        }
    return agg


PDT_BLANK = {"pdt_in_table": "FALSE", "pdt_n_edges": "0", "pdt_best_tier": "",
             "pdt_best_edge_class": "", "pdt_top_disease": "",
             "pdt_cis_tier1": "FALSE", "pdt_n_causal_diseases": "0",
             "pdt_coloc_confirmed": "FALSE"}


MR_BLANK = {k: "" for k in (
    "has_PD_cis", "has_PD_trans", "has_DP", "best_PD_cis_tier",
    "best_PD_trans_tier", "best_PD_tier", "best_DP_tier", "PD_cis_arms",
    "PD_trans_arms", "DP_arms", "coloc_PDcis", "coloc_PPH4_max",
    "coloc_cleared")}
MR_BLANK.update(mr_in_triads="FALSE", mr_n_triads="0", mr_n_diseases="0",
                mr_n_exposures="0", _fwd_in_triads=False, _has_dp=False)


def mr_role(triad_view, pdt_view):
    """A minority are causal intermediates, the majority are reporters carrying
    the record (project_heap_narrative). Forward evidence counts from EITHER
    view; the reverse edge only exists in the triad table."""
    if (triad_view["mr_in_triads"] != "TRUE"
            and pdt_view["pdt_in_table"] != "TRUE"):
        # Neither MR table contains this protein. "none" would assert it was
        # tested and found to have no edge; blank says it was never tested,
        # which is what actually happened for 887 of the 1,488 proteins.
        return ""
    fwd = triad_view["_fwd_in_triads"] or pdt_view["pdt_cis_tier1"] == "TRUE"
    dp = triad_view["_has_dp"]
    return ("both" if fwd and dp else
            "intermediate" if fwd else
            "reporter" if dp else "none")


# ---------------------------------------------------------------------------
# Trial assay panels (see the module docstring on what "measured" can mean)
# ---------------------------------------------------------------------------
def trial_panels():
    glp1 = os.path.join(TRIALS, "GLP1_proteomics.xlsx")
    if not os.path.exists(glp1):
        print("  !! GLP1 workbook missing -- glp1_measured will be blank (unknown)",
              file=sys.stderr)
        return None, None
    panels = []
    for sheet in ("S2_tx_STEP1", "S3_tx_STEP2"):
        rows = xlsx_min.sheet_rows(glp1, sheet_name=sheet)
        genes = set()
        for r in rows:
            g = (r.get("EntrezGeneSymbol") or "").strip()
            # A few assays map to a protein complex and are labelled with the
            # member symbols separated by spaces ("FTH1 FTL"). Both members
            # were assayed, so both count as measured; the effect join in
            # run_intervention_compare.R keys on the composite string, so a
            # complex-only protein can be measured with no reportable effect.
            genes.update(g.split())
        panels.append(genes)
    return panels[0], panels[1]


def heritage_reported_set(scatter):
    return {r["protein"] for r in scatter if num(r.get("HERITAGE_effect")) is not None}


# ---------------------------------------------------------------------------
# specifications
# ---------------------------------------------------------------------------
def load_specs():
    man = {}
    mpath = os.path.join(SPECDIR, "manifest.tsv")
    if os.path.exists(mpath):
        for r in read_tsv(mpath):
            man[r["specification"]] = r
    specs = {}
    for fname in sorted(os.listdir(SPECDIR)):
        if not fname.endswith(".tsv") or fname == "manifest.tsv":
            continue
        spec = fname[:-4]
        rows = read_tsv(os.path.join(SPECDIR, fname))
        specs[spec] = {(r["Term"], r["Protein"]): r for r in rows}
        if len(specs[spec]) != len(rows):
            sys.exit(f"build_intervention_concordance: {fname} is not unique on "
                     f"Term x Protein ({len(rows)} rows, {len(specs[spec])} keys)")
    return specs, man


def what_varies(spec, man):
    """Straight from the deposit manifest -- never invented here. spec_kind is
    the load-bearing part: a 'covariate' spec changes the adjustment only,
    a 'sample' spec changes who is in the analysis."""
    m = man.get(spec, {})
    kind = m.get("spec_kind", "")
    cov = m.get("covariate_set", "")
    if spec == "base":
        return "reference", kind, cov
    if kind == "sample":
        return "sample restriction", kind, cov
    if kind == "covariate":
        return "covariate adjustment", kind, cov
    return kind or "", kind, cov


def assert_base_reproduces_beta_heap(scatter, base):
    """The licence for the whole spec switch. Abort, do not warn."""
    dbeta, dse, missing = [], [], 0
    for r in scatter:
        b = base.get((r["exposure_id"], r["protein"]))
        if b is None:
            missing += 1
            continue
        x, y = num(r["beta_HEAP"]), num(b["beta_test"])
        if x is not None and y is not None:
            dbeta.append(abs(x - y))
        sx, sy = num(r["se_HEAP"]), num(b["SE_test"])
        if sx is not None and sy is not None:
            dse.append(abs(sx - sy))
    if missing or not dbeta:
        sys.exit(f"build_intervention_concordance: base spec does not cover the "
                 f"intervention pairs ({missing} unmatched) -- the spec switch is "
                 f"not licensed, refusing to write")
    mx = max(dbeta)
    print(f"  beta_HEAP == base beta_test:  median |d| {statistics.median(dbeta):.2e}"
          f"   max |d| {mx:.2e}   (tol {BETA_TOL:.0e})   n={len(dbeta):,}")
    print(f"  se_HEAP   == base SE_test:    median |d| {statistics.median(dse):.2e}"
          f"   max |d| {max(dse):.2e}")
    if mx > BETA_TOL:
        sys.exit(f"build_intervention_concordance: ASSERTION FAILED -- base "
                 f"beta_test departs from beta_HEAP by up to {mx:.3e} > {BETA_TOL:.0e}. "
                 f"The spec swap is no longer a rounding-level substitution; it "
                 f"would silently change what the page plots. Refusing to write.")
    return True


# ---------------------------------------------------------------------------
# per-exposure correlations, recomputed per spec (task C)
# ---------------------------------------------------------------------------
# WHICH CORRELATION. The published intervention_correlations.tsv is a
# RELIABILITY-WEIGHTED PEARSON r: run_intervention_compare.R:161 calls
# weights::wtd.cor(x, y, weight = w_rel) with w_rel = pmax(olink_soma_r, 0),
# missing reliability mean-imputed, and reports n_eff = (sum w)^2 / sum(w^2)
# with p from a t on df = n_eff - 2. So that is what is recomputed here, and
# validate_against_published() checks the base spec reproduces the published r
# (it does, to ~1e-14 median). An unweighted Pearson and a Spearman are emitted
# ALONGSIDE it, not instead of it -- the weighted r is the comparable number,
# the other two let a reader see whether the weighting or a few outliers is
# doing the work.
def weighted_pearson(x, y, w):
    sw = sum(w)
    mx = sum(wi * xi for wi, xi in zip(w, x)) / sw
    my = sum(wi * yi for wi, yi in zip(w, y)) / sw
    cxy = sum(wi * (xi - mx) * (yi - my) for wi, xi, yi in zip(w, x, y))
    cxx = sum(wi * (xi - mx) ** 2 for wi, xi in zip(w, x))
    cyy = sum(wi * (yi - my) ** 2 for wi, yi in zip(w, y))
    if cxx <= 0 or cyy <= 0:
        return None, None
    return cxy / math.sqrt(cxx * cyy), sw * sw / sum(wi * wi for wi in w)


def pearson(x, y):
    n = len(x)
    mx, my = sum(x) / n, sum(y) / n
    cxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    cxx = sum((a - mx) ** 2 for a in x)
    cyy = sum((b - my) ** 2 for b in y)
    if cxx <= 0 or cyy <= 0:
        return None
    return cxy / math.sqrt(cxx * cyy)


def _ranks(v):
    order = sorted(range(len(v)), key=lambda i: v[i])
    r = [0.0] * len(v)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            r[order[k]] = avg
        i = j + 1
    return r


def spearman(x, y):
    return pearson(_ranks(x), _ranks(y))


def bh(pvals):
    """Benjamini-Hochberg over the supplied (index, p) pairs."""
    items = sorted(pvals, key=lambda t: t[1])
    n = len(items)
    out, prev = {}, 1.0
    for rank in range(n, 0, -1):
        idx, p = items[rank - 1]
        prev = min(prev, p * n / rank)
        out[idx] = prev
    return out


MIN_NEFF = 8   # run_intervention_compare.R:60 -- below this the r is 2-3 proteins


def main():
    for p in (SUPPORT, DEPOSIT, SPECDIR, TRIADS):
        if not os.path.exists(p):
            sys.exit(f"build_intervention_concordance: missing {p}")
    os.makedirs(OUTD, exist_ok=True)

    scatter = read_tsv(os.path.join(SUPPORT, "intervention_scatter_mr.tsv"))
    s15 = read_tsv(os.path.join(DEPOSIT, "S15_intervention_concordance.tsv"))
    triads = read_tsv(TRIADS)
    print(f"  sources: scatter {len(scatter):,}  S15 {len(s15):,}  triads {len(triads):,}")

    # --- 1. trial standard errors, from the deposit -------------------------
    se_by_pair = {(r["exposure_id"], r["protein"]): r for r in s15}
    if len(se_by_pair) != len(s15):
        sys.exit("S15 is not unique on (exposure_id, protein)")
    no_se = sum(1 for r in scatter
                if (r["exposure_id"], r["protein"]) not in se_by_pair)
    print(f"  trial SE join: {len(scatter) - no_se:,}/{len(scatter):,} pairs matched"
          + (f"  -- {no_se} MISSING" if no_se else ""))

    # --- 2. trial assay panels ----------------------------------------------
    step1_panel, step2_panel = trial_panels()
    her_reported = heritage_reported_set(scatter)
    prots = {r["protein"] for r in scatter}
    if step1_panel is not None:
        print(f"  GLP1 assay panel: STEP1 {len(step1_panel):,} genes "
              f"({len(step1_panel & prots)} of our {len(prots)} proteins), "
              f"STEP2 {len(step2_panel):,} ({len(step2_panel & prots)})")
        m1 = len(step1_panel & prots)
        r1 = len({r["protein"] for r in scatter if num(r.get("GLP1_effect1")) is not None})
        print(f"      of the {m1} STEP1-measured proteins, {r1} moved (q<0.05); "
              f"{m1 - r1} were measured and did not -- a distinction the deposit "
              f"alone cannot make")
    print(f"  HERITAGE: {len(her_reported)} proteins reported (q<0.01); assayed panel "
          f"NOT in the published file, so heritage_measured stays unknown")

    # --- 3. MR aggregate, one row per protein --------------------------------
    pdt = aggregate_pd_tiered(read_tsv(PD_TIERED)) if os.path.exists(PD_TIERED) else {}
    if not pdt:
        print(f"  !! {PD_TIERED} missing -- pdt_* columns blank and mr_role will "
              f"under-count causal proteins", file=sys.stderr)
    mr = aggregate_mr_by_protein(triads)
    covered = len(prots & set(mr))
    print(f"  MR triads: {len(mr)} proteins aggregated from {len(triads):,} triads; "
          f"{covered} of {len(prots)} intervention proteins have any triad, "
          f"{len(prots) - covered} have none (they are not in a tested triad -- "
          f"emitted with mr_in_triads=FALSE, not dropped)")
    cis_triad = {p for p in prots if mr.get(p, MR_BLANK)["has_PD_cis"] == "TRUE"}
    cis_pdt = {p for p in prots if pdt.get(p, PDT_BLANK)["pdt_cis_tier1"] == "TRUE"}
    print(f"  Tier-1 cis proteins: {len(cis_triad)} visible in the triad table, "
          f"{len(cis_pdt)} in the canonical tier table"
          + (f"; only in the tier table: {', '.join(sorted(cis_pdt - cis_triad))}"
             if cis_pdt - cis_triad else ""))
    roles = defaultdict(int)
    for p in prots:
        roles[mr_role(mr.get(p, MR_BLANK), pdt.get(p, PDT_BLANK))] += 1
    print("      mr_role: " + "  ".join(f"{k}={v}" for k, v in sorted(roles.items())))

    # --- 4. specifications ---------------------------------------------------
    specs, man = load_specs()
    print(f"  specs: " + ", ".join(f"{s} ({len(t):,})" for s, t in sorted(specs.items())))
    assert_base_reproduces_beta_heap(scatter, specs["base"])

    # --- 5. emit the concordance table ---------------------------------------
    cols = [
        "spec", "spec_kind", "what_varies", "covariate_set",
        "exposure_id", "Eid", "Category", "mr_key", "protein",
        # this spec's held-out estimate
        "beta_HEAP", "se_HEAP", "p_HEAP", "replicated", "in_spec",
        # base's, carried on every row so a reader can see the shift without
        # fetching a second shard
        "beta_base", "se_base",
        # trials: effect, SE, whether the trial reported it, whether the trial
        # measured it at all (see the docstring -- these are not the same)
        "HERITAGE_effect", "HERITAGE_se", "heritage_reported", "heritage_measured",
        "GLP1_effect1", "GLP1_se1", "glp1_reported1", "glp1_measured1",
        "GLP1_effect2", "GLP1_se2", "glp1_reported2", "glp1_measured2",
        "olink_soma_r",
        # MR for THIS exposure (strongest edge across diseases)
        "mr_edge_sig", "mr_support", "best_disease", "padj_edge", "beta_edge",
        "n_dz_edge",
        # MR for this PROTEIN across all its triads (see aggregate_mr_by_protein)
        "mr_in_triads", "mr_n_triads", "mr_n_diseases", "mr_n_exposures",
        "has_PD_cis", "has_PD_trans", "has_DP", "best_PD_cis_tier",
        "best_PD_trans_tier", "best_PD_tier", "best_DP_tier",
        "PD_cis_arms", "PD_trans_arms", "DP_arms",
        "coloc_PDcis", "coloc_PPH4_max", "coloc_cleared",
        # the protein->disease arm as Fig 4 itself tiers it -- not limited to
        # edges that happen to sit inside a triad (see aggregate_pd_tiered)
        "pdt_in_table", "pdt_n_edges", "pdt_best_tier", "pdt_best_edge_class",
        "pdt_top_disease", "pdt_cis_tier1", "pdt_n_causal_diseases",
        "pdt_coloc_confirmed",
        # union of both views
        "mr_role",
    ]

    rows_out = []
    not_in_spec = defaultdict(list)
    for spec in sorted(specs):
        wv, kind, cov = what_varies(spec, man)
        table = specs[spec]
        for r in scatter:
            key = (r["exposure_id"], r["protein"])
            sp = table.get(key)
            if sp is None:
                not_in_spec[spec].append(key)
            base = specs["base"].get(key)
            se = se_by_pair.get(key, {})
            m = mr.get(r["protein"], MR_BLANK)
            q = pdt.get(r["protein"], PDT_BLANK)
            prot = r["protein"]
            her_eff = num(r.get("HERITAGE_effect"))
            g1 = num(r.get("GLP1_effect1"))
            g2 = num(r.get("GLP1_effect2"))
            rows_out.append([
                spec, kind, wv, cov,
                r["exposure_id"], r["Eid"], r["Category"], r["mr_key"], prot,
                # blank, not zero, when a pair is absent from this spec
                (sp or {}).get("beta_test", ""), (sp or {}).get("SE_test", ""),
                (sp or {}).get("p_test", ""), (sp or {}).get("replicated", ""),
                "TRUE" if sp else "FALSE",
                (base or {}).get("beta_test", ""), (base or {}).get("SE_test", ""),
                r.get("HERITAGE_effect", ""), se.get("HERITAGE_se", ""),
                "TRUE" if her_eff is not None else "FALSE", "",
                r.get("GLP1_effect1", ""), se.get("GLP1_se1", ""),
                "TRUE" if g1 is not None else "FALSE",
                "" if step1_panel is None else ("TRUE" if prot in step1_panel else "FALSE"),
                r.get("GLP1_effect2", ""), se.get("GLP1_se2", ""),
                "TRUE" if g2 is not None else "FALSE",
                "" if step2_panel is None else ("TRUE" if prot in step2_panel else "FALSE"),
                r.get("olink_soma_r", ""),
                r["mr_edge_sig"], r["mr_support"], r["best_disease"],
                r["padj_edge"], r["beta_edge"], r["n_dz_edge"],
                m["mr_in_triads"], m["mr_n_triads"], m["mr_n_diseases"],
                m["mr_n_exposures"], m["has_PD_cis"], m["has_PD_trans"], m["has_DP"],
                m["best_PD_cis_tier"], m["best_PD_trans_tier"], m["best_PD_tier"],
                m["best_DP_tier"], m["PD_cis_arms"], m["PD_trans_arms"], m["DP_arms"],
                m["coloc_PDcis"], m["coloc_PPH4_max"], m["coloc_cleared"],
                q["pdt_in_table"], q["pdt_n_edges"], q["pdt_best_tier"],
                q["pdt_best_edge_class"], q["pdt_top_disease"], q["pdt_cis_tier1"],
                q["pdt_n_causal_diseases"], q["pdt_coloc_confirmed"],
                mr_role(m, q),
            ])

    for spec, keys in sorted(not_in_spec.items()):
        exps = sorted({k[0] for k in keys})
        print(f"  !! {spec}: {len(keys)} of {len(scatter):,} pairs are absent from this "
              f"spec ({len(exps)} exposure(s): {', '.join(exps[:3])}"
              f"{'...' if len(exps) > 3 else ''}). Emitted with in_spec=FALSE and blank "
              f"estimates so the pair universe stays identical across specs.")

    dest = os.path.join(OUTD, "intervention_concordance_full.tsv")
    with open(dest, "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(cols)
        w.writerows(rows_out)
    n_exp = len({r[4] for r in rows_out})
    print(f"  intervention_concordance_full.tsv  {len(rows_out):,} rows x {len(cols)} cols")
    print(f"      {len(specs)} specs x {len(scatter):,} pairs; {n_exp} exposure shards "
          f"(~{len(rows_out)//n_exp} rows each)")

    # --- 6. per-exposure correlations, per spec ------------------------------
    write_spec_correlations(scatter, specs, man)


def write_spec_correlations(scatter, specs, man):
    # Protein reliability weight. run_intervention_compare.R mean-imputes a
    # missing r_cross before taking pmax(., 0); the mean is over the merged
    # protein table, which is why the reproduction below is exact for most
    # exposures and off by <=0.006 for a few.
    r_cross = {}
    for r in scatter:
        v = num(r.get("olink_soma_r"))
        if v is not None:
            r_cross[r["protein"]] = v
    mean_r = statistics.fmean(r_cross.values())

    by_exposure = defaultdict(list)
    meta = {}
    for r in scatter:
        by_exposure[r["exposure_id"]].append(r)
        meta.setdefault(r["exposure_id"], (r["Eid"], r["Category"]))

    trials = [("HERITAGE_effect", "HERITAGE"),
              ("GLP1_effect1", "GLP1_STEP1"),
              ("GLP1_effect2", "GLP1_STEP2")]
    out, pvals = [], defaultdict(list)
    for spec in sorted(specs):
        wv, kind, cov = what_varies(spec, man)
        table = specs[spec]
        for exposure, rows in by_exposure.items():
            eid, cat = meta[exposure]
            for tcol, tlab in trials:
                x, y, w = [], [], []
                n_pairs = 0
                for r in rows:
                    sp = table.get((exposure, r["protein"]))
                    if sp is None:
                        continue
                    b, t = num(sp.get("beta_test")), num(r.get(tcol))
                    if b is None or t is None:
                        continue
                    n_pairs += 1
                    wt = max(r_cross.get(r["protein"], mean_r), 0.0)
                    if wt <= 0:      # zero reliability contributes nothing
                        continue
                    x.append(b); y.append(t); w.append(wt)
                rw = neff = p = rp = rs = None
                if len(x) >= 3:
                    rw, neff = weighted_pearson(x, y, w)
                    rp, rs = pearson(x, y), spearman(x, y)
                    if rw is not None and neff is not None and neff > 2 and abs(rw) < 1:
                        tv = rw * math.sqrt((neff - 2) / max(1e-12, 1 - rw * rw))
                        p = t_two_sided_p(tv, neff - 2)
                idx = len(out)
                out.append([spec, kind, wv, exposure, eid, cat, tlab,
                            fmt(rw), fmt(p), "", fmt(neff), len(x), n_pairs,
                            fmt(rp), fmt(rs)])
                # FDR family = one per trial, restricted to interpretable
                # correlations (n_eff >= 8), exactly as the R pipeline does.
                if p is not None and neff is not None and neff >= MIN_NEFF:
                    pvals[(spec, tlab)].append((idx, p))
    for fam, items in pvals.items():
        for idx, q in bh(items).items():
            out[idx][9] = fmt(q)

    cols = ["spec", "spec_kind", "what_varies", "exposure_id", "Eid", "Category",
            "intervention", "r", "pval", "pval_BH", "n_eff", "n_proteins",
            "n_pairs_in_spec", "r_pearson_unweighted", "r_spearman"]
    dest = os.path.join(OUTD, "intervention_spec_correlations.tsv")
    with open(dest, "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(cols)
        w.writerows(out)
    print(f"  intervention_spec_correlations.tsv  {len(out):,} rows x {len(cols)} cols "
          f"({len(specs)} specs x {len(by_exposure)} exposures x 3 trials)")

    validate_against_published(out)


def validate_against_published(rows):
    """The recomputation must reproduce the published base-spec table. If it
    does not, the four other specs are not trustworthy either.

    The residual is expected to be ~1e-4, not 0: this reads the DEPOSIT's
    beta_test, which is rounded to 4 decimals, while the R pipeline correlated
    the unrounded in-memory estimates. Feeding beta_HEAP in instead reproduces
    the published r to ~1e-14, which is how the method was confirmed identical.
    The 0.02 abort threshold is far above rounding and far below any real
    methodological divergence."""
    path = os.path.join(SUPPORT, "intervention_correlations.tsv")
    if not os.path.exists(path):
        print("  !! intervention_correlations.tsv missing -- cannot validate",
              file=sys.stderr)
        return
    lab = {"HERITAGE_effect": "HERITAGE", "GLP1_effect1": "GLP1_STEP1",
           "GLP1_effect2": "GLP1_STEP2"}
    pub = {(r["exposure_id"], lab[r["intervention"]]): num(r["r"])
           for r in read_tsv(path)}
    diffs, unmatched = [], 0
    for r in rows:
        if r[0] != "base":
            continue
        target = pub.get((r[3], r[6]))
        mine = num(r[7])
        if target is None or mine is None:
            if target is None and mine is not None:
                unmatched += 1
            continue
        diffs.append(abs(mine - target))
    if not diffs:
        print("  !! no overlap with the published correlations -- not validated",
              file=sys.stderr)
        return
    print(f"  base spec vs published intervention_correlations.tsv: n={len(diffs)}  "
          f"median |dr| {statistics.median(diffs):.2e}  max |dr| {max(diffs):.2e}")
    print(f"      {unmatched} recomputed correlations have no published counterpart "
          f"(exposures the R pipeline dropped for having <3 replicated proteins)")
    if max(diffs) > 0.02:
        sys.exit("build_intervention_concordance: recomputed base correlations do not "
                 "match the published table; the spec variants would be misleading.")


if __name__ == "__main__":
    main()
