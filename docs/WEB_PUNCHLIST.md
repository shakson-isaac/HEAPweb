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

---

## Fix list — opened 2026-08-26

Bugs and changes found while reviewing the live preview. Consolidation of the
Google projects comes first; these are worked afterwards, because deploy churn
would mean re-verifying each fix anyway.

Status: `[ ]` open · `[x]` done · `[~]` in progress

### Disease links

- [x] **Per-protein plot renders blank.** FIXED 2026-08-26. Clicking a protein in the driver
  comparison (and the reporter/intermediate view) shows no chart.
  *Lead:* a sharded section does not repeat its key column inside the shard --
  `k/med_drivers/LEP.json.gz` has `spec, disease_id, n_cases, pxs, ...` but no
  `protein`. `shardRows()` in `lib/mediation.js` reads `d.protein[i]`, which is
  `undefined`; symmetrically `d.disease_id` is absent from `med_dz_links`
  shards. `shardRows(d, key)` now restores whichever column the shard omits,
  so the same trap cannot catch the next sharded section either.

### Verified working on the preview

- [x] Manifest `.gz` suffix accumulation (`.gz.gz.gz`) -- caused 404s on every
  section. Cache stored the manifest entry by reference and the suffix step
  mutated it each run. Fixed idempotently plus a defensive copy.

### Deployment consolidation (do first)

- [x] **Is the Flask backend in `focal-cache-455223-h5` still called?** No.
  One component used it -- `LegacyDownloads` on the Downloads page, fetching
  `/api/downloads`, which returns five loose CSVs. The GCS catalogue already
  publishes **399** files across nine folders, and the five are superseded
  rather than duplicated: each was a single-specification snapshot where the
  deposit now carries every specification.

  Recorded before removal, so a stale link can still be answered:

  | legacy file (Flask) | superseded by (GCS `supp/v1/`) |
  |---|---|
  | `MediationResults.csv` | `mediation/exposome/{base,+bmi,+clinical,+blood_draw,exclude_prevalent}.tsv` |
  | `GEMdownload.csv` | `mediation/base/{exposome,genetic}_mediation.tsv` |
  | `GxE_R2table.csv` | `variance_decomposition/coarse/*.tsv` (9 specifications) |
  | `GxE_Cat_R2table.csv` | `variance_decomposition/fine/*.tsv` |
  | `Models_HEAPassociations.zip` | `associations_E/`, `associations_GxE/` |

- [ ] **Shut down Cloud Run** in `focal-cache-455223-h5`, but only after the
  frontend has run without it for a while. Leave it up until then -- it costs
  almost nothing idle and is the instant rollback if a released frontend still
  points at it.

- [x] Move `gs://heap-web-data` from `heaptrial-a2785` into `heap-4b852`.
  DONE 2026-08-26 as `gs://heap-data`; verified rendering on the preview.
  A bucket's project cannot be changed, so: create the new bucket, publish to
  it, verify, flip `REACT_APP_WEB_DATA_URL`, redeploy, retire the old one.
- [ ] Recreate the CI service account inside `heap-4b852` so the credential and
  its target finally share a project. Today's chain -- credential in
  `focal-cache`, deploy to `heap-4b852`, data in `heaptrial` -- needed an IAM
  grant and an API enablement at every boundary, each failing with the same
  opaque "Failed to get Firebase project".
- [ ] Once consolidated, drop the now-unnecessary cross-project IAM grants.

### Deployment facts worth keeping

| piece | project | notes |
|---|---|---|
| Firebase Hosting | `heap-4b852` | site id `heap-4b852`, `heap-4b852.web.app` |
| Flask backend (Cloud Run) | `focal-cache-455223-h5` | project number 407921522156 |
| GCS payload bucket | `heaptrial-a2785` | `gs://heap-web-data` |
| CI service account | `github-actions-service-account@focal-cache-455223-h5` | what `GCP_CREDENTIALS` holds |

Firebase deploys authenticate with that service account, not a
`firebase login:ci` token -- those are deprecated and the old one had expired.
It needs `roles/firebasehosting.admin` on `heap-4b852` AND
`firebase.googleapis.com` enabled on its OWN project, because a service
account's API calls bill to the project it lives in.

### Migrating a GCS bucket — the complete checklist

Copying objects is the easy part. `gs://heap-data` was created with matching
location, matching public-read IAM and byte-identical contents, and every file
still returned 200 to `curl` while every fetch failed in the browser. The
missing piece was the **CORS policy**, which is a bucket property that nothing
in the object copy carries over.

`curl` does not enforce CORS, so a curl-based verification cannot detect this.
The tell is in the error text: a **404** means the object is missing; **"Load
failed"** means the browser refused a response it did receive.

When creating a replacement bucket, copy all of:

- [x] location / storage class
- [x] public read (`allUsers` -> `roles/storage.objectViewer`)
- [x] object contents
- [x] **CORS policy** -- `gsutil cors get gs://old > cors.json && gsutil cors set cors.json gs://new`
- [x] **every prefix, not just the one your tool manages.** `sync_gcs.py` only
  handles `build/web/v1` -> `web/`, but the bucket also held `supp/` (1.6 GB,
  the downloadable archive, published by publish_supplementary.py) and
  `review/` (299 MB). Migrating only `web/` left the Downloads page 404ing.
  A single `gcloud storage ls gs://OLD/` before the cutover shows all of them.
- [ ] lifecycle rules, if any are ever added
- [ ] retention policy, if any is ever added

Verify with an Origin header, not a bare GET:

    curl -sI -H "Origin: https://example.com" https://storage.googleapis.com/BUCKET/PATH \
      | grep -i access-control-allow-origin

CORS changes take a minute or two to propagate.

