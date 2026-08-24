# Website punch list

Running list of design edits spotted while browsing the site. Fire them in any
order, in whatever words are natural — page plus what's wrong is enough.

**How this runs.** Observations arrive as fast as they are spotted; they queue
and are applied in one pass, with a single build at the end rather than one per
edit. That batching is most of the speed. Anything needing an upstream export or
an R rerun gets flagged rather than silently deferred.

## Status key

`todo` · `done` · `changed` (done differently — reason given) · `blocked` (needs
data work) · `ask` (a real decision, not a default)

## Open

| # | page | observation | status |
|---|---|---|---|
| — | — | _(nothing open)_ | |

## Done this session

| # | page | change | outcome |
|---|---|---|---|
| 1 | PES / reads | plot 1 was a ranked dotplot; wanted printed panel b | done — category strip, exemplars from the R plotter's own PREFER/CAST rule |
| 2 | PES / reads | binary AUC axis 0.4–1 | done — fixed window, not data-derived |
| 3 | PES / reads | axis titles should name the model and metric | done — "proteome-only held-out R²/AUC/AUPR" |
| 4 | PES / reads | cut negative R² | done — floored at −0.05, 4 of 81 off scale, chip says so, values stay in the table |
| 5 | PES / reads | plot 2 should not be a scatter | done — same strip layout with the increment on x |
| 6 | PES / tracks | apply what reads learned | done — same two-plot structure |
| 7 | Interventions | data richer than the page shows | done — S15 deposit registered, 174 → 185 terms with SEs |

## Standing preferences

Applied by default; no need to restate.

- Confidence intervals shown wherever the data has them.
- Category colour from the shared HEAP palette (`ecatColor`).
- Every scatter paired with a linked lookup table.
- Axis titles name the model AND the metric, in the paper's phrasing.
- Any floor, cap or filter is stated on screen with a count.
- Where a printed panel exists, the interactive version echoes its layout.

---

## In flight as of 2026-08-24 — pick up here

### Module 3 partitioned arrays (running)

Three 400-task arrays add `partitioned_categories` for the three specifications
that only had `primary_total`. Until they land, the per-exposure-category and
cis/trans mediation views exist for **base and base_clinical only**.

| job | experiment | covariate set | sample filter |
|---|---|---|---|
| 51204881 | `M3_base_bmi_lasso_partitioned` | base_bmi | none |
| 51204882 | `M3_base_draw_lasso_partitioned` | base_draw | none |
| 51204883 | `M3_base_exclprev_lasso_partitioned` | **base** | exclude_prevalent |

`base_exclprev` is a SAMPLE specification: `covariate_set` stays `base` and
`sample_filter` does the work, so it writes under `.../base/lasso/...`. Both the
manifest and the summarizer's `SPEC_DIRS` map agree on that.

Check: `squeue -u $USER` · `find $HEAP_OUTPUT/output/module3/<exp> -name 'MDres_*.txt' | wc -l` (expect 400)

**When they finish**, per specification:

```bash
Rscript scripts/analysis_summaries/summarize_module3_mediation.R base_bmi     # etc.
Rscript scripts/support/module3_disease_specificity.R base_bmi lasso
```

Both refuse to run on a partial array and both namespace their output away from
base — base's deposit files are cited supplementary data. Then rebuild the
mediation sections and the pickers pick the new specs up automatically:
`tools/build_mockup_data.py` discovers specs from disk rather than listing them.

### Disease Links is still on scratch data

`PleiotropySpectrum`, `MediationGrid`, `DriverComparison` and
`MediationLandscape` read `public/mockup/*.json` (gitignored), **not** published
sections. They work on localhost and would break if deployed. Converting them is
deliberately deferred: there is no point building sections against two
specifications when there will be five. Main results and Lifestyle categories
are already on real published sections.

Which of the four should lead is undecided, pending how they read across five
specifications.

### Not pushed

The branch `add-new-results-and-payload-pipeline` is committed on O2 only.
Pushing cannot touch production — `deploy-firebase.yml` is restricted to `main`.

### Running the site on O2

There is no `node` on PATH, but VS Code ships one:

```bash
cd heap/frontend
export PATH="$(dirname "$VSCODE_GIT_ASKPASS_NODE"):$PATH"
BROWSER=none PORT=3000 node node_modules/react-scripts/bin/react-scripts.js start
```

Using `$VSCODE_GIT_ASKPASS_NODE` survives VS Code updates changing the build hash.
Port 3008, if something is listening there, is a `python3 -m http.server` on the
payload directory — the data server, not the site.

### Before any publish

`python3 tools/audit_payload.py` — exits non-zero on a violation. Aggregates
only, no participant identifiers, no cell below 10 people. It has caught a real
one (`sample` vs `sample_spec`) and carries two documented carve-outs (`Eid` is
an exposure id; 7-digit `pos`/`start`/`end` are genomic coordinates).
