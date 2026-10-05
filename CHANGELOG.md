# Changelog

What changed between the first release of heap.bio and the current one.

This file is not served by the site. It was a documentation page until
2026-10-04, when it was moved here: a reader arriving from the paper has not
seen v1, so the v1→v2 history is cross-reference material for us rather than
documentation for them. Anything on this page that a visitor still needs lives
on a results or documentation page instead, and is noted below.

## v2 — the current release

Rebuilt for the revised manuscript. v1 described four analysis modules, the
Type1–Type7 covariate naming, and G×E as a top-level result. All three are
superseded.

### The one change that affects old downloads

**Type3 is not `base`.** The covariate sets were renamed from Type1–Type7 to
descriptive names — `base` (primary), `base_bmi`, `base_draw`, `base_clinical`,
`base_ses`, `base_prevalent` — and most of that is a pure rename. Type3 is not:
`base` drops BMI and fasting time, so a Type3 result and a `base` result come
from different models and are not comparable. v1 also keyed its association
pages on `Type6`, now `base_ses`, which is a supplementary set rather than a
default.

Type1 (age + sex), Type2 (no-PC metabolic) and Type7 (medications as exposures)
are no longer produced. Type4 and Type5 both fold into `base_clinical`.

Current definitions: `/documentation/models`, from
`HEAP/config/covariates/covariate_sets.yml`.

### Structural changes

| Change | Detail |
|---|---|
| Six analysis modules | v1 presented four: variance decomposition, G×E associations, mediation, interventional validation. v2 has six numbered modules — variance decomposition, exposure–protein association, mediation, Mendelian randomization, interventional comparison, proteome-based exposure scores — plus two un-numbered supporting analyses (tissue/pathway enrichment, exposure GWAS). Module numbers follow the manuscript. |
| Exposure GWAS published | 169 exposure GWAS released as summary statistics: one bgzipped file per exposure with a tabix index, 7.78M variants each, 51 GB in total, in a requester-pays bucket. v1 published no GWAS. |
| Bidirectional MR added | Six directed edges per exposure–protein–disease triad (E→P, P→E, P→D, D→P, E→D, D→E), each graded on a stringency ladder. Nothing equivalent in v1. |
| Colocalization added | Cis-pQTL colocalization with a hard gate at PP.H4 ≥ 0.8. A cis edge fails when the two signals sit on distinct variants in LD; those edges are kept and labeled LD-confounded. |
| Exposure scores (PES) added | A proteomic score per exposure, evaluated on exposure prediction, within-person tracking and incremental disease prediction. Weights deposited per exposure. The PES panel is a different protein panel from the variance-decomposition panel. |
| G×E demoted to supplementary | No longer a top-level pillar. Reachable below the divider on `/results/architecture`; the old `/results/interactions` path still resolves. |
| Mediation reframed as descriptive | No longer a top-navigation destination; labeled descriptive wherever a mediated fraction appears. Causal adjudication moved to its own page, driven by MR and colocalization. |
| Evidence ladder applied site-wide | Every relationship carries an explicit evidence level. The generic "significant" badge used in v1 is gone. |
| Counts restated | v1 described 135 lifestyle exposures and 270 disease codes. v2 analyzes 169 exposomic features and 181 incident disease outcomes, the disease set restricted to outcomes with ≥100 incident cases. |
| Protein identifiers standardized | Protein keys are hyphenated HGNC symbols (`HLA-A`). Four proteins carry R-safe underscored names upstream; the packer republishes them under the HGNC symbol and records the alias. |
| Results served as static files | Pages read gzipped columnar JSON from a public bucket instead of round-tripping to a database. The frontend and the public API are the same files. |
| No dataset DOIs | Datasets carry a version string and build date only; the citation is the paper. |

## v1 — the original release

Built for the original manuscript. Four analysis modules, Type1–Type7 covariate
naming, G×E as a top-level result, mediation in the top navigation, and results
served from a relational database behind a Flask API.

## How the versions move

Still true, and documented for readers on `/documentation/api` and
`/documentation/cite`:

| Axis | Bumps when | Where you see it |
|---|---|---|
| Site code | every change | the deployed frontend |
| Payload API | a breaking schema change: a field removed, or its meaning changed | the `web/v1/` path prefix |
| Dataset | the analysis is rerun | the `version` and build date on each row of `catalog.json.gz` |

Content changes keep the API version. Adding a section, or republishing one with
new values, leaves `v1` alone. The prefix moves only when a change would make an
older client misread a newer payload.
