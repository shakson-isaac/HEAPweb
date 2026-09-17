# HEAP website — work queue

**Viewing it:** <http://localhost:3000> (local preview, currently running)
· new Associations: <http://localhost:3000/results/associations>
· payload API: `https://storage.googleapis.com/heap-data/web/v1/…`

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

## Simplification, UX and plot engagement (2026-08-19)

**The design principle, measured.** `Associations.js` is 174 lines: one plot, one table, three
controls. It is the page that works. `Pes.js` is 933 lines and 21 sections. Every page should
converge on the Associations shape -- one question, one primary visual, controls that change it,
everything else behind disclosure.

Where each page stands today (source counts; rendered text length in chars):

| page | lines | sections | plots | tables | chars |
|---|---|---|---|---|---|
| Pes | 933 | 21 | 5 | 16 | 32,298 |
| Mediation | 855 | 8 | 7 | 3 | 12,619 |
| Intervention | 727 | 5 | 5 | 5 | 15,863 |
| Interactions | 648 | 4 | 7 | 3 | 6,302 |
| Causal | 575 | 12 | 3 | 11 | 25,451 |
| MainResults | 633 | 9 | 9 | 5 | 5,839 |
| **Associations** | **174** | **1** | **1** | **1** | **6,598** |

### F -- foundations for growth (see WEBSITE_PLAN section 15)

| # | task | why |
|---|------|-----|
| F1 | **Home page reads the manifest.** "What's in here" and the Results nav generated, not hand-listed. A new module appears by being published | 82 registry rows already generate 10 pages; only Home.js is hand-maintained |
| F2 | **Search becomes the primary home affordance**, entry points by question type not by module | question types are stable; module lists rot |
| F3 | **Stamp every payload object with a `data_release`** distinct from the `/v1/` API version, and show it | a reader must know which release they are reading |
| F4 | *(DONE 2026-08-19)* MR pQTL panel is declared in `web_sections.tsv`, carried through the manifest, and rendered as a page notice + per-section chip. Worded as **instrument panels, not cohorts**: same participants, same exposures, same outcomes; only the protein instruments differ | correctness |
| F4b | **Show deCODE per-edge status on the triad DAG (no new analysis).** The published `mr_edges` deposit carries `dataset`, `edge_dir`, `src_id`, `tgt_id`, `mr_tier_final`, `nsnp`, `coloc_status`, `coloc_pph4` for BOTH panels. Each DAG edge can therefore show its deCODE tier, instrument count and coloc alongside UKB -- e.g. ASGR1 P->D is Tier1plus in both, ADM and FURIN are Tier1 in UKB and absent in deCODE | buildable today |
| F4c | **Show deCODE effect sizes (beta +/- SE) on the DAG.** BLOCKED on an aggregation pass in the HEAP repo: the estimates exist as `b`/`se`/`pval` in ~50,000 `*_mr_methods.tsv` files under `mr_edges_decode/MR_deCODE_replication/`, four methods each (IVW, MR Egger, Weighted median, Weighted mode), but are not tabulated. UKB's equivalent is `MRmotifs.tsv` (`beta_EP`/`se_EP`/`padj_EP`). Needs the author to confirm which method and which multiple-testing correction to mirror | analysis-side |
| F4b-old | **Surface `Tier1plus` (cross-panel replication) per edge instead of building a deCODE motif table.** Verified: Tier1plus counts are IDENTICAL across panels (D->P 365/365, E->P 42/42, Pcis->D 2/2) because the rung *means* replicated-in-both, so it is symmetric by construction. Running the motif enumeration on deCODE instruments yields **0 motif-A triads** -- not a useful parallel table. What a reader actually wants is per-edge replication status, which is already in the data | replaces "regenerate both arms" |
| F5 | **Decide and document the cohort URL shape without implementing it**: `/v1/<cohort>/...`, current paths stay valid aliases | avoids a retrofit across every page later |
| F6 | **Freeze and document the `/v1/` contract** + a deprecation policy | others will depend on these URLs |
| F7 | **Thin R/Python helper** so the common calls are one line | lowers the cost of someone building on HEAP |

### S -- simplification

| # | task | why |
|---|------|-----|
| S1 | **Cut PES from 21 sections to a lead + disclosure.** Keep Figure 6's three questions visible; move the 15 TableSections behind one "All PES results" expander | 32,298 chars is a data dump, not a page |
| S2 | **Make the Associations shape the house template.** One question, one primary visual, controls, then disclosure. Write it down so future pages inherit it | the pattern is already validated |
| S3 | **Demote Interactions to match the paper.** 7 plots for a supplementary analysis the manuscript demotes. Reduce to one summary visual + a link to the deposit | S10 says supplementary; the page says pillar |
| S4 | **Causal: fold the 7 TableSections under the DAG into one expander** | the DAG is the point; the tables bury it |
| S5 | **MainResults: 9 plots -> the 3 that carry the claim.** Lead spectrum, decomposition, reach. Rest to disclosure | every export got a chart because I briefed it that way |
| S6 | **Nav: 20 menu items across two menus.** Group or shorten | Results has 10, Documentation has 10 |

### X -- user experience

| # | task | why |
|---|------|-----|
| X1 | **Mobile: 93 px horizontal overflow at 420 px**, present on every page -- it is the nav, not any one section | the site is unusable on a phone |
| X2 | **Unify the entity selector.** A protein picker appears on Associations, Mediation, Causal and PES, each built separately with different behaviour | one component, one behaviour |
| X3 | **Carry selection across pages.** Picking LEP on Associations then opening Disease links should keep LEP | currently every page resets |
| X4 | **Shareable deep links.** Put protein/exposure/spec in the URL so a result can be sent to a collaborator | plan section 6.6 wants citable URLs |
| X5 | **Perceived speed.** Prefetch the entity bundle on selector hover; skeleton instead of a spinner | bundles are ~29 KB, so this is cheap |
| X6 | **One consistent caveat pattern.** Alerts, chips and footnotes are currently mixed | readers learn one affordance |

### P -- do the plots earn their place

| # | task | why |
|---|------|-----|
| P1 | **Audit all 53 plots: keep / merge / demote to table.** A bar chart of 3 values is a table with extra steps | 53 plots, 9 pages |
| P2 | **Name the engaging ones and say why.** The triad DAG and the Associations volcano work because they answer a question you can pose in words. Apply that test to the rest | gives S1-S5 an objective criterion |
| P3 | **Consistent hover contract.** Every point should reveal the same fields in the same order: entity, effect +/- SE, p, n, evidence rung | hover quality varies per page |
| P4 | **Kill decorative variety.** Donut, waterfall and box plots appear once each; prefer a smaller vocabulary used consistently | variety costs recognition |
| P5 | **Make one plot per page the obvious hero** -- size, position, and a caption stating the question it answers | currently pages read as equal-weight lists |

**Sequence I would take:** P1/P2 first (the audit tells S1-S5 what to cut), then S1-S5, then X1
(mobile blocks real use), then X2-X4.

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
| B2 | **UKB posture on public data** | 122 MB of derived summary stats are already public at `gs://heap-data`; PES weights are planned next. Confirm both are permitted |
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

## >>> TWO DIFFERENT TABLES -- do not conflate (clarified 2026-08-19) <<<

The edge table on the website and the supplementary triad table are **different objects for
different readers**, and optimising one for the other makes both worse.

| | website edge table | supplementary triad table |
|---|---|---|
| reader | one person auditing ONE triad on screen | someone scanning 18,780 triads in Excel / R / pandas |
| scope | the selected triad | every triad, every direction, every panel |
| may use | grouping, nesting, expanders, hover, colour | none of it -- grouping does not survive a spreadsheet |
| row = | whatever reads best | one record, always, no exceptions |
| provenance | can live in a group header, stated once | must repeat on every row as its own column |
| cis / trans | may collapse to a pooled verdict | never collapsed; both are separate rows |
| optimise for | legibility and side-by-side comparison | filtering, sorting, joining, reproducibility |

Consequence: the website may group by direction with the sample pairing in a header; the
supplement must be **flat long format** -- one row per (triad x direction x instrument class x
panel) with every provenance field as its own column.

## >>> RULE 5 -- MUST DO once the presentation is settled <<<

**A standardized triad-motif supplementary table**, shaped by whatever the triad explorer
proves works. Agreed 2026-08-19; explicitly flagged by the author as required, not optional.

Why it is queued rather than done: it lands in the MANUSCRIPT, not the website. A new
supplementary table needs a `config/supp_tables.tsv` row, a legend in `supp/table_legends.tex`,
a `\Tref` citation in the main text to pass the inclusion gate, and it changes what ships in
`HEAP_Supplementary_Tables.xlsx`. That is author prose and a published artifact (S13 + the
stop-and-ask rules).

What I will hand over instead: the proven column set, the row definition (one row per triad),
which panel each estimate comes from, and a generator script -- so adopting it is a decision,
not a build. The site and the supplement then share ONE definition, which is what
`SUPPLEMENT_README` asks for.

Depends on: rules 1-4 landing, so the shape is evidence-based rather than guessed.

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
