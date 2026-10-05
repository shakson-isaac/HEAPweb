# Interventions page — figure proposal

Status: proposal only. Nothing here has been built. Written 2026-08-20.

Every number, column name and row count below was read off the files named, not
recalled. Manuscript claims are cited as `file:line`.

---

## 1. What the intervention section is FOR

The paper's thesis is that the plasma proteome is a **record** of lifestyle
exposure — a minority of exposure-responsive proteins are causal intermediates,
the majority are biological reporters (`sections/abstract.tex:8`,
`sections/discussion.tex:6`). Everything up to Module 4 is observational and
cross-sectional. The obvious objection is that a cross-sectional association is
not evidence that anything would *move* if the exposure changed.

Module 4 is the answer to that objection, and only that. It asks: when somebody
actually changes the exposure — 20 weeks of supervised endurance training
(HERITAGE, n = 654), or 68 weeks of semaglutide 2.4 mg vs placebo (STEP 1
n = 1133, STEP 2 n = 595) — do the proteins HEAP flagged observationally move,
and do they move in the direction the observational sign predicts?
(`sections/results_m4_intervention.tex:26,28`.)

The section makes exactly three claims, in this order:

| # | Claim | Where |
|---|---|---|
| C1 | **97** exposure terms are FDR-concordant with ≥1 trial signature (HERITAGE 31, STEP 1 94, STEP 2 78; **28** with all three) | `results_m4_intervention.tex:28`, `macros/numbers.tex:100–103` |
| C2 | Concordance is **signed by health valence**: strenuous sports tracks the GLP1-RA shift (r = 0.66 vs STEP 2), processed meat opposes it (r = −0.89 vs STEP 1) | `results_m4_intervention.tex:28`, `macros/numbers.tex:104–105` |
| C3 | Within the shared set, **6** Tier-1 colocalized cis-pQTL proteins are causal intermediates (FURIN→hypertension, ICAM1 + ALCAM→T2D, ASGR1 + PCSK9→lipoprotein disorders, PRSS8→obesity); the larger group — GDF15, LEP, CFH, FABP4 — are **downstream disease reporters** placed there by reverse MR | `results_m4_intervention.tex:30` |

C3 is the one that carries the thesis. The discussion sharpens it further:
"the causal minority is small but tractable: PCSK9 and ASGR1 were the only
proteins supported by Mendelian randomization, colocalization, and replication
across both pQTL platforms" (`sections/discussion.tex:16`).

**What a reader should leave believing:** part of the observational lifestyle
signature is real, perturbable biology — it moves under randomization, and it
moves with the sign the observational estimate predicted. And that within that
perturbable set, causality is *rare*: a handful of colocalized cis-pQTL proteins
against a much larger body of proteins that are reading disease back out.

**Therefore the page must make legible:** (a) the direction and strength of
concordance per exposure, with its uncertainty; (b) the per-protein scatter
behind any one of those correlations, so a reader can see it is not one point;
(c) the causal-vs-reporter split, by name, with the genetic evidence attached.

A correction to a premise worth recording: `sections/results_m5_mr.tex` contains
**no** mention of HERITAGE, GLP1, STEP or intervention (grepped; zero hits).
Intervention concordance is not an MR evidence tier in the manuscript — the MR
tiering is instrument strength / Steiger / sensitivity / cross-platform
replication (`results_m5_mr.tex:11–12,27`). The traffic runs the other way: MR
is overlaid *onto* the intervention proteins, not the reverse. The page should
not imply an evidence tier that the paper does not define.

---

## 2. Data inventory — verified

All under `/n/groups/patel/IGLOO/UKB/HEAP/output/support/intervention_compare/`
unless stated. Written by
`HEAP/scripts/support/intervention_compare/run_intervention_compare.R`.

| File | Rows | Columns | On the site today? |
|---|---|---|---|
| `intervention_correlations.tsv` | 505 (168 exposure terms × 3 trials, `covarType=base`) | `covarType, exposure_id, intervention, r, pval, n_eff, pval_BH, sig_any` | partly — capped, see below |
| `intervention_scatter.tsv` | 25,415 (185 exposure terms × 1,488 proteins) | `covarType, exposure_id, Eid, Category, protein, beta_HEAP, se_HEAP, HERITAGE_effect, HERITAGE_se, GLP1_effect1, GLP1_se1, GLP1_effect2, GLP1_se2, olink_soma_r` | **SEs and Category dropped** |
| `exposure_mr_validation.tsv` | 186 | `exposure_id, Eid, Category, T2D, Obesity, Lipids, Hypertension, n_causal, mr_anchored, causal_proteins` | **no** |
| `shared_language_network_nodes.tsv` | 29 | `id, kind, label, class, breadth, R2_E` | **no** |
| `shared_language_network_edges.tsv` | 123 | `from, to, etype, tier, sign, weight` | **no** |
| `mr_pd_tiered.tsv` | 6,599 | `protein, disease, mr_tier, tier_rank, edge_class, coloc_confirmed, coloc_pph4, n_arms_qualified, replicated, beta, sign` | **no** |
| `coloc_pph4.tsv` | 28 | `protein, disease, pph4, colocalized` | **no** |
| `intervention_scatter_mr.tsv` | 25,415 | adds `mr_key, mr_edge_sig, mr_support, best_disease, padj_edge, beta_edge, n_dz_edge` | only 3 curated exposure slices |
| `intervention_mr_edges.tsv` | 71,339 | `mr_key, protein, disease, mr_edge_sig, mr_support, padj_edge, beta_edge` | **no** |
| `shared_signature.tsv` | 7 | `protein, grp, mr_tier, tier_rank, coloc_confirmed, dz, mr_sign, mr_beta, reliability, sports_b, meat_b, HERITAGE, GLP1, obs, obs_exposure` | **no** |

**Deposit.** `/n/groups/patel/IGLOO/UKB/HEAP/output/supp_deposit/S15_intervention_concordance.tsv`
is byte-for-byte `intervention_scatter.tsv` (both 5,084,271 bytes; 25,415 rows;
`covarType` is `base` only). So unlike the PES page, the deposit here is **not**
richer than the support tree — but it *is* richer than the figure exports, and
it is already sitting in `DEFAULT_DEPOSIT`, which means it can be registered as
`source_kind=deposit_tsv` with no upstream R run at all. That is the single
cheapest win on this page. Verified: every one of the 4,141 / 10,150 / 6,771
trial-effect values has a matching non-empty SE.

`\Dataref{intervention}` points at `intervention_scatter.tsv`
(`HEAP_manuscript/config/supp_tables.tsv:24`) and
`\Tref{intervention_concordance_matrix}` at `intervention_correlations.tsv`
(`:25`) — so the two tables the page most needs are exactly the two the paper
already publishes.

**Counts reproduced from the raw table** (`n_eff ≥ 8`, `pval_BH < 0.05`):
97 exposure terms significant in ≥1 trial; HERITAGE 31, STEP 1 94, STEP 2 78;
28 in all three; 203 significant cells of 504. These match
`macros/numbers.tex:100–103` exactly. The page can therefore state the paper's
headline numbers from data it already loads.

**Two filters the reader is never told about.** Both must appear on screen with
a count (house rule):

1. `run_intervention_compare.R:142,150` filters each trial's protein table to
   its own `q < 0.05` **before** any join. So the HERITAGE column is not "the
   193 proteins measured on both platforms", it is "the 193 proteins HERITAGE
   itself reported as FDR-significant that also appear in a replicated HEAP
   signature". A protein absent from a panel may be a null in the trial, not a
   platform gap. Per-trial protein overlap: HERITAGE 193, STEP 1 507, STEP 2 339.
2. HEAP pairs are the **replicated** ones — Bonferroni in both the train and
   test split, effect shown from the held-out test split
   (`run_intervention_compare.R:185–187`).

---

## 3. The printed figure (Fig 5) — the visual grammar to echo

Composite: `HEAP/scripts/visualizations/build_module4_composite_v4.R`
Rendered: `/n/groups/patel/IGLOO/UKB/HEAP/figures/exploratory/module4/Fig5_intervention_composite_v4.png`
(looked at, not inferred). Caption: `results_m4_intervention.tex:10–17`.

- **a — triangulation schematic** (`fig_m4_schematic_compact.tex`). Three boxes
  feeding one: Observational (HEAP exposure→protein, blue) and Interventional
  (HERITAGE, GLP1-RA, orange) and Genetic (MR cis-pQTL + coloc, purple) all
  arrow into "Convergent proteins → cardiometabolic disease".
- **b — concordance heatmap** (`fig_m4_panel_b.R`). y = exposure term, blocked
  into category strips coloured by `HEAP_ECAT_COLORS` (Sleep, Exercise, Diet,
  Sexual, Deprivation, Screen, Activity, Smoking, Alcohol, Vitamins, Sun);
  x = 3 trial columns + 4 disease columns. Trial cells: fill = weighted r on a
  blue–white–red diverging scale centred at 0, graded asterisks `*/**/***` at
  BH < 0.05/0.01/0.001, grey where `n_eff < 8`. Disease cells: purple fill,
  alpha and printed integer = count of Tier-1/colocalized causal proteins for
  that exposure × disease. Rows are gated to MR-anchored exposures and capped at
  3 per category.
- **c — per-protein scatter** (`fig_m4_panel_d.R`, `HEAP_CELL=1`). Two stacked
  facets, Strenuous sports over Processed meat. x = `HEAP exposure→protein β`,
  y = `GLP1 STEP1 shift`. Grey zero lines both axes. Grey dots = every protein;
  coloured dots = the 6 causal intermediates, coloured by *which disease they
  are causal for* (T2D orange, Obesity blue, Lipids green, HTN pink); a black
  ring = cis-pQTL colocalized; the causal proteins are text-labelled. A white
  corner box carries `r` and `FDR`. **No error bars in the print version.**
- **d — shared-language network** (`fig_m4_shared_network.R`). Three columns:
  sources (4 lifestyle exposures + HERITAGE + GLP1-RA) → proteins → 4 diseases.
  Proteins split into two blocks: CAUSAL INTERMEDIATES (6, top) and DISEASE
  REPORTERS (12, bottom). Node size = number of exposures reading it
  (`breadth`); node fill = green ramp on exposome R² (`R2_E`). Edge colour =
  sign (red raises, blue lowers the node it points at). Edge weight: thin =
  observational, bold = trial. Genetic linetype: solid = colocalized, dotted =
  reporter (reverse MR).

The grammar to carry over: **diverging-signed fill for concordance**, **exposure
category as the organising row**, **disease-of-causality as the point colour in
the scatter**, **a ring for colocalization**, and **the causal/reporter split
drawn as two physically separate blocks**.

Note a live inconsistency: the text quotes strenuous sports r = 0.66 (that is
STEP 2, verified in `intervention_correlations.tsv`) while panel c plots
STEP 1 (r = 0.74; `fig_m4_panel_d.R:34` defaults `HEAP_PANELD_INTERVENTION=GLP1_1`
"STEP1 covers all 6 Tier1 causal proteins (STEP2 only 3)"). Processed meat
−0.89 is STEP 1 on `processed_meat_intake_f1349_0_04`. An interactive panel with
a trial toggle dissolves the inconsistency instead of inheriting it — but the
default view should land on the cell the paper quotes.

---

## 4. The page today

`heap/frontend/src/pages/subpages/Intervention.js` (727 lines), five sections,
registered in `tools/web_sections.tsv` (7 rows, all `source_kind=figure`):

| Section | Source | Chart | Verdict |
|---|---|---|---|
| `intervention_scatter` — "UKB observational effect versus trial effect" | `fig_intervention_scatter.json`, 21,062 rows / 174 exposures / 647 proteins, sharded on `exposure_id` | scatter, x-error bars only, y = x dashed, opacity = `olink_soma_r` | closest to a real panel; missing y intervals, category colour, MR annotation |
| `intervention_compare` — "Signature-level concordance" | `fig_intervention_compare.json`, **195 rows / 65 exposure terms** | heatmap + black dot at BH < 0.05 | **silently truncated** (see below); no CI; no category blocking; ungraded stars |
| `glp1_exercise` / `glp1_diet` / `glp1_smoking` | 343 / 86 / 715 rows | scatter coloured by `mr_support` (Both / UKB only / DECODE only / None) | not a manuscript claim |
| `glp1_heritage_mr` | 648 rows | grouped **bar** of edge-type counts for 4 behaviours | not a manuscript claim |
| `health_behavior_arms` | — | heatmap of UKB β only | **a Module 2 figure**; its own subtitle says "no trial data enters this panel" |

Registry check (`HEAP/config/figures/figure_registry.tsv`): `manuscript_ref` is
`FigS4A;FigS4B;FigS4C` for `fig_intervention_compare`, `FigS4D` for
`fig_intervention_scatter`, and **`extra`** for `fig_glp1_heritage_mr`,
`fig_glp1_exercise`, `fig_health_behavior_arms`. Every one of the four plotters
that actually renders Fig 5 — `fig_m4_panel_b`, `fig_m4_panel_c`,
`fig_m4_panel_d`, `fig_m4_shared_network` — carries `website_export = no`.

**That is the whole diagnosis.** The page is built from the intervention figures
that happened to have `website_export = yes`, which are the *superseded* ones.
None of the printed main figure reaches the site.

**The truncation.** `fig_intervention_compare.R:77–124` filters to `sig_any`,
then collapses `exposure_lab` by stripping `_f<code>...` (so all levels of a
field share a label), then keeps `TOP_N = 28` labels by Σ|r|. Result: 65 of the
97 significant exposure terms are exported. The page's chip reads
"65 exposure terms × 3 trials" — accurate about what it holds, silent about the
32 it does not. A reader comparing the page to the paper's "97" gets no
explanation. This violates the "say so on screen with a count" rule at the exact
point where it matters most.

---

## 5. Proposed panel sequence

Seven panels. The order is the argument: *does it move* → *does it move with
the right sign* → *which proteins* → *are those causal or reporting*.

Shared conventions for all of them: exposure-category colour from
`lib/palette.js :: ecatColor` (keys `Exercise_Freq`, `Exercise_MET`,
`Diet_Weekly`, `Smoking`, `Alcohol`, `Sleep`, `Deprivation_Indices`,
`Vitamins`, `Sun_Exposure`, `Internet_Usage`, `Sexual_Factors`,
`Residential_Air_Pollution` — all present in `intervention_scatter.tsv:Category`
and all already in the palette). Every scatter is a
`components/LinkedScatterTable.js`, which already draws `xlo/xhi` and `ylo/yhi`
whenever a series supplies them. A one-line filter statement with a count under
every panel.

---

### P1 — Does the observational signature move under intervention?

**Question:** for each exposure, does its UKB protein signature correlate with
what a randomized (or supervised) intervention did to those same proteins?

- **Layout:** the established category-strip idiom
  (`components/pes/PesReads.js:252–355`), rotated to this measure. y = exposure
  **category** row (one row each, ordered by median |r|, weakest at the bottom);
  x = precision-weighted correlation r, running −1 to +1. Every exposure term is
  a jittered dot on its category row with a **95% CI bar** and a **dashed
  vertical line at r = 0** (the null). One ringed, centred, labelled exemplar
  per category. A trial toggle (HERITAGE / STEP 1 / STEP 2) swaps the points and
  keeps the frame fixed, exactly as the PES spec toggle does.
- **Colour:** `ecatColor(Category)`. **Size:** constant; strength is on x.
  **Ring + label:** the exemplar.
- **x axis title:** `Precision-weighted correlation between the HEAP
  exposure→protein signature (replicated, held-out test split) and the trial's
  reported protein shift`. **y:** `Exposure category`.
- **Data:** `intervention_correlations.tsv` — `exposure_id, intervention, r,
  n_eff, pval_BH` — joined to `Category` from
  `intervention_scatter.tsv`/`S15_intervention_concordance.tsv` (that join is
  exactly what `fig_m4_panel_b.R:127` does). CI from Fisher z on `n_eff`:
  `tanh(atanh(r) ± 1.96/sqrt(n_eff − 3))`. `n_eff` is the Kish effective N,
  `(Σw)²/Σw²` with `w = max(olink_soma_r, 0)` (`run_intervention_compare.R:165`).
- **Exists?** The correlations do; the current export is truncated to 65 terms
  and drops `Category`. **Needs:** register
  `intervention_correlations.tsv` as a new section (either a `deposit_tsv` copy
  or a `derived_tsv` join in `tools/`), un-capped at all **168** terms.
- **On-screen statement:** "168 exposure terms × 3 trials. 97 reach BH p < 0.05
  in at least one trial (HERITAGE 31, STEP 1 94, STEP 2 78; 28 in all three).
  *n* cells are blank: their effective N fell below 8 and they were excluded
  from the FDR family."
- **Conclusion it licenses:** C1, with its uncertainty visible — and the reader
  can see that HERITAGE's 31 is small because HERITAGE only reports 193
  proteins, not because exercise signatures fail.

---

### P2 — Does it move with the right *sign*?

**Question:** do healthier exposures track the therapeutic direction and harmful
ones oppose it?

- **Layout:** same category rows, same jitter, same exemplars as P1 — the reader
  learns the layout once (this is the PesReads/PesTracks pairing rule). Now
  x = **signed** r for the selected trial, with the panel split left/right of
  the dashed 0 line, and a small paired-arrow annotation for the two exemplars
  the paper names.
- Better still: a **slope pair** view — for each exposure, r vs HERITAGE on the
  left tick and r vs STEP 1 / STEP 2 on the right, one line per exposure
  coloured by category. That directly renders "physical activity is positive
  against *both*" (`results_m4_intervention.tex:28`).
- **Data:** same as P1. Nothing new.
- **Default selection:** strenuous sports
  (`types_of_physical_activity_in_last_4_weeks_f6164_0_0.multi_Strenuous_sports`)
  and processed meat (`processed_meat_intake_f1349_0_04`), pre-ringed, because
  those are the two the text quotes.
- **On-screen statement:** the exact paper values — strenuous sports r = 0.66 vs
  STEP 2, processed meat r = −0.89 vs STEP 1 — with a note that STEP 1 gives
  0.74 for sports, so a reader who lands on the other toggle is not confused.
- **Conclusion:** C2.

---

### P3 — The per-protein scatter behind any one correlation (the workhorse)

**Question:** is that correlation carried by the whole signature or by three
points?

- **Layout:** `LinkedScatterTable`, echoing printed panel c. x = HEAP
  exposure→protein β; y = trial protein shift. **Both** error bars: `xlo/xhi`
  from `beta_HEAP ± 1.96·se_HEAP`, `ylo/yhi` from `<trial>_effect ±
  1.96·<trial>_se`. Grey zero lines on both axes plus the y = x dashed
  reference. The linked table lets the reader name any point.
- **Colour:** the disease a protein is causal for, using the printed panel's
  palette (T2D `#D55E00`, Obesity `#0072B2`, Lipids `#009E73`, HTN `#CC79A7`),
  grey for everything else. **Ring:** cis-pQTL colocalized (`coloc_confirmed`,
  PP.H4 ≥ 0.8). **Opacity:** `olink_soma_r`, as today.
- **Axis titles:** x = `HEAP exposure→protein β (replicated in both splits;
  held-out test split, base covariates)`; y, per trial =
  `HERITAGE, 20-week endurance training: log₁₀ fold change (trial FDR q < 0.05)`
  / `STEP 1, semaglutide 2.4 mg vs placebo at 68 weeks: protein shift (trial FDR
  q < 0.05)` / same for STEP 2.
- **Data:** `S15_intervention_concordance.tsv` (already in the deposit dir) —
  `exposure_id, Category, protein, beta_HEAP, se_HEAP, HERITAGE_effect,
  HERITAGE_se, GLP1_effect1, GLP1_se1, GLP1_effect2, GLP1_se2, olink_soma_r`.
  Causal annotation joined from `shared_language_network_edges.tsv`
  (`etype == "gen_fwd"` → 6 protein→disease rows) or, for full coverage,
  `mr_pd_tiered.tsv` (`mr_tier ∈ {Tier1, Tier1plus}`, `coloc_confirmed`).
- **Exists?** The x error bars exist today. **The y error bars do not** — the
  website JSON (`fig_intervention_scatter.json`) carries `beta_HEAP, se_HEAP,
  effect, olink_soma_r` and drops all three trial SE columns. Fixing this needs
  no new analysis: re-register the section against the deposit TSV.
- **On-screen statement:** "*n* proteins plotted. The trial contributes only the
  proteins it reported at FDR q < 0.05 — HERITAGE 193, STEP 1 507, STEP 2 339 of
  the 1,488 proteins in HEAP's replicated signatures. A protein missing from
  this panel may be a null in the trial, not a platform gap."
- **Conclusion:** the correlation in P1/P2 is a cloud, not an artefact — and,
  because the ringed points are labelled, the reader meets the six causal
  proteins here for the first time.

---

### P4 — Which diseases does each exposure's concordance touch?

**Question:** is a concordant exposure connected to disease through genetically
supported proteins, or only through reporters?

- **Layout:** the printed panel b **purple block**, promoted to its own chart.
  y = exposure term, blocked by category strip (`ecatColor` on the strip, as the
  print does); x = 4 disease columns (T2D, Obesity, Lipids, Hypertension); fill
  = count of Tier-1/colocalized causal proteins, printed as an integer in the
  cell. Hover lists the actual protein names.
- **Data:** `exposure_mr_validation.tsv` — 186 rows, columns
  `exposure_id, Category, T2D, Obesity, Lipids, Hypertension, n_causal,
  mr_anchored, causal_proteins`. The `causal_proteins` field is a
  ready-made `"ALCAM(T2D);ASGR1(Lipids);FURIN(Hypertension);ICAM1(T2D);
  PCSK9(Lipids);PRSS8(Obesity)"` string — the hover text is already written.
  Distribution: `mr_anchored` TRUE for 109 exposures, FALSE for 76;
  `n_causal` runs 0 (76 exposures) to 6 (6 exposures).
- **Exists?** **No.** This file has never been exported. It is 26 KB. Needs one
  new registry row.
- **Conclusion:** C3's first half, at exposure resolution — and it makes the
  point that concordance and causal grounding are *different* properties, which
  is the whole reason panel b prints both blocks side by side.

---

### P5 — The causal minority, by name

**Question:** which proteins are actually causal, and on what evidence?

- **Layout:** a forest, not a heatmap. One row per protein→disease edge, ordered
  by tier then |β|. x = MR β with its **95% CI**; a dashed vertical null at 0;
  point shape/ring = colocalized; row shading = tier. Two labelled bands:
  **Tier 1+ (both pQTL arms)** — ASGR1→lipoprotein disorders (β = 0.2552,
  PP.H4 = 0.998), PCSK9→lipoprotein disorders (β = 0.4045, PP.H4 = 1.000) — and
  **Tier 1 (one arm)** — ALCAM→T2D (−0.175), FURIN→hypertension (0.3433),
  ICAM1→T2D (−0.0457), PRSS8→obesity (0.2951 / 0.3478).
- **Data:** `mr_pd_tiered.tsv` — `protein, disease, mr_tier, tier_rank,
  edge_class, coloc_confirmed, coloc_pph4, n_arms_qualified, replicated, beta,
  sign`. Tier census over all 6,598 rows: **Tier1plus 2, Tier1 8, Tier2 111,
  Suggestive 17, Null 6,460**; 10 rows `coloc_confirmed = TRUE`.
- **Gap:** `mr_pd_tiered.tsv` has `beta` but **no `se`**, so a CI cannot be
  drawn from this file. Either (a) join the SE from the Module 5 edge table the
  causal page already ships (`build/derived/mr_pd_effects.tsv`), or (b) add
  `se`/`lo`/`hi` to `mr_pd_tiered.tsv` upstream. **This must be resolved before
  the panel is built** — a bare β forest is exactly the "point estimate without
  its interval" the house rule forbids.
- **On-screen statement:** "Of 6,598 protein→disease edges tested across the
  intervention-concordant proteins, 2 reach Tier 1+ and 8 Tier 1. 6,460 are
  null." The scale of the denominator *is* the finding.
- **Conclusion:** C3, and the discussion's sharper "PCSK9 and ASGR1 were the
  only proteins supported by MR, colocalization, and replication across both
  platforms" (`discussion.tex:16`).

---

### P6 — The reporter majority, quantified

**Question:** how outnumbered is the causal minority?

- **Layout:** a single horizontal stacked/ordered bar over the proteins in the
  intervention comparison, split by MR edge class, with a companion count strip.
- **Data:** `intervention_scatter_mr.tsv` column `mr_edge_sig`. Distinct
  proteins by class: **PDcis 22, PDtrans 84, DP 594, None 793** — of 1,488
  proteins total. (`intervention_mr_edges.tsv`, 71,339 edge rows, gives the same
  picture at edge resolution: PDcis 22, PDtrans 86, DP 693.) That is the
  minority/majority claim as a single ratio: **22 proteins carry a cis
  protein→disease edge; 594 carry the reverse disease→protein edge.**
- **Exists?** `intervention_scatter_mr.tsv` is on disk but only three curated
  exposure slices of it reach the site. **Needs:** a small `tools/build_*.py`
  that reduces it to a per-protein class table (≈1,500 rows) rather than
  shipping 25k rows.
- **Caveat to print on screen:** `mr_edge_sig` is assigned per exposure–protein
  row against a `best_disease`, so a protein's class is "its strongest edge",
  not a global verdict. Say that, or the bar overclaims.
- **Conclusion:** the reason the paper calls the proteome a record. This is the
  single most thesis-carrying number on the page and it is currently nowhere.

---

### P7 — The shared-language network (interactive panel d)

**Question:** what does the whole picture look like at once?

- **Layout:** a direct interactive port of printed panel d. Three columns:
  6 sources (Strenuous sports, Processed meat, Usual walking pace, Current
  smoking, HERITAGE, GLP1-RA) → 18 proteins in two blocks → 4 diseases. Node
  size = `breadth`; node fill = green ramp on `R2_E`; edge colour = `sign`
  (red = raises, blue = lowers the node it points at); edge width thin =
  `etype == "obs"`, bold = `etype == "interv"`; genetic linetype solid =
  `tier == "colocalized"`, dotted = `gen_rev` / `gen_rev_causal`.
- **Data:** `shared_language_network_nodes.tsv` (28 nodes: 6 sources, **6 causal
  proteins** ALCAM ASGR1 FURIN ICAM1 PCSK9 PRSS8, **12 reporters** ADM CFH FABP4
  FSTL3 GDF15 GFRA1 IGFBP4 IL18R1 IL1RN LEP RARRES2 TNFRSF1A, 4 diseases) and
  `shared_language_network_edges.tsv` (122 edges: 56 `obs`, 24 `interv`,
  6 `gen_fwd`, 26 `gen_rev`, 10 `gen_rev_causal`). Together **7.8 KB** — this
  is the cheapest panel on the list to ship.
- **Exists?** **No.** Two new registry rows, no upstream work.
- **Interaction that earns the port:** click a protein and everything else
  fades — you see which exposures read it, whether a trial moved it, and whether
  its disease edge is forward-solid or reverse-dotted. On paper the 122 edges
  are a thicket; hovering is what makes it readable, which is the standard
  argument for porting a printed network rather than screenshotting it.
- **Conclusion:** the whole of C3 in one frame, with the 6:12 causal:reporter
  split drawn as physical position.

---

## 6. Claims the page currently CANNOT show

| Claim | Blocked by | Fix |
|---|---|---|
| C1's headline "**97** exposure terms" | export capped at 65 (`fig_intervention_compare.R:77–124`: `sig_any` filter → label collapse → `TOP_N=28`) | register `intervention_correlations.tsv` un-capped (168 terms) |
| Any CI on any concordance r | `n_eff` is exported but never used for an interval | Fisher-z from `n_eff`, client-side; no upstream work |
| Any CI on a trial effect | `fig_intervention_scatter.json` drops `HERITAGE_se`, `GLP1_se1`, `GLP1_se2` | re-source from `supp_deposit/S15_intervention_concordance.tsv` |
| Graded significance `*/**/***` | export writes a single flat `star` ∈ {`*`,``} | recompute from `pval_BH` client-side |
| Exposure-category colour anywhere | `Category` is in the scatter table but not in the compare export | join, or ship the deposit TSV which already has it |
| **C3's six named causal intermediates** | no MR/coloc table on this page at all | `mr_pd_tiered.tsv` + `shared_language_network_*.tsv` |
| **C3's reporter majority** | no reverse-MR view on this page | `intervention_scatter_mr.tsv` reduction (P6) |
| Panel b's purple per-disease causal counts | `exposure_mr_validation.tsv` never exported | one registry row |
| Panel a's triangulation logic | no schematic on the page | see §8 |
| A CI on the MR β in P5 | `mr_pd_tiered.tsv` has `beta`, `sign`, no `se` | join `build/derived/mr_pd_effects.tsv`, or add `se` upstream |
| "HERITAGE n = 654, STEP 1 n = 1133, STEP 2 n = 595" (`results_m4_intervention.tex:28`) | trial *N*s live only in prose | hardcode in the panel header — they are constants, not data |

The single biggest one: **the page cannot name a single causal intermediate or a
single reporter.** C3 is the claim that carries the paper's thesis into this
section, and the entire evidence base for it — `mr_pd_tiered.tsv`,
`coloc_pph4.tsv`, `exposure_mr_validation.tsv`, both
`shared_language_network_*.tsv` — has zero presence on the site.

---

## 7. Currently shown but not claimed / charted wrong

- **`health_behavior_arms` — remove from this page.** Registry
  (`figure_registry.tsv:165`) classes it `association_heatmap`,
  `required_modules = module2`, `manuscript_ref = extra`. Its own on-page
  subtitle says "Observational UK Biobank effects only — no trial data enters
  this panel." It belongs on Associations, if anywhere.
- **`glp1_heritage_mr` — the one true raw-chart failure.** It reduces 648 rows
  carrying `beta_HEAP, se_HEAP, effect, olink_soma_r, mr_edge_sig, mr_support,
  padj_edge, beta_edge` to a **grouped bar of counts**. It throws away every
  effect size and every SE to plot four integers. If it survives at all it
  should be the P3 scatter with `mr_edge_sig` as the colour — which is what the
  underlying figure (`fig_glp1_heritage_mr.R`) actually draws on paper.
- **`glp1_exercise` / `glp1_diet` / `glp1_smoking` — fold into P3.** Three
  hardcoded exposures with `manuscript_ref = extra`, each a slice of
  `intervention_scatter_mr.tsv` that P3 covers for all 185 exposures. Their one
  genuine addition is the `mr_support` colouring (Both / UKB only / DECODE only
  / None) — carry that into P3 as a colour-by toggle and retire the three
  sections. Note their subtitle is inaccurate as written: "coloured by which MR
  arm carried that protein's strongest protein–disease edge" is `mr_support`,
  but the paper's causal claim is tiered (`mr_tier`), and arm-count is only one
  input to it (`n_arms_qualified` in `mr_pd_tiered.tsv`). Colouring by arm
  reads as an evidence tier and is not one.
- **The compare heatmap's black dot.** Ungraded, where the print grades
  `*/**/***`. With 139 of 195 cells starred, a single threshold makes almost
  everything look equally significant.
- **The cross-platform warning banner is right and should stay.** It is the best
  thing on the page. It should gain the second filter — the trial-side
  `q < 0.05` gate — which is currently invisible everywhere.

---

## 8. Diagrams

Two are worth drawing as inline SVG, in the `components/TriadDAG.js` idiom
(hand-placed geometry, exact node/edge positions, absent edges drawn as absent
because absence is data — `TriadDAG.js:8–22`).

### D1 — Evidence triangle (port of printed panel a) — **build it**

Three source boxes converging on one: **Observational** (HEAP exposure→protein,
UKB, n > 50,000, Olink) and **Interventional** (HERITAGE 20-week endurance
training n = 654; STEP 1 / STEP 2 semaglutide 68 weeks, n = 1133 / 595, SomaScan)
and **Genetic** (cis-pQTL MR + colocalization, PP.H4 ≥ 0.8) → **Convergent
proteins** → **cardiometabolic disease**.

*Why a diagram beats a plot:* the reader's first question on this page is "what
is being compared to what, and are these the same people?" They are not — three
different cohorts, two different assay platforms, one observational and two
interventional. No scatter can say that. Make each box a live control: clicking
Interventional filters the page to trial-concordant exposures, clicking Genetic
filters to MR-anchored ones (`exposure_mr_validation.tsv:mr_anchored`, TRUE for
109 of 185). The diagram then doubles as the page's navigation, which is what
earns it the top slot.

Annotate each arrow with its actual count: 97 exposure terms concordant with ≥1
trial; 109 exposures MR-anchored; 6 proteins in the intersection.

### D2 — Design diagram: how a trial contrast maps onto a UKB β — **build it**

A small two-panel figure. **Left:** UKB — one cross-section, ~50k people, a
regression line through exposure vs protein, β = the slope, its SE from the
held-out test split, replication = Bonferroni in both splits. **Right:** a trial
— the *same* people measured twice, arms randomized (or all trained), effect =
post − pre (HERITAGE, log₁₀ fold change) or treatment − placebo at 68 weeks
(STEP). A brace underneath: "P3 plots the left quantity against the right
quantity, one point per protein."

*Why a diagram beats a plot:* the honest weakness of Module 4 is that the x and
y of every scatter on this page are **not the same estimand** — a between-person
slope against a within-person change, on two assay platforms, in three
populations (healthy sedentary volunteers; people with obesity; people with type
2 diabetes). That is not a caveat to bury, it is the thing that makes r = 0.66
interesting rather than trivial. Drawing it once, at the top of P3, prevents
every subsequent misreading and does the work the manuscript does in prose at
`methods.tex:160`.

**Not worth drawing:** a fourth "MR tier ladder" schematic. `EvidenceTiers.js`
and `MotifKey.js` already carry that on the causal page; link to it.

---

## 9. Wiring checklist

Ordered by (value ÷ effort). Steps 1–3 need **no upstream R run at all** — the
files are already in the deposit or the support tree that `build_payload.py`
can reach (`tools/build_payload.py:38–42`).

1. **Re-source the scatter from the deposit.** New `web_sections.tsv` row:
   `intervention | intervention_effects | S15_intervention_concordance.tsv | K |
   exposure_id | … | scatter | on | deposit_tsv`. Unlocks y-axis CIs,
   `Category` colour, and all 185 exposure terms. → P3.
2. **Ship the un-capped correlations.** `intervention_correlations.tsv` as a
   `deposit_tsv` copy (or a `derived_tsv` join that attaches `Category`).
   65 → 168 terms, and the paper's 97 becomes statable. → P1, P2.
3. **Ship the network.** `shared_language_network_{nodes,edges}.tsv`, 7.8 KB
   combined. → P7.
4. **Ship the MR annotation.** `exposure_mr_validation.tsv` (26 KB) → P4;
   `mr_pd_tiered.tsv` (456 KB) + `coloc_pph4.tsv` (1.4 KB) → P5.
5. **Derive the reporter census.** New `tools/build_intervention_protein_class.py`
   reducing `intervention_scatter_mr.tsv` to one row per protein → P6.
6. **Resolve the missing MR `se`** before P5 ships (join
   `build/derived/mr_pd_effects.tsv`, or add it upstream).
7. **Retire** `health_behavior_arms` from this page; **fold**
   `glp1_exercise` / `glp1_diet` / `glp1_smoking` / `glp1_heritage_mr` into P3.

Optional but principled: set `website_export = yes` on `fig_m4_panel_b`,
`fig_m4_panel_d` and `fig_m4_shared_network` in
`HEAP/config/figures/figure_registry.tsv`, so the site's intervention sections
are fed by the plotters that render the printed figure rather than by their
predecessors. That is the structural fix for how this page drifted in the first
place.
