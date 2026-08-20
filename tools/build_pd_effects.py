#!/usr/bin/env python3
"""Protein -> disease: the MR estimate and the observational estimate together.

The panel this replaces was titled "Protein -> disease MR priority" but carried
only Cox survival quantities (protein_HR, cox_cindex, mediator_adjR2) from the
mediation module -- no MR estimate anywhere in it. This joins the two so the gap
between them is visible, which is the actual finding: most proteins associate
with disease observationally and do not survive MR.

  MR side          $HEAP_OUTPUT/mr_edges/summary/mr_sensitivity_long.tsv
                   (Pcis_to_D + Ptrans_to_D; b, se, pval_adj, tier, PP.H4)
  observational    figures/website/fig_mr_priority.json (Cox HR per protein x disease)

The two speak different disease vocabularies -- MR uses FinnGen R12 endpoints,
the Cox models use UK Biobank first-occurrence fields -- so they are bridged
through the Disease/Disease_UKB/ICD10 crosswalk carried in mr_triads_wide.tsv.
Pairs present on only one side are kept, with the missing side blank: a protein
with an observational hit and no MR estimate is exactly what the panel is for.
"""
import csv, json, os, re, sys
from collections import defaultdict

HEAP_OUT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
FIGDIR = "/n/groups/patel/IGLOO/UKB/HEAP/figures/website"
SUM = os.path.join(HEAP_OUT, "mr_edges", "summary")
WIDE = os.path.join(SUM, "supp", "mr_triads_wide.tsv")
SENS = os.path.join(SUM, "mr_sensitivity_long.tsv")
PRIO = os.path.join(FIGDIR, "fig_mr_priority.json")
# Profile-likelihood CIs for the observational HR. Module 3 computes them but
# MR_priority_table drops them; HEAP/scripts/analysis_summaries/export_protein_hr_ci.R
# carries them out and asserts its protein_HR reproduces the shipped one, so the
# interval and the point estimate come from the same Cox fit.
HRCI = os.path.join(HEAP_OUT, "module3", "summary", "protein_hr_ci.tsv")
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def main():
    for p in (WIDE, SENS, PRIO):
        if not os.path.exists(p):
            sys.exit(f"build_pd_effects: missing {p}")
    os.makedirs(OUTD, exist_ok=True)

    # --- disease crosswalk ---------------------------------------------------
    fg2ukb, fg2icd, ukb2fg = {}, {}, {}
    with open(WIDE) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            fg, ukb = r["Disease"], r["Disease_UKB"]
            fg2ukb[fg] = ukb
            fg2icd[fg] = r.get("ICD10", "")
            ukb2fg[ukb] = fg

    # --- MR side -------------------------------------------------------------
    # cis and trans kept apart: they are different instruments for the same
    # edge, and Tier 1 is cis-only in practice, so collapsing them would hide
    # which instrument carried the evidence.
    mr = defaultdict(dict)
    with open(SENS) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            # UKB panel only. The top-level summary file happens to hold just
            # UKB (deCODE lives in summary/DECODE/), but assert it rather than
            # rely on that: silently averaging two instrument panels into one
            # estimate is exactly the kind of error that still looks plausible.
            if r["dataset"] != "UKB":
                continue
            d = r["edge_dir"]
            if d not in ("Pcis_to_D", "Ptrans_to_D"):
                continue
            cls = "cis" if d == "Pcis_to_D" else "trans"
            mr[(r["src_id"], r["tgt_id"])][cls] = r

    # --- observational side --------------------------------------------------
    # (protID, DZ_ID) -> (l95, u95)
    hrci = {}
    if os.path.exists(HRCI):
        with open(HRCI) as fh:
            for r in csv.DictReader(fh, delimiter="\t"):
                if r.get("has_ci") in ("TRUE", "True", "1"):
                    hrci[(r["protID"], r["DZ_ID"])] = (r["protein_HR_l95"],
                                                       r["protein_HR_u95"])
    else:
        print(f"  !! no {HRCI}; hazard ratios will ship without intervals",
              file=sys.stderr)

    with open(PRIO) as fh:
        pri = json.load(fh)
    pri = pri if isinstance(pri, list) else pri.get("data", pri)
    obs, label_of = {}, {}
    for r in pri:
        fg = ukb2fg.get(r["DZ_ID"])
        if fg is None:
            continue                       # disease not in any tested triad
        # Label every disease seen anywhere in the Cox export, not only the
        # pairs that matched this protein: an MR-only row still needs a
        # readable name, and falling back to the raw endpoint id would show
        # readers "finngen_R12_T2D" where the panel means type 2 diabetes.
        label_of.setdefault(fg, r.get("Disease_label") or fg)
        obs[(r["protID"], fg)] = r

    # Last resort: derive a name from the UK Biobank field. These are of the
    # form age_<icd>_first_reported_<words>_f<field>_0_0.
    def from_ukb(ukb):
        t = re.sub(r"^age_[a-z0-9]+_first_reported_", "", ukb or "")
        t = re.sub(r"_f\d+_\d+_\d+$", "", t)
        return t.replace("_", " ").strip()

    # And for endpoints with no UK Biobank counterpart at all, read the FinnGen
    # code itself: finngen_R12_G6_PARKINSON -> "parkinson". The leading token is
    # FinnGen's chapter prefix, not part of the name.
    def from_finngen(fg):
        t = re.sub(r"^finngen_R12_", "", fg)
        t = re.sub(r"^[A-Z]+\d*_", "", t)
        t = re.sub(r"_AND\d+_", "_and_", t)
        return t.replace("_", " ").strip().lower()

    for fg, ukb in fg2ukb.items():
        if not label_of.get(fg):
            label_of[fg] = from_ukb(ukb) or from_finngen(fg)
    # endpoints that never appear in the crosswalk (MR-only, no UKB field)
    for (_, fg) in list(mr):
        if not label_of.get(fg):
            label_of[fg] = from_finngen(fg)

    # Protein-first: the panel answers "which diseases can THIS protein
    # influence", so it is scoped to proteins that were actually instrumented
    # for MR. Including the ~1,900 proteins with only Cox associations would
    # bury the MR signal under observational rows that can never be graded.
    mr_proteins = {p for p, _ in mr}
    pairs = sorted({k for k in (set(mr) | set(obs)) if k[0] in mr_proteins})
    COLS = ["protID", "disease", "disease_ukb", "disease_label", "icd10",
            "mr_b_cis", "mr_se_cis", "mr_padj_cis", "mr_tier_cis", "mr_nsnp_cis",
            "coloc_pph4_cis",
            "mr_b_trans", "mr_se_trans", "mr_padj_trans", "mr_tier_trans",
            "mr_nsnp_trans",
            "obs_HR", "obs_HR_l95", "obs_HR_u95", "obs_p", "obs_neglog10p",
            "n_cases", "cox_cindex",
            "has_mr", "has_obs", "mr_hit"]

    n_both = n_mr_only = n_obs_only = n_hit = n_ci = 0
    with open(os.path.join(OUTD, "mr_pd_effects.tsv"), "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(COLS)
        for (prot, fg) in pairs:
            m = mr.get((prot, fg), {})
            o = obs.get((prot, fg))
            c, t = m.get("cis"), m.get("trans")
            hit = any((x or {}).get("mr_hit") in ("TRUE", "1", "True")
                      for x in (c, t))
            has_mr, has_obs = bool(m), o is not None
            n_both += has_mr and has_obs
            n_mr_only += has_mr and not has_obs
            n_obs_only += has_obs and not has_mr
            n_hit += hit
            n_ci += bool(o and (prot, o["DZ_ID"]) in hrci)
            g = lambda d, k: (d or {}).get(k, "")
            w.writerow([
                prot, fg, fg2ukb.get(fg, ""), label_of.get(fg, fg), fg2icd.get(fg, ""),
                g(c, "b"), g(c, "se"), g(c, "pval_adj"), g(c, "mr_tier"),
                g(c, "nsnp"), g(c, "PP_H4"),
                g(t, "b"), g(t, "se"), g(t, "pval_adj"), g(t, "mr_tier"),
                g(t, "nsnp"),
                g(o, "protein_HR"),
                *(hrci.get((prot, o["DZ_ID"]), ("", "")) if o else ("", "")),
                g(o, "protein_p"), g(o, "neglog10p"),
                g(o, "n_cases"), g(o, "cox_cindex"),
                "TRUE" if has_mr else "FALSE",
                "TRUE" if has_obs else "FALSE",
                "TRUE" if hit else "FALSE",
            ])

    print(f"  mr_pd_effects.tsv  {len(pairs):,} protein x disease pairs")
    print(f"      both sides   {n_both:,}")
    print(f"      MR only      {n_mr_only:,}")
    print(f"      obs only     {n_obs_only:,}")
    print(f"      MR hits      {n_hit:,}")
    print(f"      HR with CI   {n_ci:,}")
    print(f"      proteins     {len({p for p, _ in pairs}):,}")

if __name__ == "__main__":
    main()
