#!/usr/bin/env python3
"""
build_mockup_data.py -- data for the three redesigned primary visuals.

SCRATCH, NOT PAYLOAD. Writes into heap/frontend/public/mockup/, which the dev
server serves directly, so the three designs can be looked at and argued with
before anything is registered in web_sections.tsv or pushed to the bucket. If a
design is kept, its data moves to a real builder and a real section; if it is
dropped, deleting this directory costs nothing.

Sources, all from the supplementary deposit (aggregates, never participants):
  varcomp_specs.tsv         10 experiments x 2 levels x 4 components x 2,686 proteins
  varcomp_specs_fine.tsv    the same experiments, split into 13 exposure categories
  med_specs_exposome/*.tsv  7 specifications x ~451k exposure->protein->disease links
"""
import bisect
import collections
import csv
import json
import os
import statistics as st

DEPOSIT = os.path.join(os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output"),
                       "supp_deposit")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "heap", "frontend", "public", "mockup")
os.makedirs(OUT, exist_ok=True)

# The reach curve is "how many proteins does this component reach at or above x".
# A fixed grid is used rather than the empirical values so every experiment and
# component is directly comparable and the payload is a fixed size.
GRID = [round(x / 400, 4) for x in range(0, 121)] + [0.35, 0.4, 0.45, 0.5, 0.6, 0.75]


def reach(vals):
    """Count of values at or above each grid point.

    Done with a bisect over an ASCENDING sort. The obvious single-pass version
    -- walk a pointer down a descending sort, advancing while the value clears
    the threshold -- is wrong for an ascending grid: the pointer only ever moves
    forward, so once it has consumed the list at the lowest threshold it never
    rewinds and every later threshold reports that same count. That produced a
    perfectly flat reach curve, which is why this is spelled out rather than
    re-derived by whoever reads it next.

    Note cross-validated R2 can be NEGATIVE, and those values are genuinely
    below every grid point rather than missing, so they are kept in the sort and
    simply never counted.
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


# ---------------------------------------------------------------------------
# 1. Variance partitioning
# ---------------------------------------------------------------------------
def build_variance():
    per = collections.defaultdict(dict)     # (exp, comp) -> protein -> (r2, lo, hi)
    axes = {}
    for row, i in read(os.path.join(DEPOSIT, "varcomp_specs.tsv")):
        exp, lev, comp, prot = row[i["experiment"]], row[i["level"]], row[i["component"]], row[i["protein"]]
        # RIDGE IS EXCLUDED, not hidden. Ridge does not do variable selection, so
        # it never drives a coefficient to zero and there is no such thing as a
        # component's UNIQUE contribution under it: the genetic component reaches
        # 0 proteins at R2 >= 0.01 against 936 under lasso, and GxE reaches 2
        # against 413. Those are not weak findings to be reported cautiously,
        # they are the estimator being unable to answer the question. Elastic net
        # does select, behaves like lasso (872 for G), and is kept.
        if row[i["estimator"]] == "ridge":
            continue
        # Only the UNIQUE decomposition is carried. The nested model totals
        # answer a different question -- how much a growing model explains -- and
        # putting the two behind one toggle invited reading one as the other.
        if lev != "coarse":
            continue
        per[(exp, comp)][prot] = (rd(row[i["r2"]]), rd(row[i["ci_lo"]]), rd(row[i["ci_hi"]]))
        axes.setdefault(exp, {
            "covariate_set": row[i["covariate_set"]], "estimator": row[i["estimator"]],
            "sample": row[i["sample"]], "interactions": row[i["interactions"]],
        })
    proteins = sorted({p for d in per.values() for p in d})
    pidx = {p: k for k, p in enumerate(proteins)}
    out = {"grid": GRID, "proteins": proteins, "experiments": axes, "reach": {}, "r2": {}, "ci": {}}
    for (exp, comp), d in per.items():
        key = f"{exp}|{comp}"
        arr = [None] * len(proteins)
        lo = [None] * len(proteins)
        hi = [None] * len(proteins)
        for p, (v, a, b) in d.items():
            arr[pidx[p]] = v
            lo[pidx[p]] = a
            hi[pidx[p]] = b
        out["reach"][key] = reach([v for v in arr if v is not None])
        out["r2"][key] = arr
        out["ci"][key] = [lo, hi]
    p = os.path.join(OUT, "variance.json")
    json.dump(out, open(p, "w"), separators=(",", ":"))
    print(f"  variance.json     {os.path.getsize(p)/1e6:5.1f} MB  "
          f"{len(axes)} experiments x {len(proteins):,} proteins")


# ---------------------------------------------------------------------------
# 2. Exposure categories
# ---------------------------------------------------------------------------
def build_categories():
    per = collections.defaultdict(dict)
    axes = {}
    for row, i in read(os.path.join(DEPOSIT, "varcomp_specs_fine.tsv")):
        if row[i["level"]] != "exposure_categories":
            continue
        exp = row[i["experiment"]]
        if row[i["estimator"]] == "ridge":
            continue
        per[(exp, row[i["component"]])][row[i["protein"]]] = rd(row[i["r2"]])
        # Carried so the picker can label a specification from the data rather
        # than by pattern-matching its name in the component.
        axes.setdefault(exp, {
            "covariate_set": row[i["covariate_set"]], "estimator": row[i["estimator"]],
            "sample": row[i["sample"]], "interactions": row[i["interactions"]],
        })
    cats = sorted({c for _, c in per})
    proteins = sorted({p for d in per.values() for p in d})
    pidx = {p: k for k, p in enumerate(proteins)}
    out = {"grid": GRID, "categories": cats, "proteins": proteins, "experiments": axes,
           "reach": {}, "r2": {}, "summary": {}}
    for (exp, cat), d in per.items():
        key = f"{exp}|{cat}"
        arr = [None] * len(proteins)
        for p, v in d.items():
            arr[pidx[p]] = v
        vals = [v for v in arr if v is not None]
        out["reach"][key] = reach(vals)
        out["r2"][key] = arr
        nz = [v for v in vals if v > 0]
        out["summary"][key] = {
            "n": len(vals),
            "n_reached": sum(1 for v in vals if v >= 0.01),
            "median_nonzero": round(st.median(nz), 5) if nz else 0,
            "max": max(vals) if vals else 0,
        }
    p = os.path.join(OUT, "categories.json")
    json.dump(out, open(p, "w"), separators=(",", ":"))
    print(f"  categories.json   {os.path.getsize(p)/1e6:5.1f} MB  "
          f"{len(cats)} categories x {len(proteins):,} proteins")


# ---------------------------------------------------------------------------
# 3. Mediation
# ---------------------------------------------------------------------------
def build_mediation():
    specs, links, summary = [], {}, {}
    d = os.path.join(DEPOSIT, "med_specs_exposome")
    man = {r[0]: r for r, _ in read(os.path.join(d, "manifest.tsv"))}
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".tsv") or fn == "manifest.tsv":
            continue
        # Ridge is excluded here for consistency with the variance views, where
        # it cannot express a unique contribution at all. It is not degenerate in
        # the mediation fit -- it gives 23,189 significant links against 22,270
        # under the primary model -- but offering an estimator on one page and
        # withholding it on another is worse than a uniform rule.
        if "ridge" in fn:
            continue
        spec = fn[:-4]
        specs.append(spec)
        rows = []
        per_dz = collections.Counter()
        per_cat = collections.Counter()
        pm = []
        for row, i in read(os.path.join(d, fn)):
            if row[i["sig"]] not in ("TRUE", "True", "1"):
                continue
            dz, cat = row[i["disease"]], row[i["exposure_category"]]
            per_dz[dz] += 1
            per_cat[cat] += 1
            v = rd(row[i["prop_mediated"]], 4)
            if v is not None:
                pm.append(v)
            rows.append([cat, row[i["protID"]], dz, rd(row[i["nie_HR"]]), rd(row[i["nie_l95"]]),
                         rd(row[i["nie_u95"]]), v, int(row[i["n_cases"]] or 0)])
        links[spec] = rows
        summary[spec] = {
            "n_sig": len(rows),
            "n_disease": len(per_dz),
            "n_protein": len({r[1] for r in rows}),
            "by_disease": per_dz.most_common(),
            "by_category": per_cat.most_common(),
            "pm_median": round(st.median(pm), 4) if pm else None,
            "spec_kind": man.get(fn, ["", "", ""])[2] if fn in man else "",
        }
        print(f"    {spec:28s} {len(rows):6,} significant links")
    out = {"specs": specs, "summary": summary, "links": links,
           "cols": ["category", "protein", "disease", "nie_HR", "lo", "hi", "prop_mediated", "n_cases"]}
    p = os.path.join(OUT, "mediation.json")
    json.dump(out, open(p, "w"), separators=(",", ":"))
    print(f"  mediation.json    {os.path.getsize(p)/1e6:5.1f} MB  {len(specs)} specifications")


# ---------------------------------------------------------------------------
# 4. Genetic vs exposomic mediation -- the GEM landscape
# ---------------------------------------------------------------------------
def build_gem():
    """Pair each (protein, disease) link's EXPOSOMIC and GENETIC indirect effect.

    Both deposits score the same grid of 451,520 protein-disease links, each with
    a single total driver -- PXS_total on the exposome side, PGS_total on the
    genetic side -- so the two join 1:1 with no aggregation and no choice to make.

    Only pairs significant on at least one side are kept. Shipping all 451,520
    would be 30x the size to draw a cloud at the origin, and a pair significant
    on neither side says nothing about which route dominates.
    """
    out = {"specs": [], "pairs": {},
           "cols": ["protein", "disease", "e_HR", "g_HR", "e_sig", "g_sig", "n_cases"]}
    ed = os.path.join(DEPOSIT, "med_specs_exposome")
    gd = os.path.join(DEPOSIT, "med_specs_genetic")
    for fn in sorted(os.listdir(ed)):
        if not fn.endswith(".tsv") or fn == "manifest.tsv" or "ridge" in fn:
            continue
        if not os.path.exists(os.path.join(gd, fn)):
            continue
        spec = fn[:-4]
        gen = {}
        for row, i in read(os.path.join(gd, fn)):
            gen[(row[i["protID"]], row[i["disease"]])] = (
                rd(row[i["nie_HR"]]), row[i["sig"]] in ("TRUE", "True", "1"))
        rows = []
        for row, i in read(os.path.join(ed, fn)):
            key = (row[i["protID"]], row[i["disease"]])
            esig = row[i["sig"]] in ("TRUE", "True", "1")
            ghr, gsig = gen.get(key, (None, False))
            if not esig and not gsig:
                continue
            rows.append([key[0], key[1], rd(row[i["nie_HR"]]), ghr,
                         1 if esig else 0, 1 if gsig else 0, int(row[i["n_cases"]] or 0)])
        out["specs"].append(spec)
        out["pairs"][spec] = rows
        both = sum(1 for r in rows if r[4] and r[5])
        print(f"    {spec:28s} {len(rows):6,} pairs  ({both:,} significant on both sides)")
    p = os.path.join(OUT, "gem.json")
    json.dump(out, open(p, "w"), separators=(",", ":"))
    print(f"  gem.json          {os.path.getsize(p)/1e6:5.1f} MB  {len(out['specs'])} specifications")


# ---------------------------------------------------------------------------
# 5. GREML variance components -- the independent-method companion to Fig 1b
# ---------------------------------------------------------------------------
def build_greml():
    """GREML variance components, and the HEAP R2 they were compared against.

    BASE ONLY, and that is a property of the analysis rather than a shortcut:
    GREML was fitted once, multi-kernel, at GRM cutoff 0.025. There is no +BMI
    GREML to switch to, so the panel that shows it says so instead of offering a
    picker that would do nothing.

    The 2,051 proteins here are the ones with GREML estimates, and restricting
    the HEAP panel to the same set is what makes the two panels comparable --
    it also reproduces the published counts exactly, 608 exposure-responsive by
    HEAP and 1,026 by GREML, which is the check that this is the same data the
    figure was drawn from.
    """
    src = os.path.join(os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output"),
                       "population_architecture", "base", "grm_cutoff_0p025",
                       "concordance_greml_vs_heap_r2.tsv")
    if not os.path.exists(src):
        print("  greml.json        skipped -- no concordance file")
        return
    by = collections.defaultdict(dict)
    for row, i in read(src):
        by[row[i["protein"]]][row[i["component"]]] = (
            rd(row[i["greml"]], 5), rd(row[i["greml_se"]], 5), rd(row[i["r2"]], 5))
    prots = sorted(by)
    out = {"proteins": prots, "components": ["G", "E", "GxE"], "greml": {}, "se": {}, "heap_r2": {}}
    for c in out["components"]:
        out["greml"][c] = [by[p].get(c, (None,))[0] for p in prots]
        out["se"][c] = [by[p].get(c, (None, None))[1] if c in by[p] else None for p in prots]
        out["heap_r2"][c] = [by[p][c][2] if c in by[p] else None for p in prots]
    p_out = os.path.join(OUT, "greml.json")
    json.dump(out, open(p_out, "w"), separators=(",", ":"))
    nh = sum(1 for v in out["heap_r2"]["E"] if v is not None and v >= 0.01)
    ng = sum(1 for v in out["greml"]["E"] if v is not None and v >= 0.01)
    print(f"  greml.json        {os.path.getsize(p_out)/1e6:5.1f} MB  {len(prots):,} proteins  "
          f"| exposure-responsive: HEAP {nh} (published 608), GREML {ng} (published 1026)")


# ---------------------------------------------------------------------------
# 6. Mediation structure -- the two panels of main Figure 3
# ---------------------------------------------------------------------------
def partitioned_specs():
    """Specifications with a partitioned run summarised, in reporting order.

    Discovered from disk rather than listed, because three more arrays are in
    flight and this should pick them up the moment their deposits land without
    another edit here.

    base reads the top-level deposit filenames; every other specification reads
    supp_deposit/med_specs_partitioned/<spec>/ -- the split that keeps a
    sensitivity from overwriting cited supplementary data.
    """
    out = [("base", DEPOSIT,
            os.path.join(os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output"),
                         "figures", "exploratory", "module3",
                         "disease_mediators.tsv").replace("/output/figures/", "/figures/"))]
    root = os.path.join(DEPOSIT, "med_specs_partitioned")
    ex = os.path.join(os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output"),
                      "figures", "exploratory", "module3").replace("/output/figures/", "/figures/")
    for spec in ["base_bmi", "base_clinical", "base_draw", "base_exclprev"]:
        d = os.path.join(root, spec)
        if os.path.exists(os.path.join(d, "med_exposure_categories.tsv")):
            out.append((spec, d, os.path.join(ex, f"disease_mediators_{spec}.tsv")))
    return out


def build_mediation_structure():
    """Fig 3c (the pleiotropy spectrum) and Fig 3b (the category x disease grid),
    for every specification that has a partitioned run summarised.

    `pleiotropy` is read from disease_mediators*.tsv rather than recomputed.
    Deriving it here by counting significant diseases in the category deposit
    gave 336 disease-specific proteins where the figure has 325: that script
    also drops links with fewer than 100 cases and requires a sign-consistent
    proportion mediated. Reading its output reproduces 325 and 303 exactly.
    """
    out = {"specs": [], "spectrum_by_spec": {}, "grid_by_spec": {}, "system": {}}
    dz_system = {}

    for spec, dep, ex in partitioned_specs():
        got = False

        if os.path.exists(ex):
            per = collections.defaultdict(lambda: {"pl": None, "eff": 0.0, "cats": set(),
                                                   "dz": set(), "sys": collections.Counter()})
            for row, i in read(ex):
                b = per[row[i["protID"]]]
                try:
                    b["pl"] = int(float(row[i["pleiotropy"]]))
                except (TypeError, ValueError):
                    pass
                try:
                    b["eff"] = max(b["eff"], abs(float(row[i["dom_NIE"]]) - 1) * 100)
                except (TypeError, ValueError):
                    pass
                b["cats"].add(row[i["dom_cat"]])
                b["dz"].add(row[i["disease"]])
                b["sys"][row[i["system"]]] += 1
                dz_system.setdefault(row[i["disease"]], row[i["system"]])
            prots = sorted(per)
            out["spectrum_by_spec"][spec] = {
                "proteins": prots,
                "pleiotropy": [per[p]["pl"] for p in prots],
                "max_eff": [round(per[p]["eff"], 4) for p in prots],
                "n_exposures": [len(per[p]["cats"]) for p in prots],
                "diseases": [sorted(per[p]["dz"])[:40] for p in prots],
            }
            nsp = sum(1 for p in prots if (per[p]["pl"] or 0) <= 3)
            nhub = sum(1 for p in prots if (per[p]["pl"] or 0) >= 20)
            print(f"    spectrum {spec:16s} {len(prots):5,} proteins | "
                  f"specific {nsp:4d} | hub {nhub:4d}")
            got = True

        cat = os.path.join(dep, "med_exposure_categories.tsv")
        if os.path.exists(cat):
            grid = collections.defaultdict(set)
            for row, i in read(cat):
                if row[i["sig"]] != "TRUE":
                    continue
                grid[(row[i["exposure_category"]], row[i["disease"]])].add(row[i["protID"]])
            cats = sorted({k[0] for k in grid})
            dzs = sorted({k[1] for k in grid})
            out["grid_by_spec"][spec] = {
                "categories": cats, "diseases": dzs,
                "counts": {f"{c}|{d}": len(grid[(c, d)]) for (c, d) in grid},
                "proteins": {f"{c}|{d}": sorted(grid[(c, d)])[:60] for (c, d) in grid},
            }
            print(f"    grid     {spec:16s} {len(cats)} categories x {len(dzs)} diseases, "
                  f"{sum(len(v) for v in grid.values()):,} links")
            got = True

        if got and spec not in out["specs"]:
            out["specs"].append(spec)

    # Disease class, so the grid can be sectioned the way Figure 3b is. Pooled
    # across specifications: the class of a disease does not depend on the model.
    out["system"] = dz_system

    p_out = os.path.join(OUT, "med_structure.json")
    json.dump(out, open(p_out, "w"), separators=(",", ":"))
    print(f"  med_structure.json {os.path.getsize(p_out)/1e6:5.1f} MB  "
          f"specs: {', '.join(out['specs'])}")


# The five specifications this site shows everywhere else.
SITE_SPECS = ["base", "base_plus_bmi", "base_plus_clinical", "base_plus_blood_draw",
              "exclude_prevalent_disease"]


# ---------------------------------------------------------------------------
# 7. Pleiotropy across specifications, and the cis/trans driver comparison
# ---------------------------------------------------------------------------
def build_spectrum_specs():
    """Per-protein pleiotropy and strongest mediated effect, for the five specs.

    THE DRIVER IS NOT THE SAME AS THE PRINTED PANEL, and the difference is not
    small. Figure 3c counts, for each protein, the diseases mediated by its
    DOMINANT exposure category, taken from the per-category deposit -- 325
    disease-specific and 303 pleiotropic. Only the PXS_total arm was refitted
    under the other specifications, so a spec-aware version has to count diseases
    mediated by the TOTAL exposome score instead, which at base gives 361 and
    438. Neither is wrong; they answer different questions, and the component
    labels which one is on screen rather than letting the numbers drift from the
    paper unexplained.
    """
    d = os.path.join(DEPOSIT, "med_specs_exposome")
    out = {"specs": [], "by_spec": {}}
    for spec in SITE_SPECS:
        f = os.path.join(d, f"{spec}.tsv")
        if not os.path.exists(f):
            continue
        per = collections.defaultdict(lambda: {"dz": set(), "eff": 0.0})
        for row, i in read(f):
            if row[i["sig"]] != "TRUE":
                continue
            b = per[row[i["protID"]]]
            b["dz"].add(row[i["disease"]])
            try:
                b["eff"] = max(b["eff"], abs(float(row[i["nie_HR"]]) - 1) * 100)
            except (TypeError, ValueError):
                pass
        prots = sorted(per)
        out["specs"].append(spec)
        out["by_spec"][spec] = {
            "proteins": prots,
            "pleiotropy": [len(per[p]["dz"]) for p in prots],
            "max_eff": [round(per[p]["eff"], 4) for p in prots],
            "diseases": [sorted(per[p]["dz"])[:40] for p in prots],
        }
        sp = sum(1 for p in prots if len(per[p]["dz"]) <= 3)
        hb = sum(1 for p in prots if len(per[p]["dz"]) >= 20)
        print(f"    {spec:28s} {len(prots):5,} proteins | specific {sp:4d} | hub {hb:4d}")
    p_out = os.path.join(OUT, "spectrum_specs.json")
    json.dump(out, open(p_out, "w"), separators=(",", ":"))
    print(f"  spectrum_specs.json {os.path.getsize(p_out)/1e6:5.1f} MB")


def build_drivers():
    """PXS vs cis vs trans mediated effects, per protein-disease link, per spec.

    med_genetic_all.tsv carries all three genetic rows -- PGS_total, cis and
    trans -- over the same grid the exposomic deposit uses, so the four drivers
    line up one-to-one with nothing to aggregate.

    Only specifications with a partitioned run have cis and trans at all: the
    primary_total runs fit one combined genetic score. That is why this follows
    partitioned_specs() rather than the five specs used elsewhere.
    """
    out = {"specs": [], "rows_by_spec": {},
           "cols": ["protein", "disease", "n_cases",
                    "pxs", "pxs_lo", "pxs_hi", "pxs_sig",
                    "cis", "cis_lo", "cis_hi", "cis_sig",
                    "trans", "trans_lo", "trans_hi", "trans_sig",
                    "pgs", "pgs_lo", "pgs_hi", "pgs_sig"]}
    for spec, dep, _ in partitioned_specs():
        gfile = os.path.join(dep, "med_genetic_all.tsv")
        efile = os.path.join(dep, "med_exposure_total.tsv")
        if not (os.path.exists(gfile) and os.path.exists(efile)):
            continue
        gen = collections.defaultdict(dict)
        for row, i in read(gfile):
            gen[(row[i["protID"]], row[i["disease"]])][row[i["component"]]] = (
                rd(row[i["nie_HR"]]), rd(row[i["nie_l95"]]), rd(row[i["nie_u95"]]),
                1 if row[i["sig"]] == "TRUE" else 0)
        rows = []
        for row, i in read(efile):
            key = (row[i["protID"]], row[i["disease"]])
            g = gen.get(key, {})
            esig = 1 if row[i["sig"]] == "TRUE" else 0
            if not esig and not any(g.get(c, (None, None, None, 0))[3]
                                    for c in ("PGS_total", "cis", "trans")):
                continue
            rec = [key[0], key[1], int(row[i["n_cases"]] or 0),
                   rd(row[i["nie_HR"]]), rd(row[i["nie_l95"]]), rd(row[i["nie_u95"]]), esig]
            for c in ("cis", "trans", "PGS_total"):
                v = g.get(c, (None, None, None, 0))
                rec.extend([v[0], v[1], v[2], v[3]])
            rows.append(rec)
        out["specs"].append(spec)
        out["rows_by_spec"][spec] = rows
        n = {c: sum(1 for r in rows if r[out["cols"].index(f"{c}_sig")])
             for c in ("pxs", "cis", "trans", "pgs")}
        print(f"    drivers  {spec:16s} {len(rows):6,} links | significant {n}")
    p_out = os.path.join(OUT, "drivers.json")
    json.dump(out, open(p_out, "w"), separators=(",", ":"))
    print(f"  drivers.json      {os.path.getsize(p_out)/1e6:5.1f} MB  "
          f"specs: {', '.join(out['specs'])}")


if __name__ == "__main__":
    build_variance()
    build_categories()
    build_mediation()
    build_gem()
    build_greml()
    build_mediation_structure()
    build_spectrum_specs()
    build_drivers()
