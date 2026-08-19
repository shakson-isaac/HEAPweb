# HEAP website — design plan

Status: **agreed, not yet built** · v2 2026-08-18 · Supersedes the heap.bio structure built
for the original manuscript.

Merged from two sources: the reviewer suggestion list (structure, evidence ladder, page
inventory) and a repo audit (measured payload costs, verified numbers, gap register). Where
the two disagreed, the repo value wins — see [§13](#13-gap-register), which records three
disagreements that are **author decisions, not build decisions**.

Nothing here is assumed into existence. Every number below traces to a macro, a registry, or
a measurement, and says which.

---

## 1. Why rebuild

heap.bio was built for the original manuscript and its public framing still describes four
modules and the old structure. The revised manuscript makes a **different central claim**:

> *only a minority of exposure-responsive proteins were consistent with causal intermediates,
> whereas many appeared to function as biological reporters of exposure burden, disease
> liability, and early disease processes.*

The proteome is a **record** of how someone has lived. Most exposure-responsive proteins are
**reporters**; a minority are **causal intermediates**. The site's job is to make that
distinction visible on every result, rather than presenting all associations as equivalent.

The target is **not** "interactive versions of our paper figures." It is a
**UniProt / GWAS-Catalog-style lookup for the exposome–proteome interface**: arrive knowing
one protein, one exposure, or one disease; leave with the complete HEAP evidence around it
and exactly the file you need.

### Two concrete contradictions in the current site

| current site | current manuscript |
|---|---|
| **Interactions (G×E)** has equal top-level billing | G×E variance was small, poorly reproducible across methods, no enriched pathways → **demoted to the supplement** (`CLAIMS_LEDGER.md`, 2026-06-19) |
| **Mediation** is a top-nav item | Observational mediation is explicitly *descriptive*; causal adjudication is MR + colocalization |
| Associations keyed on `_Type6assoc.html` | Type1–7 covariate naming is **retired** for descriptive base/primary sets |

### Audience, in priority order

1. **A researcher who wants one thing** — the smoking PES weights, the mediation result for
   IL6, summary stats for their protein. One click or one `read_parquet()`, not a 936.8 MB zip.
2. **A reader of the paper** interrogating a figure beyond what print allows.
3. **A first-time visitor** who needs the claim in thirty seconds.

---

## 2. Decisions locked

| # | Decision | Chosen |
|---|---|---|
| D1 | Organizing principle | **Entity-first lookup** — protein / exposure / disease |
| D2 | Main manuscript figures | **Published static figure + interactive explorer beneath** |
| D3 | Researcher API | **Static file API over CDN**, documented URL scheme, no server |
| D4 | Homepage | **Updated graphical abstract + global search + macro-driven stat bar** |
| D5 | Frontend host | Firebase Hosting only (Cloud Run frontend retired) |
| D6 | Payload storage | Public GCS bucket, one object per key, gzipped |
| D7 | **Evidence ladder** | A shared badge vocabulary used on *every* relationship, site-wide |
| D8 | Specification switcher | Alternative covariate specs exposed as a dropdown, not a download |
| D9 | **Protein classification** | **Motif profile per (protein, disease)**, using the paper's own six-edge Tier-1 rule — not a single per-protein label |
| D10 | Dataset citation | **Version strings only, no DOIs.** Readers cite the paper, not the datasets |

**D2 rationale**: `CLAIMS_LEDGER.md` rule — *the main figure is ground truth*. A rebuilt
interactive chart that quietly disagrees with the printed panel breaks that. The printed
figure is shown as printed; the interactive panel sits beneath, labelled an explorer.

**D7 is the most important design decision on this page.** See §5.

---

## 3. Verified numbers

Every figure below is read from `HEAP_manuscript/macros/*.tex` at build time. **Nothing on the
site is hand-typed.** Two pairs are easy to conflate and must never be:

| macro | value | meaning |
|---|---|---|
| `\nProteins` | **2,686** | proteins in the analyzed panel (Module 1) |
| `\nProteinsPES` | **2,923** | proteins in the PES longitudinal panel (Module 6) — *a different panel* |
| `\nExposures` | **169** | exposomic features |
| `\nExposuresAssoc` | **127** | exposures with ≥1 replicated association |
| `\nProteinsAssoc` | **1,533** | proteins with ≥1 replicated association |
| `\nReplAssoc` | **22,240** | replicated exposure × protein associations |
| `\nDiseasesGEM` | **181** | incident disease outcomes |
| `\nExposuresPES` | **164** | proteome-based exposure scores — ⚠ **160** on disk, see G3 |
| `\nColoc` | **18** | colocalized cis-pQTL loci |
| `\nMotifTierOne` / `\nMotifTierOneProt` | **six / three** | Tier-1 mediator motifs / distinct proteins (ASGR1, ADM, FURIN) — read from `S_mr_triads`, see G1 |
| `\nCausalCore` / `\nCausalCorePct` | **six / 0.2%** | the "minority causal" headline |
| `\nMotifTriads` | **84** | ⚠ nominal-significance motif count — **not** the Tier-1 number; never show this as the headline |

**Homepage stat bar** (D4): 50K+ participants · 2,686 proteins · 169 exposures · 22,240
replicated associations · 181 diseases · 164 exposure scores · 6 causal directions per triad.

Strapline beneath: *Most exposure-responsive proteins behave as biological reporters; a small
subset has genetic evidence consistent with causal mediation.*

---

## 4. Site map

```
/                            Home — claim, global search, graphical abstract, stat bar
/start                       "Start here" — five use-case entry points

/explore
  /protein/<SYMBOL>          /protein/LEP        the signature feature
  /exposure/<SLUG>           /exposure/physical-activity
  /disease/<SLUG>            /disease/type2-diabetes
  /triad/<E>/<P>/<D>         /triad/tv-time/ASGR1/lipoprotein-disorder

/evidence                    Causal Evidence browser — the six directed edges
/evidence/explorer           three-way E → P → D Evidence Explorer

/architecture                Genetic & exposomic architecture
                             HEAP predictive decomposition · GREML · cis/trans · G×E

/interventions               Intervention concordance explorer (HERITAGE / STEP1 / STEP2)

/pes                         Proteome-Based Exposure Scores — browser + model cards
/pes/<EXPOSURE>              one score's model card + weights

/data                        Data catalog — eight cards matching Supplementary Data
/data/<KEY>                  one dataset: preview, schema, methods, version, DOI, cite
/data/api                    API documentation, copy-paste R / Python / curl
/data/dictionary             Exposome Dictionary — all 169 features

/figures/1 … /figures/6      published figure + caption + explorer + downloads

/docs
  /docs/about                the claim, the framework, the reframe
  /docs/quickstart
  /docs/models               statistical models and specifications
  /docs/evidence-tiers       what each badge means
  /docs/pes-tutorial
  /docs/methods
  /docs/changelog            v1 → v2, what materially changed
  /docs/cite
  /docs/faq
```

**Retired**: `Interactions` as a top-level page (→ `/architecture` + exposure pages);
`Lifestyle Categories` standalone (→ absorbed into exposure pages); `Mediation` as a top-nav
item (→ "Disease Links" *within* entity pages, plus `/evidence` for causal adjudication);
`Main Results` (→ `/figures/1`).

---

## 5. The Evidence Ladder — D7

**The single most important scientific-design principle on the site: never show a generic
green "significant" badge.** Every relationship carries an explicit evidence level, and
association is visually separated from causal support.

The vocabulary, taken from the manuscript's own MR framework
(`results_m5_mr.tex:12`, `extended_data.tex:56`):

```
  Observational            an estimate exists
  Replicated               train ✓ test ✓
  MR Suggestive            unresolved direction
  MR Tier 2                FDR-significant
  MR Tier 1                + sensitivity robustness + established causal direction
  MR Tier 1+               + cis-anchored, colocalized, AND replicated across
                             the UKB and deCODE pQTL panels
  Colocalized              PP.H4 >= 0.8   (18 loci)

  NB Tier 1 / Tier 1+ are CIS-ONLY in practice: no Ptrans_* edge reaches them
     (cis 14/4 vs trans 0/0). Trans evidence enters at Tier 2, where it dominates
     (cis 55 vs trans 135). So the ladder is also a cis -> cis+trans axis.
  Intervention concordant  HERITAGE / STEP1 / STEP2 agreement
```

Rendered as an **evidence rail** — filled nodes for the evidence that exists:

```
  Association ─▶ Replication ─▶ MR ─▶ Colocalization ─▶ External perturbation
      ●              ●            ●           ●                  ○
```

A relationship therefore reads:

```
  Smoking pack-years → ADM → atrial fibrillation
    Exposure → protein     Tier 1+
    Protein → disease      Tier 1+ · coloc PP.H4 = 0.966
    Observational mediated fraction   15%   ⓘ
```

The ⓘ next to any observational mediation figure expands to, verbatim:

> Observational mediation estimates are descriptive and may reflect confounding, reverse
> causation, or shared upstream causes. Causal support is evaluated separately using MR and
> colocalization.

**Per-protein HEAP classification.** The ladder is what makes the reframe concrete, replacing
a hand-assigned label with a derived one:

```
  Strong exposure-responsive protein
  Biological reporter — supported by exposure → protein MR
  No supported protein → disease causal effect
```

The exact derivation rule is an **author decision** (G4) — the site renders whatever rule is
recorded, and shows it in the provenance drawer.

---

## 6. Page specifications

Pseudocode is intent, not final code. `payload(...)` is one gzipped object from the CDN.

### 6.1 Home `/`

```
SHOW  hero
        "HEAP: Human Exposomic Architecture of the Proteome"
        "Explore how 169 modifiable lifestyle and environmental exposures are reflected
         in the human plasma proteome, how these signatures relate to disease, and which
         relationships have genetic or interventional support."
        <GlobalSearch placeholder="Search exposures, proteins, diseases, pathways, tissues">
        examples: smoking · physical activity · LEP · GDF15 · type 2 diabetes
      four entry cards
        Search an exposure · Search a protein · Search a disease · Download data & scores
      updated graphical abstract (SVG, clickable regions → entity pages)
      stat bar (§3) + reporter/mediator strapline
DATA  payload("meta/headline.json")     ← generated FROM macros/*.tex (G3)
      payload("meta/search_index.json") ← Tier M, one file, all entities
```

### 6.2 `/start` — Start here

Five use cases, each a link, because researchers should not need to know what "variance
decomposition" means to enter:

```
I study a protein            → exposures, variance architecture, disease links, causal evidence
I study a lifestyle exposure → proteomic signature, pathways, intervention concordance, PES
I study a disease            → lifestyle-linked proteins; mediators vs disease-responsive reporters
I have my own proteomics cohort → download PES weights, reproduce HEAP scores
I want HEAP summary statistics  → browse or bulk-download everything
```

### 6.3 Protein page `/explore/protein/LEP` — the signature feature

One request returns everything. **Measured: median 29.9 KB gz, max 37.5 KB** across the eight
major protein-keyed sources.

```
GIVEN protein P
FETCH payload("protein/" + P + ".json")          # ~30 KB gz, one request

HEADER  P · full name · UniProt · Olink panel
        [Copy link] [Copy citation] [Download result]

MOTIF PROFILE CARD                                ← the reframe, per protein (D9)
        "Causal for 1 disease · reporter for 23"
        A Mediator            1 disease   -> lipoprotein disorders   [drill in]
        B Biomarker           3 diseases
        C Exposure-marker    17 diseases
        E Disease-liability   3 diseases
        (ASGR1's real profile, from S_mr_triads; 601 proteins have one)
        Each row expands to its triads -> /explore/triad/<E>/<P>/<D>

EVIDENCE CARD
  Exposure responsiveness   PXS R² · GREML exposomic V/Vp
  Genetic variance          total · cis · trans
  Top associated exposures  ranked list
  MR directionality         Exposure → P  ✓        P → disease  —
                            Disease → P  ✓        P → exposure  —
  Intervention              HERITAGE / STEP1 / STEP2 directional concordance

TABS
  Exposures        volcano + ranked table: β · CI · P · train/test · sensitivity status
  Architecture     stacked R²: covariate / genetic / exposomic / G×E; spectrum position
  Disease links    observational mediation, labelled descriptive, with the ⓘ caveat
  Causal evidence  every MR edge in/out of P, with ladder badges and coloc PP.H4
  Intervention     P's response in each trial vs UKB
  PES membership   which of the scores include P, and its weight            (G5)
  Download         this protein as JSON / TSV · all source rows

EVERY panel carries a <ProvenanceDrawer/> (§9) and a <SpecSwitcher/> (§8)
EMPTY states distinguish "not tested" from "tested, not significant"
```

### 6.4 Exposure page `/explore/exposure/physical-activity`

```
SUMMARY BAR   category · UKB field · variable type · N
              # significantly associated proteins
              # Tier 1 / Tier 1+ MR-supported exposure → protein edges
              PES performance
              diseases where the PES adds predictive information

TABS
  Protein associations  interactive volcano / ranked table
                        Protein | β | CI | P | train/test replication | sensitivity status
  Biological programs   Reactome pathway + GTEx tissue enrichment
  Causal evidence       MR-supported exposure → protein relationships, laddered
  Disease links         observational mediation, labelled descriptive
  Intervention          HERITAGE / STEP1 / STEP2 concordance
  PES                   R²/AUC/AUPR · longitudinal tracking · disease value
                        ▸ DOWNLOAD WEIGHTS — a top-3 site action, always visible
```

### 6.5 Disease page `/explore/disease/<slug>`

Entity source is **`module3/disease_list.tsv` (181 diseases)**, NOT `fig_gem_landscape`, which
covers only 72. Labels derive from the `DZ_ID` pattern; FinnGen ids join via `MRmotifs.Disease_UKB`.

```
  Mediators        proteins mediating exposure → D, NIE HR forest, laddered
  Causal           MR edges into D by tier, coloc status
  Prediction       PES ΔC-index for D across exposures
  Exposure burden  which exposure categories route through D
```

### 6.6 Triad page `/explore/triad/<E>/<P>/<D>`

A citable URL for a single relationship — so a collaborator can be sent one link.

```
SHOW  E → P → D as a diagram
      all SIX directed MR relationships from the E–P–D framework (Fig 4)
        E→P   P→E   P→D   D→P   E→D   D→E
      each with its ladder badge, instrument count, F-stat, Steiger, PP.H4
      observational mediated fraction, with the ⓘ caveat
      HEAP interpretation:  Supported mediator | Exposure reporter
                            Disease-liability reporter | Ambiguous
      [Copy link] [Copy citation]
```

### 6.7 Causal Evidence browser `/evidence`

Replaces the old prominence of the mediation module.

```
FACETS   Exposure → Protein · Protein → Disease · Disease → Protein · Protein → Exposure
         Supported mediator motifs · Reporter motifs · Colocalized loci
FILTERS  exposure · protein · disease · MR tier · PP.H4 · UKB Olink support ·
         deCODE SomaScan support · instrument count · F-statistic · sensitivity robustness
SOURCE   Supplementary Data 05 — every directed edge with its confidence tier

FEATURED  the Tier-1 cis-anchored colocalized mediator triads, prominently
          the six Tier-1 triads from S_mr_triads (ASGR1 x3, ADM, FURIN x2)
```

### 6.8 Evidence Explorer `/evidence/explorer` — the visual centrepiece

```
THREE selectors:  Exposure  →  Protein  →  Disease
                  any one, two, or all three may be set

Selecting "Smoking pack-years" builds:   Smoking → ADM → Atrial fibrillation

SHOW  each of the six directed relationships with its ladder badge
      HEAP interpretation banner at the top
      click any node → that entity's page
```

### 6.9 Interventions `/interventions`

Not a reproduction of Figure 5 — an explorer.

```
CHOOSE  UKB exposure           e.g. Strenuous sport
        Reference intervention HERITAGE | STEP1 | STEP2
SHOW    scatterplot · weighted correlation · N overlapping proteins · FDR
        Tier 1+ proteins highlighted; click a protein → its page
CAVEAT  displayed in the UI, not buried:
          Cross-platform evidence
          Olink ↔ SomaScan concordance: 0.xx
          High / Moderate / Low assay transferability
        (the comparison is restricted to overlapping proteins and incorporates
         known Olink/SomaScan agreement)
```

### 6.10 PES `/pes` — a first-class resource

Likely the most-reused part of the site.

```
TABLE  one row per score (164 declared; 162 currently on disk — G3)
       Exposure | Type | Performance | Longitudinal tracking | Disease value | Proteins | Download

CLICK → model card /pes/<EXPOSURE>:
  Performance     R² / AUC / AUPR with bootstrap CIs · within-person tracking · disease ΔC
  Panel           k proteins, listed, with weights
  ▸ Download weights
  ▸ How to compute this score
        PES = Σ βᵢ × normalized proteinᵢ
        minimal R and Python examples, copy-paste, ten lines
  Specification   stated exactly, because a score is useless without it:
        Olink protein identifiers · expected normalization · missing-value handling
        intercept · outcome transformation · training covariates · required proteins
        behaviour when some proteins are unavailable   (only if derivable safely)
```

The bundle is already staged one folder per exposure with metadata and scrubbed paths — the
builder's own header states the intent: *"someone who wants the smoking PES should download
one small file, not filter a 104,047-row table."*

### 6.11 Data catalog `/data`

No generic giant Download button. Eight cards matching Supplementary Data exactly, generated
from `HEAP_manuscript/config/supp_tables.tsv` so **the site and the supplement cannot
disagree**:

```
01 Variance decomposition   per-protein HEAP + genetic/exposomic/G×E across specifications
02 Exposure–protein associations   all coefficients, all specifications
03 G×E associations
04 Observational disease mediation
05 Mendelian randomization  every directed edge + evidence tier
06 Intervention concordance
07 PES results              exposure prediction, tracking, disease prediction
08 PES weights

EACH CARD   Download · Preview · Schema · Methods · Version + build date
            Cite: the paper (datasets are not separately citable by design)
```

Version + build date let a researcher state which build they used; the citation is always the paper.

### 6.12 Exposome Dictionary `/data/dictionary`

Unglamorous, high value. All 169 features:

```
Display name · UKB field ID · Category · Original coding · HEAP coding
Binary/ordinal/continuous · Missingness · Included/excluded · Units
Reference category · Transformation
SOURCE  exposome_manifest (already a registered supplementary table)
```

### 6.13 Figure pages `/figures/<n>`

```
FOR n IN 1..6
  published PNG at print resolution, exactly as printed
  the real caption from config/figures/legends/<id>.md
  downloads: PDF · PNG · plotted data TSV · plotter script
  ── divider ──
  "Explore this figure" — interactive panel on the SAME data
  a line naming the registry figure_id and build date

n → 1 M1 variance · 2 M2 association · 3 M3 mediation
    4 M4 MR (code module5) · 5 M5 intervention (code module4) · 6 M6 PES
  ⚠ manuscript numbering ≠ code directory numbering — see MODULE_NUMBERING.md
```

---

## 7. Data API — D3

**Contract**: every URL is a static object on a public CDN. No auth, no rate limit, no cold
start, no server. Versioned under `/v1/`; `v1` URLs never change meaning.

```
BASE  https://storage.googleapis.com/heap-web-data/api/v1

  catalog.json                        every dataset: id, title, schema, sizes, URLs
  meta/headline.json                  headline numbers, from manuscript macros
  meta/search_index.json              all searchable entities

  protein/<SYMBOL>.json               everything for one protein          ~30 KB gz
        SYMBOL is the TRUE HGNC symbol (HLA-A, not HLA_A). HEAP_loader.R:870
        makes ids R-safe, so the mediation/MR exports carry underscores for
        4 proteins; the packer republishes them under the real symbol and
        records the alias. Verified: 0 mangled objects in the bucket.
  exposure/<SLUG>.json                everything for one exposure
  disease/<SLUG>.json                 everything for one disease
  triad/<E>/<P>/<D>.json              six directed edges + interpretation
  {protein,exposure,disease}/_index.json

  mr.json                             all directed edges + tiers
  mr/triads.json                      the six Tier-1 mediator triads (from S_mr_triads)
  mr/protein/<SYMBOL>.json            edges touching one protein

  pes/_manifest.tsv                   all scores + accuracy
  pes/<EXPOSURE>/weights.tsv          deployable weights, ready to apply
  pes/<EXPOSURE>/metadata.json        k, impute medians, UniProt match method

  table/<KEY>.parquet                 full table, columnar   ← analysis workhorse
  table/<KEY>.tsv
  table/<KEY>.schema.json             columns, types, units, provenance

  figure/<FIGURE_ID>.json             exact plotted data behind any figure
```

Shown verbatim on `/data/api`:

```r
arrow::read_parquet("https://…/api/v1/table/mr_edges.parquet")
jsonlite::fromJSON("https://…/api/v1/protein/LEP.json")
readr::read_tsv("https://…/api/v1/pes/smoking_status_current/weights.tsv")
```

```python
import pandas as pd
pd.read_parquet("https://…/api/v1/table/mr_edges.parquet")
pd.read_json("https://…/api/v1/protein/LEP.json")
```

**Why Parquet**: columnar and compressed, so a 1.2 M-row table is a fraction of the TSV, and
both `arrow` and `pandas` read it over HTTPS while pushing column selection down. Pulling
three columns does not cost forty.

**Deliberate non-goal**: no server-side filtering. Clients filter locally. The API is free to
serve and impossible to take down; the cost is whole-table downloads for the largest tables,
mitigated by Parquet column pruning.

This satisfies the "eventually expose a lightweight API" goal **at launch**, because the
frontend and the public API are the same static files.

---

## 8. Specification switcher — D8

The supplement deliberately releases results under alternative specifications. The site
should **expose that robustness rather than making researchers download enormous tables.**

```
<SpecSwitcher>   Primary ▾
                   Primary
                   + BMI
                   + blood collection
                   + clinical covariates
                   healthy at baseline
                   …

Changing it re-renders the panel from a sibling payload object.
```

Sources already deposited: `varcomp_specs`, `varcomp_specs_fine`, `assoc_E_specs`,
`assoc_GxE_specs`, `med_specs_exposome`, `med_specs_genetic`, `pes_read_specs`,
`pes_tracking_specs`, `pes_disease_specs`.

**Cost, stated honestly**: this multiplies an entity bundle by the number of specifications.
Mitigation — ship **Primary in the base bundle** and lazy-load a spec only when selected:

```
protein/LEP.json                 primary only, ~30 KB   (always fetched)
protein/LEP.spec.<SPEC>.json     one alternative        (fetched on demand)
```

⚠ **BMI adjustment is not mediation.** Attenuation under BMI cannot distinguish mediation from
confounding. The switcher must not imply otherwise; `+ BMI` is labelled a sensitivity
specification, never a mediation test.

---

## 9. Provenance drawer

A researcher looking at β = −0.14 should never open a PDF to learn what produced it. Every
estimate exposes:

```
Estimate                 standardized β, CI, P
Sample                   N = …
Model                    primary HEAP specification
Covariates               age, age², sex, interactions, assessment centre, PCs, …
Replication              train ✓  test ✓
Multiple-testing         Bonferroni / BH-FDR, with the threshold
Source                   Supplementary Data 02
HEAP version             v2.0 · manuscript date · DOI
                         ▸ View sensitivity analyses
```

---

## 10. Payload tiers

Extends the tiering implemented in `tools/build_payload.py`.

| tier | contents | shape | per request |
|------|----------|-------|-------------|
| **S** | summary / figure-level sections | one columnar blob | 0.2 – 39 KB |
| **K** | large tables keyed by one entity | one blob per key | 4 – 20 KB |
| **E** | **merged entity bundles** (new) | one blob per entity | **~30 KB, measured** |
| **M** | catalog, search index, headline numbers | one small blob | < 50 KB |
| **T** | full tables for download | Parquet + TSV | whole file |

Tier E is why entity-first is affordable: the packer does the join **once at build time**, so
a protein page fires one request instead of eight.

**Measured**: 2,690 proteins × median 29.9 KB gz = **78.2 MB** for the whole protein tier.

### Multi-key sharding

`tools/web_sections.tsv` allows **one** `key_column` per section. Entity-first needs the same
source sharded on several keys — `fig_mediation_main` by `protID` for protein pages *and* by
`DZ_ID` for disease pages. The config gains a `key_columns` list; the packer emits one shard
tree per key.

---

## 11. Performance budget

| metric | budget | how |
|---|---|---|
| Home first paint | < 150 KB JS | plotly code-split; home plots nothing |
| Entity page | 1 request, < 40 KB | tier E pre-joined at build time |
| Figure explorer | < 1.4 MB plotly chunk, cached across routes | `React.lazy` per route |
| Any API object | < 100 KB gz | sharding; whole tables only under `/table/` |
| Repo clone | < 10 MB | result data in GCS, not git |

**Already implemented** (current branch): columnar encoding · one object per key ·
deterministic gzip (`mtime=0`, so a one-figure change re-uploads one object not 2,727) ·
code splitting (1.51 MB → 125 kB) · client-side table ops · whole-column type recovery at
pack time.

**Two-tier cache TTL** (added after a real incident): entry points — `manifest.json.gz`,
`catalog.json.gz`, `meta/*`, every `_keys`/`_index` — get `max-age=60`; content shards keep
`max-age=3600`. Everything is fetched by a path named in an entry point, so a stale entry point
makes the whole payload look stale. Before this, a republish took up to an hour to become
visible and read as a build bug: a canonicalized `_keys.json` was verified correct on disk while
the CDN still served the previous one.

**Still to do**: Parquet emission · preload entity bundle on search-result hover · bundle-size
check in CI.

---

## 12. Build & publish pipeline

```
O2  (all analysis output lives here; none of it is in this repo)
  HEAP/figures/website/*.json              128 figure exports, 1.1 GB
  HEAP/output/supp_deposit/**              deposit tables, PES weights
  HEAP_manuscript/config/supp_tables.tsv   the catalog's source of truth
  HEAP_manuscript/macros/*.tex             headline numbers
        │
        │  tools/build_payload.py    tiers S, K          [exists]
        │  tools/build_entities.py   tier E              [new]
        │  tools/build_catalog.py    tier M              [new]
        │  tools/build_tables.py     tier T, Parquet     [new]
        v
  build/web/v1/**  +  build/api/v1/**
        │  tools/sync_gcs.py   (ledger-verified, prefix-guarded, idempotent)
        v
  gs://heap-web-data/    public · CORS · CDN
        ^
        └── browser AND R/Python clients read directly; no backend in the path
```

CI deploys **code only** — GitHub runners cannot see O2. Data is published from O2.

---

## 13. Gap register

What does not exist yet. **G2 and G4 are author decisions, not build decisions.**

| id | gap | blocks | severity |
|----|-----|--------|----------|
| **G1** | **The Tier-1 mediator set is settled and correct — the site must read it from the right file.** Authoritative: `HEAP/docs/manuscript_stats/module5/mr_triad_motifs.tsv` (supp sheet `S_mr_triads`) = **6 triads / 3 proteins** (ASGR1, ADM, FURIN), matching `\nMotifTierOne` / `\nMotifTierOneProt`; `mr_motif_counts.tsv` (`S_mr_motifs`) carries both bars side by side (tier1 6/3 · nominal 84/25). The three exemplars in `results_m5_mr.tex:38` are exactly three of these six. **Never read `motif_label` / `motif_*` from `MRmotifs.tsv`** — those are the nominal bar and the two sets are not nested. *Open question for the author, narrow:* `fig_mr_triad_spotlight.R:71` still auto-selects on `motif_label == "A"` (nominal), so its default 4 triads include UMOD and FGF23, which are not in the Tier-1 six — whereas `fig_mr_motif_overview.R` was updated to recompute at Tier 1. The plotter accepts a `HEAP_MR_SPOTLIGHT` override, so the published panel may already name the intended triads | which triads `/evidence` and `/explore/triad/*` feature | **LOW — resolved; one plotter default to confirm** |
| **G2** | *(RESOLVED 2026-08-18 — was wrongly called the largest blocker)* A crosswalk already exists in the data. **`MRmotifs.tsv` carries a `Disease_UKB` column**: all 77 FinnGen ids map to a UKB first-occurrence id, **0 unmapped, 0 ambiguous** (77→66 is many-to-one, e.g. `E4_OBESITY`/`OBESITYCAL`/`OBESITYNAS` → obesity). And **all 181 `DZ_ID`s parse to (ICD10, label) by pattern** `age_<icd>_first_reported_<name>_f<field>_0_0`, 181/181 — no labels need authoring. Residual: the 14 human labels in `fig_pes_vs_selfreport` still need matching, which is string matching against derived labels, not an authored equivalence | — | **resolved** |
| **G3** | `\nExposuresPES` = **164** but only **160** exposure directories exist in `pes_weights/` (the 162 previously reported counted `manifest.tsv` and `README` as exposures; the bundle's own `manifest.tsv` lists 160) | `/pes` count, homepage stat bar | **MEDIUM — a published number** |
| **G4** | *(RESOLVED 2026-08-18)* Protein classification is a **motif profile across (protein, disease) pairs**, read from `S_mr_triads`. A single per-protein label was tested and rejected: applied protein-wide over Tier-1 edges it puts ADM and FURIN in an undefined cell and ASGR1 in *disease-liability reporter*, i.e. it contradicts the paper for all three of its mediators, while classifying only SOST as causal. The motif rule is per-triad by construction and must stay that way | — | **resolved** |
| G5 | PES weights are stored per exposure; the site needs the **inverse** (which panels contain protein P) | protein page § PES membership | low — invert 162 manifests at build |
| G6 | Headline numbers live in LaTeX macros; nothing exports them as JSON | `meta/headline.json`, stat bar | low — parse `macros/*.tex` |
| G7 | Protein IDs are consistent in *value* (`A1BG`) but the **column name varies** (`protID`/`protein`/`Protein`); tier E finds **2,690** keys vs `\nProteins` 2,686 — 4 need explaining | tier E join | low |
| G8 | Exposure vocabulary **is clean** — 169 canonical, all exports 100% subsets | — | none — verified |
| G9 | No Parquet in the pipeline | `/table/*.parquet` | low — add `arrow` |
| G10 | Figs 3–6 not yet promoted from `exploratory/` to `main/` | `/figures/3..6` | low — tracked in CLAIMS_LEDGER |
| G11 | Six legacy pages still query Flask + Cloud SQL on retired `Type6` naming | transition period | medium |
| G12 | *(CLOSED)* Dataset DOIs are **out of scope** — readers cite the paper. Datasets carry a version string and build date only | — | closed |

### Graphical abstract — required changes

| # | Problem | Fix |
|---|---|---|
| GA1 | **"270 incident diseases" is stale**; live macro is `\nDiseasesGEM` = **181** | drive every number from macros |
| GA2 | Uses **code** module numbering (4 = enrichment, 5 = MR, 6 = PES); manuscript numbers Fig 4 = MR, 5 = intervention, 6 = PES | renumber to manuscript, or drop numbers and use names |
| GA3 | Predates the reframe — a methods tour with no reporter/intermediate spine | rebuild around the claim |
| GA4 | Static raster on a responsive page | ship the existing **SVG**, make regions clickable |

Keep: the Architecture / Association / Translation grouping, the colour system, the
exposure → proteome → disease schematic.

---

## 14. Phasing

First release is the seven items that carry ~80% of the scientific value:

| phase | delivers | blocked by |
|---|---|---|
| **P0** *(done, on branch)* | payload pipeline, four module pages, GCS publishing, CI split | — |
| **P1** | new landing page + framing · global search · **protein pages** · **exposure pages** | G6, G5, G7, G4 |
| **P2** | **MR / causal-evidence browser** · evidence ladder everywhere | G1 for featured triads only |
| **P3** | **PES browser + model cards + weights** | G3 |
| **P4** | **Data catalog** + schemas + API docs + Parquet | G9, G12 |
| **P5** | figure pages · exposome dictionary · docs set | G10 |
| **P6** | intervention explorer · pathway/tissue exploration | — |
| **P7** | disease pages · triad pages · Evidence Explorer | — *(unblocked: G1 and G2 both resolved)* |
| **P8** | retire legacy pages and the Cloud SQL dependency | P1–P4 shipped |

---

## 15. Versioning and cutover

Three version axes that move **independently**, which is what makes iteration safe.

| axis | where it lives | bumps when | who deploys |
|---|---|---|---|
| **Site code** | git branch → `main` | every change | GitHub Actions → Firebase |
| **Payload API** | path prefix `web/v1/`, `api/v1/` | only a **breaking schema change** | O2 → GCS |
| **Dataset** | `version` + build date per row in the catalog | the analysis is rerun | O2 → GCS |

Content changes never bump the API version. `/v1/` bumps only if a field is removed or its
meaning changes — i.e. when an old site would misread a new payload.

### Going live is one merge

`deploy-firebase.yml` is restricted to `branches: [main]`, so:

```
today       push the feature branch      -> nothing deploys, heap.bio untouched
preview     firebase hosting:channel:deploy v2 --expires 30d
                                          -> temporary URL, live site untouched
go live     merge the branch into main   -> workflow fires, Firebase deploys
roll back   firebase hosting:rollback    -> previous release, instantly
```

There is no separate promotion step and no infrastructure to change: the branch **is** the
staging environment, and merging is the cutover.

### The one real hazard: site and payload deploy through different channels

Site code ships GitHub → Firebase; payload ships O2 → GCS. They can get out of step, and it
is visible — a page whose section is not published yet renders an error card (observed
2026-08-18 when a `--only causal` build left the ledger inconsistent and the sync correctly
refused).

**Operational rule for any cutover:**

1. Publish the new payload **additively** — `sync_gcs.py` *without* `--prune`. Old and new
   sections coexist; the running site keeps working because its sections are untouched.
2. Merge the site to `main` and let it deploy.
3. Verify the live site.
4. Only then re-run with `--prune` to drop the sections nothing references any more.

Doing it in the other order takes the live site down for as long as the deploy takes.

### Dataset citation

No DOIs (D10). Each dataset carries a version string and build date so a reader can state
which build they used; the citation is always the paper.

## 16. Editorial rules

Carried from the supplement, because they apply here too.

1. **The main figure is ground truth.** Where the site and a printed figure describe the same
   analysis, the printed figure wins and is shown as printed.
2. **Citation-equivalent inclusion gate.** A result appears only if it is in the manuscript or
   its supplement. The site does not publish unreviewed analyses.
3. **Prose belongs to the author.** Page copy making a scientific claim is written or approved
   by the author, not generated.
4. **No hand-typed numbers.** Every rendered number traces to a macro, registry, or payload
   file. Untraceable ⇒ does not ship.
5. **"Not tested" ≠ "not significant".** Every empty state distinguishes them.
6. **Association is never styled as causation.** No generic green "significant" badge; the
   evidence ladder is mandatory on every relationship.
7. **A rebuild that changes a published number is an author decision**, not a silent overwrite.
