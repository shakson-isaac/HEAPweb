#!/usr/bin/env python3
"""
build_variance_views.py -- the redesigned Main results and Lifestyle categories.

Replaces a set of figure-export sections, one chart each, with four sections
that four interactive panels read:

  varcomp_reach      reach curves: how many proteins each component reaches at
                     or above a grid of variance thresholds, per specification
  varcomp_protein    per-protein unique R2 for the four components, with the
                     95% interval the deposit carries, per specification
  varcomp_gradient   GREML variance components beside the HEAP R2 they were
                     compared against -- main Figure 1b
  varcat_protein     per-protein R2 for each of the 13 exposure categories

WHY THESE ARE WHOLE-TABLE (S) AND NOT SHARDED. Three of the four panels plot
every protein at once -- a reach curve, a scatter of the proteome, a stacked bar
averaged over a group -- so sharding by protein would mean 2,686 requests to draw
one chart. Packed and gzipped these sit in the low hundreds of KB.

RIDGE IS EXCLUDED. Ridge does not select variables, so it has no unique
contribution to report: its genetic component reaches 0 proteins at R2 >= 0.01
where lasso reaches 936. That is the estimator being unable to answer the
question rather than a finding, and it is dropped here rather than filtered in
the browser so the payload never carries it.

ONLY THE UNIQUE DECOMPOSITION is carried. The deposit also holds nested model
totals (C, C+G, C+G+E, ...); they answer a different question and an earlier
draft that offered both behind one toggle invited reading one as the other.
"""
import bisect
import collections
import csv
import json
import os

OUT_ROOT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
DEPOSIT = os.path.join(OUT_ROOT, "supp_deposit")
GREML = os.path.join(OUT_ROOT, "population_architecture", "base", "grm_cutoff_0p025",
                     "concordance_greml_vs_heap_r2.tsv")
DERIVED = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "build", "derived")
os.makedirs(DERIVED, exist_ok=True)

COMPS = ["Covars", "G", "E", "GxE"]
GRID = [round(x / 400, 4) for x in range(0, 121)] + [0.35, 0.4, 0.45, 0.5, 0.6, 0.75]


def reach(vals):
    """Count at or above each grid point.

    Bisect over an ascending sort. A single pointer walked down a descending
    sort is wrong for an ascending grid -- it only moves forward, so once it has
    consumed the list at the lowest threshold every later threshold reports that
    same count and the curve comes out perfectly flat. Cross-validated R2 can be
    negative; those are genuinely below every grid point and are kept in the sort
    and never counted.
    """
    s = sorted(vals)
    return [len(s) - bisect.bisect_left(s, t) for t in GRID]


def rd(x, n=4):
    try:
        return round(float(x), n)
    except (TypeError, ValueError):
        return None


def read(path):
    with open(path, newline="") as fh:
        r = csv.reader(fh, delimiter="\t")
        head = next(r)
        idx = {c: i for i, c in enumerate(head)}
        for row in r:
            yield row, idx


def write(name, cols, rows):
    p = os.path.join(DERIVED, f"{name}.tsv")
    with open(p, "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(cols)
        w.writerows(rows)
    print(f"  {name}.tsv  {len(rows):,} rows  {os.path.getsize(p)/1e6:.1f} MB")


def main():
    per = collections.defaultdict(dict)      # (exp, comp) -> protein -> (r2, lo, hi)
    axes = {}
    for row, i in read(os.path.join(DEPOSIT, "varcomp_specs.tsv")):
        if row[i["estimator"]] == "ridge" or row[i["level"]] != "coarse":
            continue
        exp = row[i["experiment"]]
        per[(exp, row[i["component"]])][row[i["protein"]]] = (
            rd(row[i["r2"]]), rd(row[i["ci_lo"]]), rd(row[i["ci_hi"]]))
        # `sample_spec`, not `sample`: the deposit calls this column `sample` and
        # it holds "all" or "excl_prevalent" -- a SAMPLE SPECIFICATION, not a
        # participant sample. The publication gate flags a bare `sample` column
        # as a possible participant identifier, and it is right to: the name is
        # ambiguous enough that a reader could reasonably read it either way.
        axes.setdefault(exp, (row[i["covariate_set"]], row[i["estimator"]],
                              row[i["sample"]], row[i["interactions"]]))
    proteins = sorted({p for d in per.values() for p in d})
    print(f"  {len(axes)} specifications x {len(proteins):,} proteins")

    # 1. reach curves, long: one row per (spec, component, threshold)
    rows = []
    for (exp, comp), d in sorted(per.items()):
        counts = reach([v[0] for v in d.values() if v[0] is not None])
        for t, n in zip(GRID, counts):
            rows.append([exp, comp, t, n])
    write("varcomp_reach", ["spec", "component", "threshold", "n_proteins"], rows)

    # 2. per-protein, long: one row per (spec, protein, component)
    rows = []
    for (exp, comp), d in sorted(per.items()):
        for p, (v, lo, hi) in d.items():
            rows.append([exp, p, comp, v, lo, hi])
    write("varcomp_protein", ["spec", "protein", "component", "r2", "ci_lo", "ci_hi"], rows)

    # 3. the specification catalog, so a picker can label itself from the data
    write("varcomp_specs_meta", ["spec", "covariate_set", "estimator", "sample_spec", "interactions"],
          [[k] + list(v) for k, v in sorted(axes.items())])

    # 4. GREML beside HEAP -- Figure 1b's second panel. Base only: GREML was
    #    fitted once, multi-kernel, at GRM cutoff 0.025.
    if os.path.exists(GREML):
        rows = []
        for row, i in read(GREML):
            rows.append([row[i["protein"]], row[i["component"]],
                         rd(row[i["greml"]], 5), rd(row[i["greml_se"]], 5),
                         rd(row[i["r2"]], 5)])
        write("varcomp_gradient", ["protein", "component", "greml", "greml_se", "heap_r2"], rows)
    else:
        print("  varcomp_gradient SKIPPED -- no GREML concordance file")

    # 5. the 13 exposure categories, per protein per specification
    rows = []
    seen = collections.defaultdict(dict)
    for row, i in read(os.path.join(DEPOSIT, "varcomp_specs_fine.tsv")):
        if row[i["level"]] != "exposure_categories" or row[i["estimator"]] == "ridge":
            continue
        seen[(row[i["experiment"]], row[i["component"]])][row[i["protein"]]] = rd(row[i["r2"]])
    for (exp, cat), d in sorted(seen.items()):
        for p, v in d.items():
            rows.append([exp, p, cat, v])
    write("varcat_protein", ["spec", "protein", "category", "r2"], rows)

    # 6. category reach, so the ranked chart needs no client-side sweep
    rows = []
    for (exp, cat), d in sorted(seen.items()):
        counts = reach([v for v in d.values() if v is not None])
        for t, n in zip(GRID, counts):
            rows.append([exp, cat, t, n])
    write("varcat_reach", ["spec", "category", "threshold", "n_proteins"], rows)


if __name__ == "__main__":
    main()
