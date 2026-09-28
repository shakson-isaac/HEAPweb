#!/usr/bin/env python3
"""PES disease prediction, every exposure x disease pair, across covariate specs.

The page previously showed 14 diseases from a figure export. The supplementary
deposit carries the real grid: 165 exposures x 170 diseases = 28,050 pairs, with
hazard ratios and confidence intervals, held-out C-indices for four nested
models, and bootstrap intervals.

  pes_disease_lookup.tsv        base spec, 51 columns (held-out + bootstrap)
  pes_disease_specs/<spec>.tsv  4 further specs, 18 columns

TWO THINGS THIS KEEPS STRAIGHT.

1. The specs do NOT all mean the same thing. Three vary the Cox adjustment only,
   leaving the score itself untouched; base_exclprev restricts the sample AND
   retrains the score on that subset. The deposit's own manifest says so, and
   `what_varies` is carried through to the payload so the page can too.

2. The base spec has HELD-OUT dC with bootstrap intervals; the other four carry
   only APPARENT dC, which is biased toward zero. They are therefore NOT
   comparable, and apparent values are emitted under their own column name so a
   plot cannot silently mix them. The metric that IS comparable across all five
   is the hazard ratio with its CI, which every spec provides.
"""
import csv, json, os, sys
from collections import defaultdict

DEP = os.environ.get(
    "HEAP_DEPOSIT", "/n/groups/patel/IGLOO/UKB/HEAP/output/supp_deposit")
LOOKUP = os.path.join(DEP, "pes_disease_lookup.tsv")
SPECDIR = os.path.join(DEP, "pes_disease_specs")
READS = os.path.join(DEP, "pes_read_specs.tsv")
OUTD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "build", "derived")

COLS = [
    "spec", "what_varies", "exposure_id", "category", "disease_id",
    "disease_label", "in_main_figure", "n", "events",
    # comparable across every spec
    "hr_pes", "hr_pes_lo", "hr_pes_hi", "q_pes",
    "hr_beyond_selfreport", "hr_beyond_selfreport_lo", "hr_beyond_selfreport_hi",
    "q_beyond_selfreport",
    # base only: held-out, with bootstrap intervals
    "dC_over_cov", "dC_over_cov_lo", "dC_over_cov_hi", "dC_over_cov_pgt0",
    "dC_beyond_selfreport", "dC_beyond_selfreport_lo", "dC_beyond_selfreport_hi",
    "dC_beyond_selfreport_pgt0",
    "C_cov", "C_cov_pes", "C_cov_selfreport", "C_cov_selfreport_pes",
    # other specs only: apparent, biased toward zero -- never mix with the above
    "dC_over_cov_apparent", "dC_beyond_selfreport_apparent",
    # TRUE when this row's dC columns are held-out rather than apparent. Read
    # this instead of testing spec == "base": base_exclprev is ALSO scored
    # held-out, and a spec-name rule silently hid it.
    "dc_is_heldout",
]


def main():
    for p in (LOOKUP, SPECDIR, READS):
        if not os.path.exists(p):
            sys.exit(f"build_pes_disease: missing {p}")
    os.makedirs(OUTD, exist_ok=True)

    # category comes from the reads deposit; the disease tables do not carry it
    cat = {}
    with open(READS) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            cat.setdefault(r["exposure_id"], r.get("category", ""))

    what = {}
    man = os.path.join(SPECDIR, "manifest.tsv")
    if os.path.exists(man):
        with open(man) as fh:
            for r in csv.DictReader(fh, delimiter="\t"):
                what[r["specification"]] = r.get("what_varies", "")

    g = lambda r, k: (r.get(k) or "")
    rows = []
    # Base names diseases with a pretty label; the spec files use the raw UK
    # Biobank field. They join on disease_field_id -- 170 to 170, exactly. Keying
    # on the label instead silently unions to 340 "diseases" and a spec picker
    # then shows a different disease list per spec.
    dz_label, in_fig = {}, {}

    with open(LOOKUP) as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            did = g(r, "disease_field_id")
            dz_label[did] = r["disease_label"]
            in_fig[(r["exposure_id"], did)] = g(r, "in_main_figure")
            rows.append([
                "base", "reference", r["exposure_id"], cat.get(r["exposure_id"], ""),
                did, r["disease_label"], g(r, "in_main_figure"),
                g(r, "n"), g(r, "events"),
                g(r, "hr_pes"), g(r, "hr_pes_lo"), g(r, "hr_pes_hi"), g(r, "q_pes"),
                g(r, "hr_pes_beyond_selfreport"), g(r, "hr_pes_beyond_selfreport_lo"),
                g(r, "hr_pes_beyond_selfreport_hi"), g(r, "q_pes_beyond_selfreport"),
                g(r, "dC_over_covariates_heldout"), g(r, "dC_over_covariates_heldout_lo"),
                g(r, "dC_over_covariates_heldout_hi"), g(r, "dC_over_covariates_heldout_pgt0"),
                g(r, "dC_beyond_selfreport_heldout"), g(r, "dC_beyond_selfreport_heldout_lo"),
                g(r, "dC_beyond_selfreport_heldout_hi"), g(r, "dC_beyond_selfreport_heldout_pgt0"),
                g(r, "C_covariates_heldout"), g(r, "C_covariates_pes_heldout"),
                g(r, "C_covariates_selfreport_heldout"),
                g(r, "C_covariates_selfreport_pes_heldout"),
                "", "", "TRUE",
            ])

    n_base = len(rows)
    for f in sorted(os.listdir(SPECDIR)):
        if not f.endswith(".tsv") or f == "manifest.tsv":
            continue
        spec = f[:-4]
        with open(os.path.join(SPECDIR, f)) as fh:
            for r in csv.DictReader(fh, delimiter="\t"):
                # base_exclprev is scored HELD-OUT (dC_overcov_ho, C0_ho...),
                # unlike the three adjustment-only specs which carry apparent
                # dC. It is the spec that actually retrains, so its dC belongs
                # beside base's -- reading only *_app emitted nothing for it and
                # buried the one comparable non-base estimate.
                ho = "dC_overcov_ho" in r
                rows.append([
                    spec, what.get(spec, ""), r["exposure_id"],
                    cat.get(r["exposure_id"], ""), r["disease"],
                    dz_label.get(r["disease"], r["disease"]),
                    in_fig.get((r["exposure_id"], r["disease"]), ""),
                    g(r, "n"), g(r, "events"),
                    g(r, "hr_pes"), g(r, "hr_pes_lo"), g(r, "hr_pes_hi"), g(r, "q_pes"),
                    g(r, "hr_pesE"), g(r, "hr_pesE_lo"), g(r, "hr_pesE_hi"),
                    g(r, "q_pesE"),
                    # held-out dC, no bootstrap interval for this spec
                    g(r, "dC_overcov_ho"), "", "", "",
                    g(r, "dC_beyondE_ho"), "", "", "",
                    g(r, "C0_ho"), g(r, "CP_ho"), g(r, "CE_ho"), g(r, "CEP_ho"),
                    g(r, "dC_overcov_app"), g(r, "dC_beyondE_app"),
                    "TRUE" if ho else "FALSE",
                ])

    dest = os.path.join(OUTD, "pes_disease.tsv")
    with open(dest, "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(COLS)
        w.writerows(rows)

    specs = defaultdict(int)
    for r in rows:
        specs[r[0]] += 1
    exps = {r[2] for r in rows}
    dz = {r[4] for r in rows}
    unlabelled = sum(1 for r in rows if not r[5])
    print(f"  pes_disease.tsv  {len(rows):,} rows")
    print(f"      exposures {len(exps)}  diseases {len(dz)}")
    for s, n in sorted(specs.items()):
        ho = sum(1 for r in rows if r[0] == s and r[-1] == "TRUE")
        tag = ("held-out + bootstrap" if s == "base"
               else "held-out, no CI" if ho else "apparent dC only")
        print(f"      {s:16s} {n:7,}  ({tag})")
    print(f"      per-exposure shard ~{len(rows)//max(1,len(exps))} rows")
    # base_exclprev restricts the sample and refits, so which exposures fit at
    # all differs slightly from base. That is the spec working as intended, not
    # a join failure -- say so, or the exposure count looks wrong.
    base_exp = {r[2] for r in rows if r[0] == "base"}
    for s_ in sorted(specs):
        if s_ == "base":
            continue
        se = {r[2] for r in rows if r[0] == s_}
        if se != base_exp:
            print(f"      note: {s_} has {len(se - base_exp)} exposure(s) base lacks, "
                  f"and lacks {len(base_exp - se)} of base's (sample refit)")
    if unlabelled:
        print(f"  !! {unlabelled:,} row(s) have no disease label - the join is off",
              file=sys.stderr)


if __name__ == "__main__":
    main()
