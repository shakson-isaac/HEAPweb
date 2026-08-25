#!/usr/bin/env python3
"""
build_mediation_views.py -- the redesigned Disease links page.

Four panels, four sections, all long-format so the columnar packer can collapse
the repeated specification strings:

  med_spectrum   per protein: how many diseases it mediates, its strongest
                 mediated effect, and how many exposure categories drive it
  med_grid       per (exposure category, disease): how many proteins carry a
                 significant mediated effect, and which
  med_drivers    per (protein, disease): the mediated effect under the exposome
                 score and under cis, trans and total genetic drivers.
                 SHARDED BY PROTEIN.
  med_dz_links   the same links keyed the other way, SHARDED BY DISEASE
  med_driver_dist  binned effect-size distributions, one small table

WHY THE LINKS SHIP THREE TIMES OVER. Two panels read them and they drill on
different keys: the driver comparison opens one PROTEIN across its diseases, the
landscape opens one DISEASE across its proteins. A single sharded section can
only have one key, and shipping the whole 105,360-row table so either panel can
slice it client-side means every visitor downloads 2.35 MB to draw one forest.

So the detail is sharded twice -- by protein and by disease -- and the two
overviews, which need every link at once but only to draw a distribution, read
precomputed bins instead. Binning server-side is not a compromise: a histogram
of 105,360 values IS bins, and the browser was being sent the raw values only to
count them itself.
  med_disease    per disease: its identifier, display label and class

EVERY DISEASE IS KEYED ON DZ_ID, NOT ON ITS NAME. The two sources spell disease
names differently: the deposit has the British forms it was written with
("diarrhoea", "ischaemic", "oesophagitis") while disease_mediators.tsv has been
run through heap_americanize. Twelve names disagree, so joining the grid to its
disease class by label silently dropped those twelve into "Other". DZ_ID is a
stable identifier and does not move when a label is respelled.

SPECIFICATIONS ARE DISCOVERED, NOT LISTED. Only a `partitioned_categories` run
fits the 13 categories and cis/trans separately; `primary_total` fits one
combined exposome score and one combined genetic score. So the specifications
available here are whichever partitioned runs have been summarised, which is a
moving target while the arrays finish -- listing them would mean editing this
file every time one lands.

base reads the top-level deposit filenames because those are cited supplementary
data; every other specification reads supp_deposit/med_specs_partitioned/<spec>/.

PLEIOTROPY IS READ, NOT RECOMPUTED. disease_mediators*.tsv is what the printed
Figure 3c is drawn from. Deriving the same number here by counting significant
diseases per protein gave 336 disease-specific proteins where the figure has
325, because that script also drops links under 100 cases and requires a
sign-consistent proportion mediated. Reading its output reproduces 325 and 303.
"""
import collections
import csv
import json
import os

OUT_ROOT = os.environ.get("HEAP_OUTPUT", "/n/groups/patel/IGLOO/UKB/HEAP/output")
DEPOSIT = os.path.join(OUT_ROOT, "supp_deposit")
EXPLORATORY = os.path.join(os.path.dirname(OUT_ROOT), "figures", "exploratory", "module3")
DERIVED = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "build", "derived")
os.makedirs(DERIVED, exist_ok=True)

# Reporting order. A specification absent from disk is simply skipped.
SPEC_ORDER = ["base", "base_bmi", "base_clinical", "base_draw", "base_exclprev"]


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


# Effect sizes are |HR - 1| as a percentage. 0.25% bins to 30%, then a tail
# bucket, which is finer than any screen can resolve and keeps the table tiny.
def bin_pct(v):
    if v is None:
        return None
    if v >= 30:
        return 30.0
    return round(round(v / 0.25) * 0.25, 2)


def bin_unit(v):
    """Proportion mediated: 0-1 in 0.01 bins. Values outside are clamped."""
    if v is None:
        return None
    v = max(0.0, min(1.0, v))
    return round(round(v / 0.01) * 0.01, 2)


def write(name, cols, rows):
    p = os.path.join(DERIVED, f"{name}.tsv")
    with open(p, "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow(cols)
        w.writerows(rows)
    print(f"  {name}.tsv  {len(rows):,} rows  {os.path.getsize(p)/1e6:.1f} MB")


def available():
    """(spec, deposit dir, disease_mediators path) for every summarised run."""
    out = []
    for spec in SPEC_ORDER:
        dep = DEPOSIT if spec == "base" else os.path.join(DEPOSIT, "med_specs_partitioned", spec)
        ex = os.path.join(EXPLORATORY,
                          "disease_mediators.tsv" if spec == "base"
                          else f"disease_mediators_{spec}.tsv")
        if os.path.exists(os.path.join(dep, "med_exposure_categories.tsv")):
            out.append((spec, dep, ex))
    return out


def main():
    specs = available()
    if not specs:
        raise SystemExit("no summarised partitioned runs found")
    print(f"  specifications on disk: {', '.join(s for s, _, _ in specs)}")

    spectrum, grid, drivers = [], [], []
    dz_class = {}

    for spec, dep, ex in specs:
        # --- spectrum -------------------------------------------------------
        if os.path.exists(ex):
            per = collections.defaultdict(lambda: {"pl": None, "eff": 0.0,
                                                   "cats": set(), "dz": set()})
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
                b["dz"].add(row[i["DZ_ID"]])
                # The Americanised label wins where the two sources disagree:
                # it is the house spelling and the one the figures render.
                dz_class[row[i["DZ_ID"]]] = (row[i["disease"]], row[i["system"]])
            for p in sorted(per):
                b = per[p]
                spectrum.append([spec, p, b["pl"], round(b["eff"], 4), len(b["cats"]),
                                 "; ".join(sorted(b["dz"])[:40])])
            nsp = sum(1 for p in per if (per[p]["pl"] or 0) <= 3)
            nhub = sum(1 for p in per if (per[p]["pl"] or 0) >= 20)
            print(f"    spectrum {spec:14s} {len(per):5,} proteins | "
                  f"specific {nsp:4d} | hub {nhub:4d}")

        # --- grid -----------------------------------------------------------
        cells = collections.defaultdict(set)
        for row, i in read(os.path.join(dep, "med_exposure_categories.tsv")):
            if row[i["sig"]] != "TRUE":
                continue
            cells[(row[i["exposure_category"]], row[i["DZ_ID"]])].add(row[i["protID"]])
            # Keep the deposit's label only as a fallback for diseases that
            # never appear in disease_mediators.tsv.
            dz_class.setdefault(row[i["DZ_ID"]], (row[i["disease"]], "Other"))
        for (cat, dz), ps in sorted(cells.items()):
            # The protein list is capped: a cell can hold hundreds and the panel
            # names them as a hint, not as a table. The count is exact.
            grid.append([spec, cat, dz, len(ps), "; ".join(sorted(ps)[:60])])
        print(f"    grid     {spec:14s} {len({c for c, _ in cells})} categories x "
              f"{len({d for _, d in cells})} diseases")

        # --- drivers --------------------------------------------------------
        gfile = os.path.join(dep, "med_genetic_all.tsv")
        efile = os.path.join(dep, "med_exposure_total.tsv")
        if not (os.path.exists(gfile) and os.path.exists(efile)):
            continue
        gen = collections.defaultdict(dict)
        for row, i in read(gfile):
            gen[(row[i["protID"]], row[i["DZ_ID"]])][row[i["component"]]] = (
                rd(row[i["nie_HR"]]), rd(row[i["nie_l95"]]), rd(row[i["nie_u95"]]),
                1 if row[i["sig"]] == "TRUE" else 0)
        n = 0
        for row, i in read(efile):
            key = (row[i["protID"]], row[i["DZ_ID"]])
            # Register a fallback label here too. A disease can carry a driver
            # effect while never reaching significance at the category level, so
            # it appears in this file and not in disease_mediators.tsv -- 37 of
            # them do. Without this they render as raw DZ_IDs in the panel.
            dz_class.setdefault(row[i["DZ_ID"]], (row[i["disease"]], "Other"))
            g = gen.get(key, {})
            esig = 1 if row[i["sig"]] == "TRUE" else 0
            # A link significant under no driver says nothing about which route
            # dominates, and there are ~425,000 of them per specification.
            if not esig and not any(g.get(c, (None, None, None, 0))[3]
                                    for c in ("PGS_total", "cis", "trans")):
                continue
            rec = [spec, key[0], key[1], int(row[i["n_cases"]] or 0),
                   rd(row[i["nie_HR"]]), rd(row[i["nie_l95"]]), rd(row[i["nie_u95"]]), esig,
                   # Against the EXPOSOME driver's own total effect. Not on the
                   # same scale as a proportion against a single category, which
                   # is why the deposit ships those in a separate file.
                   rd(row[i["prop_mediated"]])]
            for c in ("cis", "trans", "PGS_total"):
                v = g.get(c, (None, None, None, 0))
                rec.extend([v[0], v[1], v[2], v[3]])
            drivers.append(rec)
            n += 1
        print(f"    drivers  {spec:14s} {n:6,} links")

    write("med_spectrum", ["spec", "protein", "pleiotropy", "max_eff_pct",
                           "n_exposure_categories", "disease_ids"], spectrum)
    write("med_grid", ["spec", "category", "disease_id", "n_proteins", "proteins"], grid)
    DCOLS = ["spec", "protein", "disease_id", "n_cases",
             "pxs", "pxs_lo", "pxs_hi", "pxs_sig", "prop_mediated",
             "cis", "cis_lo", "cis_hi", "cis_sig",
             "trans", "trans_lo", "trans_hi", "trans_sig",
             "pgs", "pgs_lo", "pgs_hi", "pgs_sig"]
    write("med_drivers", DCOLS, drivers)

    # Same rows, disease first, so the packer can shard them the other way.
    ix = {c: k for k, c in enumerate(DCOLS)}
    rest = [c for c in DCOLS if c not in ("spec", "protein", "disease_id")]
    dz_cols = ["disease_id", "spec", "protein"] + rest
    dz_first = [[r[ix["disease_id"]], r[ix["spec"]], r[ix["protein"]]]
                + [r[ix[c]] for c in rest]
                for r in drivers]
    write("med_dz_links", dz_cols, dz_first)

    # Binned distributions for the two overviews.
    dist = collections.Counter()
    pmd = collections.Counter()
    for r in drivers:
        for drv in ("pxs", "cis", "trans", "pgs"):
            if not r[ix[f"{drv}_sig"]]:
                continue
            hr = r[ix[drv]]
            if hr is None:
                continue
            b = bin_pct(abs(hr - 1) * 100)
            if b is not None:
                dist[(r[ix["spec"]], drv, b)] += 1
        if r[ix["pxs_sig"]]:
            b = bin_unit(r[ix["prop_mediated"]])
            if b is not None:
                pmd[(r[ix["spec"]], b)] += 1
    write("med_driver_dist", ["spec", "driver", "effect_pct", "n_links"],
          [[k[0], k[1], k[2], v] for k, v in sorted(dist.items())])
    write("med_pm_dist", ["spec", "prop_mediated", "n_links"],
          [[k[0], k[1], v] for k, v in sorted(pmd.items())])
    write("med_disease", ["disease_id", "disease", "class"],
          [[k, v[0], v[1]] for k, v in sorted(dz_class.items())])


if __name__ == "__main__":
    main()
