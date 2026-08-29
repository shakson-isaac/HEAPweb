# deprecated — panels removed from the site, kept for reference

Archived 2026-08-26.

## What is here

The 21 panels that used to sit behind the **"Show the earlier panels"**
disclosure on `/results/main` (9), `/results/summary` (5) and
`/results/mediation` (7). They were removed from the site to cut clutter; the
code is kept because the designs may be worth revisiting.

| file | panels | from |
|---|---|---|
| `MainResults.earlier-panels.js` | 9 | `src/pages/subpages/MainResults.js` |
| `HeapSummary.earlier-panels.js` | 5 | `src/pages/subpages/HeapSummary.js` |
| `Mediation.earlier-panels.js` | 7 | `src/pages/subpages/Mediation.js` |

## This directory is NOT compiled

It sits outside `src/`, so CRA never builds it and nothing here can break the
site. The functions are verbatim as they last shipped, but their imports are
not — each file reproduces its page's original import block as a comment at the
end, which is what you need to revive one.

## What was lost by removing them

Each of the 21 was the **only view of its payload section**. The sections are
listed at the top of each archive file. They are still built and published;
nothing on the site draws them any more.

Two are worth calling out specifically:

- **`ProteinLinks`** (Mediation) was the per-protein mediation view, and the
  first component wired to `useUrlState` — so `?protein=CRP` deep links were
  live for exactly one session before this archive. Reviving it is the shortest
  path to a per-protein view, and §5 of `docs/SITE_DESIGN.md` argues that a
  protein page is where this should end up instead.
- **`CategoryReach`** here is the OLD inline panel, not
  `components/redesign/CategoryReach.js`, which is still live on
  `/results/summary` as `CategoryReachPanel`. Two different components, same
  name — check which one you mean before reviving.

## Reviving one

1. Copy the function back into its page.
2. Restore whatever it referenced from the commented import block.
3. `CI=true npm run build` — unused imports are errors, not warnings.

## `Disclosure.js` — came back the same day

Moved here 2026-08-26 when the last of its three callers went, and restored to
`src/components/` within the hour. Minimalist pages need somewhere to put
method and caveats, and this is that somewhere. It was never a bad component;
it was briefly an unused one.

## The original causal page — archived 2026-08-27

`Causal.oldpage.js` is `/results/causal` as it last shipped: a 175-word
preamble, then five panels stacked with no stated order — reading key, entity
browser, triad explorer, protein–disease effects, colocalization. Its own
comment described them as "three depths of one question", which was right and
was never said to the reader.

`/results/causal` now renders the guided version (`src/pages/subpages/
CausalGuide.js`): the reading key on arrival, then four viewpoints, each one
panel. `/results/causal-guide` still resolves to the same page, so links handed
out while the two ran side by side keep working.

`EntityMotifBrowser.js` is archived beside it. It asked "pick one exposure,
protein or disease — how do its triads split?", which is what filling one slot
of the triad builder does. Its only caller was the old page.

**The panels are NOT here.** `TriadExplorer`, `Coloc`, `PDEffects`, `MotifKey`,
`ArmNotice`, `TriadDAG`, `ColocRegional`, `PlatformConcordance` and
`MotifTrace` all remain in `src/` and are rendered by the current page.
`Causal.js` survives as the module exporting the first two.

Reviving the old page means restoring its default export to `Causal.js`, adding
back the `EntityMotifBrowser` import, and pointing a route at it.

---

# Enrichment.oldpage.js — the stacked Tissues & Pathways page

Archived 2026-08-29, when `/results/enrichment` was handed to the guided
version (`src/pages/subpages/EnrichmentGuide.js`). `/results/enrichment-guide`
stays wired as an alias so older links resolve.

## What replaced it

The old page stacked eleven panels: three interactive views, then eight raw
heatmap grids under "Every enrichment, as heatmaps". The guide is a landing
page plus three views (`tissue`, `programs`, `proteins`), 3,031 rendered words
down to 750 + 625 + 637.

## Eight payload sections are now drawn by NOTHING

The guide runs on a purpose-built set (`enrich_exposure_program`,
`enrich_program_tissue`, `enrich_exposure_tissue`, `bodymap_terms`,
`pes_reads_ci`). It does not read any of the sections this page read. They are
still built and published; no page draws them.

| section | what it showed | covered by the guide? |
|---|---|---|
| `tissue_enrichment` | exposures vs GTEx tissue signatures | yes — body map + tissue view |
| `pathway_enrichment` | exposures vs Reactome pathways | yes — programs view |
| `tissue_themes` | tissues grouped into organ systems | yes — body map groups anatomically |
| `pathway_themes` | pathways grouped into themes | yes — programs view |
| `exposure_tissue` | tissue signal per exposure category | yes — `enrich_exposure_tissue` |
| `inflammation_convergence` | where distinct categories converge on shared inflammatory pathways | **no counterpart found** |
| `component_pathways` | which biology sits behind the exposomic variance component | **no counterpart found** |
| `geno_expo_pathways` | genetic versus exposomic pathways | **no counterpart found** |

The last three are a real content loss, not a reorganization. The bottom two
tie enrichment back to the Module 1 variance decomposition, which nothing else
on the site does. Reviving them is a decision, not a cleanup — see the entry in
`docs/WEB_PUNCHLIST.md`.
