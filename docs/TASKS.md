# HEAP website — work queue

**Viewing it:** <http://localhost:3000> (local preview, currently running)
· new Associations: <http://localhost:3000/results/associations>
· payload API: `https://storage.googleapis.com/heap-web-data/web/v1/…`

**Redirecting me: edit this file.** Reorder the queue, strike a row, or drop a note in
[Issues you found](#issues-you-found). I read this before starting anything. Design contract is
[`WEBSITE_PLAN.md`](WEBSITE_PLAN.md) — if the two disagree, the plan wins.

---

## Standing decisions

These are settled. **I apply them without asking.** Change one here and I follow the new version.

| # | decision |
|---|---|
| S1 | **`base` is the default specification everywhere.** The other five are behind a switcher. `base_ses` is never a default and is labelled "Module 2 only; over-adjusts by pulling deprivation out of the exposome" |
| S2 | **`+ BMI` is a sensitivity layer, never a mediation test.** Attenuation under BMI cannot separate mediation from confounding |
| S3 | **Evidence ladder on every relationship.** No generic green "significant" badge, ever |
| S4 | **Protein classification = motif profile per (protein, disease)**, from `S_mr_triads`. Never a single per-protein label |
| S5 | **Where a figure export and a supplement table describe the same thing, read the supplement table** (`source_kind = stats_tsv` / `deposit_tsv`) and say so on the page |
| S6 | **Categories use `HEAP_ECAT_COLORS`** (`src/lib/palette.js`, mirroring `plot_theme.R`) |
| S7 | **Empty states distinguish "not tested" from "tested, not significant."** Never collapse them |
| S8 | **Every number traces to a macro, registry or payload file.** Nothing hand-typed |
| S9 | **Protein ids are true HGNC symbols** (`HLA-A`, not `HLA_A`), canonicalized in the packer |
| S10 | **GxE is supplementary** — reachable, not a top-level pillar |
| S11 | **Mediation is presented as descriptive**, with causal adjudication kept separate (MR + coloc) |
| S12 | **No dataset DOIs.** Version + build date; readers cite the paper |
| S13 | **Structural copy is mine to draft; interpretive copy is yours.** I mark anything that interprets a result and leave it for you |

## Queue

Ordered. I take the top row that isn't blocked, and I don't need to ask first.

**In flight:** nothing. Next unblocked row is Q6.

| # | task | acceptance |
|---|------|-----------|
| Q6 | **Protein page** `/explore/protein/<SYM>` | one request, motif profile card, tabs per plan §6.3 |
| Q7 | **Exposure page** `/explore/exposure/<slug>` | PES weight download prominent; variable + its levels in one Miami plot |
| Q8 | **Global search + `/start`** | one prebuilt index, no server |
| Q9 | **Homepage** | stat bar from macros; hero copy left for you (S13) |
| Q10 | **`/data` catalog + `/data/api`** | 8 cards, schemas, copy-paste R/Python |
| Q11 | **Disease + triad pages, Evidence Explorer** | `Disease_UKB` crosswalk, `disease_list.tsv` (181) |
| Q12 | **Retire legacy pages + Cloud SQL** | only after Q1–Q7 ship |

## I stop and ask when

- A **scientific claim or interpretation** is involved — page copy that says what a result *means* (S13)
- A **published number would change**, or a figure and the manuscript disagree
- Something is **outward-facing**: pushing a branch, deploying, making data public, emailing
- Two sources **disagree and the repo can't settle it**
- I would **delete or overwrite** something you wrote
- A task implies **editing analysis code** in `HEAP/` rather than website plumbing

Otherwise I proceed, and report what I did with evidence.

## Needs you (currently blocking)

| # | thing | why |
|---|-------|-----|
| B2 | **UKB posture on public data** | 122 MB of derived summary stats are already public at `gs://heap-web-data`; PES weights are planned next. Confirm both are permitted |
| B3 | **Which MR arm is canonical for display** — UKB, deCODE, or a toggle | `summarize_mr_triads.R` takes `ARM` |
| B5 | **`\nExposuresPES` = 164 vs 160 exposure dirs on disk** | a published number vs what exists |
| B6 | **Migration timing** | preview channel until cutover is the default; say if you'd rather ship incrementally |
| B4 | **Per-tier motif recomputation** (optional) | motif A is 6 triads at Tier 1, 69 at Tier 2. Needs `summarize_mr_triads.R` to emit per-bar columns — analysis work |

## Upstream issues found by the site (HEAP repo — your call, I don't edit analysis code)

| # | issue | impact |
|---|-------|--------|
| U1 | **`heap_export_website` exports at jsonlite's default 4-decimal precision.** `export_helpers.R:116` calls `toJSON(...)` with no `digits`, so values in ~[1e-4, 1) round to 4 decimals: `0.000123456` -> `0.0001`. Very small numbers survive (they switch to scientific; `4.87e-65` preserved), and exact zeros are genuine R underflow below ~5e-324, NOT rounding. **Fix is one argument: `digits = NA`.** Affects every figure export; supplementary deposits are full precision and unaffected | marginal-significance p-values plot slightly off |
| U2 | **4 proteins carry mangled HGNC symbols** in the mediation/MR exports (`HLA_A` for `HLA-A`), from `HEAP_loader.R:870` `gsub("-","_")`. The site corrects at the boundary; joins to external databases on the raw exports silently miss | external joins |
| U3 | **`intervention_compare.exposure_lab` collapses factor levels** - 65 `exposure_id`s map to 28 labels, so a naive pivot averages unrelated levels into one cell | anyone pivoting that export |
| U4 | **`fig_gem_landscape` covers 72 diseases**, not the 181 in `disease_list.tsv` | any figure keyed on it shows 40% of the disease set |

## Author decisions waiting on you

| # | where | what |
|---|-------|------|
| A1 | `Home.js` `HERO_CLAIM` | the hero headline. Neutral fallback in place; plan's candidate quoted in the comment |
| A2 | `Home.js` `HERO_FRAMING` | the reporter-vs-intermediate strapline -- your central claim, so not mine to write |
| A3 | `Cite.js` | `main.tex:103` has an open `\todo{UPDATE Credit Statement with additional co-authors}`, plus an open competing-interests TODO. Confirm the author list before the cite page asserts one |
| A4 | `AboutHeap.js` | landing framing paragraph |
| A5 | `Changelog.js` x3 | why G x E was demoted; the reframe as the changelog headline; whether v1 numbers sit beside v2 |
| A6 | `FAQs.js` | the G x E "why", as opposed to the "what" |
| A7 | `ApiDocs.js` | whether to advertise the `supp/v1` bulk deposit publicly (it is live and returns 200) |

## Issues you found

_Add anything here — a sentence is enough. I triage it into the queue._

- (empty)

## Done

| # | task | evidence |
|---|------|----------|
| D22 | **Documentation section built** | 7 new pages + 3 refreshed; 17 routes, 0 errors; API snippets executed against the live bucket, output is real |
| D21 | **PES rebuilt as Figure 6** | Q1 read / Q2 track / Q3 disease-relevant; obesity exclusion replicated from `fig_m6_panel_d.R:65` |
| D20 | **Downloads = a real catalog** | 399 files, 9 folders, search over filenames AND column names; 121/121 URLs verified 200 |
| D19 | **Supplementary data published** | 2,729 MB -> 826 MB gz; per-file + whole zip + xlsx, all live |
| D18 | **Home page rebuilt** | stat bar from macros (53,014 / 2,686 / 169 / 22,240 / 181 / 164 / 18); old 4-module copy gone |
| D17 | **Q5 Interactions -> Architecture** | GxE demoted below a divider (S10); `/architecture` added, `/interactions` kept for back-compat |
| D16 | **Q4 Intervention rebuilt** | exposure x trial selector; Olink-SomaScan concordance in chip, hover and alert |
| D15 | **Q3 Mediation -> "Disease Links"** | descriptive caveat verbatim x4 in the DOM + link to causal adjudication (S11) |
| D14 | **Q2 Lifestyle Categories rebuilt** | 5 native sections; the 7 zero-reach categories named as tested, not dropped (S7) |
| D13 | **Q1 Main Results rebuilt** | 9 native sections; lead panel = genetics vs exposome spectrum, 2,686 proteins |
| D12 | **Associations rebuilt** | `base` default + 5-spec switcher; 1.4 KB/protein vs 35 KB HTML + 4.3 MB Plotly; β ± SE, p, N in hover; LEP 81/97 replicated |
| D11 | Two-tier cache TTL | entry points 60 s, shards 3600 s |
| D10 | Protein ids standardized to true HGNC | 0 mangled objects live |
| D9 | `sync_gcs.py` verifies the union of ledgers | 13,526 objects publish |
| D8 | Tier E entity bundles | protein 2,686 @ 28.6 KB median; live |
| D7 | Tier M catalog + headline + search | 25 KB total, 37 datasets |
| D6 | Firebase preview-channel workflow | needs the branch pushed to run |
| D5 | `heap/data/` untracked (317 MB) | all 2,797 verified in GCS first |
| D4 | Deploy workflows restricted to `main` | any-branch push used to redeploy live |
| D3 | MR wired to canonical Tier-1 tables | `S_mr_triads` / `S_mr_motifs` |
| D2 | Four new module pages | MR, PES, enrichment, GWAS |
| D1 | Payload pipeline | O2 → GCS, ledger-verified |
