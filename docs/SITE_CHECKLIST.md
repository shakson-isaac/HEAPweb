## Site iteration checklist — opened 2026-08-26

Per route: what the browser measured, what the audit flagged, and an empty
line for your own observations. Tick as they land. Numbers come from
`tools/page_audit.py` and `tools/nav_audit.py` against the live preview —
re-run both after any batch and update the table rather than trusting these.

Thresholds used for the flags: >350 words, >45-word block, >12 blocks,
>120 words per plot. They rank; they do not decide.

## Site-wide

Things that are not any one page's problem.

### Findability

- [ ] **14 of 24 routes are orphaned** — reachable by clicking from nowhere.
      The entire documentation section (quickstart, methods, dictionary, faqs,
      cite, credits, evidence-tiers, specifications, api, changelog, about)
      plus `/results/architecture`, `/results/interactions`, `/results/gwas`.
      One nav change fixes all 14.
- [ ] The persistent header carries exactly **one** link (Downloads). The front
      door's other 8 links are body cards, which vanish once you leave home.
- [ ] `/downloads` is a **dead end** — nothing to click onward.
- [ ] Nothing is linkable. `useUrlState` now exists and Mediation uses it;
      19 other pickers still hold state where it cannot be shared or cited.

### The 21 "earlier panels"

Three pages fold old panels behind a "Show the earlier panels" disclosure:
`/results/main` (9), `/results/summary` (5), `/results/mediation` (7).

**Checked, and the answer was the opposite of what I expected: all 21 are the
only view of their payload section.** The in-code note saying "several exports
have no other view" was accurate and understated. Deleting them outright drops
22 sections from the site.

Not verified: whether the same numbers are downloadable under a different name
in the `supp/` tree. Downloads is manifest-driven from a separate namespace, so
"not on the Downloads page" is not the same as "not available".

- [ ] Decide: delete (lose 22 sections), keep folded (status quo), or move to a
      dedicated figure appendix so the main pages are clean and nothing is lost.

### Copy

- [ ] 59 British spellings in rendered text across 23 files; worst are
      `EnrichTripartite` (9) and `ExposureBodyMap` (8). House standard is
      American. A naive grep says 117 — it counts comments and MUI's `grey` API.

### Plots

- [ ] Six scatters have no linked lookup table, against the standing
      preference: `ColocRegional` and all five `redesign/` components. The five
      are live on MainResults and Mediation; the preference postdates them.

### Done

- [x] Plotly built from core — 1,292 → 482 KB gz (63%), verified live at 381 KB
      over brotli, all six traces confirmed present in the built chunk.
- [x] Charting chunk prefetched on homepage idle.
- [x] `TableComponent.js` (134 lines) and `mockupData.js` (51 lines) deleted.
- [x] Zero real console errors site-wide (the one on every page is Google
      Analytics blocked in headless).

---

## Per route

### `/results/intervention`

1075 words · 30 blocks · longest 104w · 56 controls · 1 plots

- [ ] 1075 words (>350)
- [ ] longest block 104w (>45)
- [ ] 30 prose blocks (>12)
- [ ] 1075 words per plot (>120)
- [ ] _your notes:_

### `/results/causal`

989 words · 34 blocks · longest 154w · 55 controls · 5 plots

- [ ] 989 words (>350)
- [ ] longest block 154w (>45)
- [ ] 34 prose blocks (>12)
- [ ] 197 words per plot (>120)
- [ ] _your notes:_

### `/results/pes`

1683 words · 37 blocks · longest 106w · 225 controls · 10 plots

- [ ] 1683 words (>350)
- [ ] longest block 106w (>45)
- [ ] 37 prose blocks (>12)
- [ ] 168 words per plot (>120)
- [ ] **225 controls**
- [ ] _your notes:_

### `/results/enrichment`

1272 words · 46 blocks · longest 134w · 55 controls · 8 plots

- [ ] 1272 words (>350)
- [ ] longest block 134w (>45)
- [ ] 46 prose blocks (>12)
- [ ] 159 words per plot (>120)
- [ ] _your notes:_

### `/results/summary`

298 words · 10 blocks · longest 91w · 13 controls · 2 plots

- [ ] longest block 91w (>45)
- [ ] 149 words per plot (>120)
- [ ] 5 panels folded under 'the earlier panels'
- [ ] _your notes:_

### `/results/mediation`

471 words · 17 blocks · longest 77w · 33 controls · 4 plots

- [ ] 471 words (>350)
- [ ] longest block 77w (>45)
- [ ] 17 prose blocks (>12)
- [ ] 7 panels folded under 'the earlier panels'
- [ ] _your notes:_

### `/results/main`

384 words · 12 blocks · longest 63w · 21 controls · 4 plots

- [ ] 384 words (>350)
- [ ] longest block 63w (>45)
- [ ] 9 panels folded under 'the earlier panels'
- [ ] _your notes:_

### `/results/associations`

82 words · 3 blocks · longest 37w · 29 controls · 1 plots

- _(clears every threshold)_
- [ ] _your notes:_

### `/results/architecture`

379 words · 14 blocks · longest 76w · 31 controls · 7 plots

- [ ] 379 words (>350)
- [ ] longest block 76w (>45)
- [ ] 14 prose blocks (>12)
- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/results/interactions`

379 words · 14 blocks · longest 76w · 31 controls · 7 plots

- [ ] 379 words (>350)
- [ ] longest block 76w (>45)
- [ ] 14 prose blocks (>12)
- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/results/gwas`

119 words · 6 blocks · longest 40w · 33 controls · 3 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/`

277 words · 13 blocks · longest 32w · 0 controls · 0 plots

- _(clears every threshold)_
- [ ] _your notes:_

### `/downloads`

183 words · 7 blocks · longest 54w · 187 controls · 0 plots

- [ ] **187 controls**
- [ ] _your notes:_

### `/documentation/about`

404 words · 17 blocks · longest 49w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/quickstart`

122 words · 7 blocks · longest 27w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/evidence-tiers`

705 words · 23 blocks · longest 79w · 10 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/specifications`

853 words · 39 blocks · longest 84w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/dictionary`

191 words · 7 blocks · longest 56w · 14 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/api`

348 words · 14 blocks · longest 73w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/methods`

824 words · 24 blocks · longest 73w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/changelog`

368 words · 12 blocks · longest 63w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/cite`

302 words · 12 blocks · longest 60w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/credits`

145 words · 7 blocks · longest 48w · 0 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

### `/documentation/faqs`

286 words · 18 blocks · longest 48w · 15 controls · 0 plots

- [ ] **ORPHAN — unreachable by clicking**
- [ ] _your notes:_

