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

- [x] ~~14 of 24 routes are orphaned~~ **WRONG — corrected 2026-08-26.** The
      header has working `Documentation ▼` and `Results ▼` menus. Clicked
      through and confirmed: `/documentation/cite`, `/documentation/methods`
      and `/results/gwas` all land correctly, two clicks from the front door.
      Nothing is stranded.

      The error: those menus are MUI `MenuItem`s with
      `onClick={() => navigate(...)}`, so no `<a href>` is ever rendered.
      `nav_audit.py` crawled anchors only, saw nothing, and called 14 pages
      unreachable. The tool now opens each trigger and clicks its items to
      record the real destination.

- [x] **The nav items are not links.** FIXED 2026-08-27 — This is the finding that survives, and
      it is real but much smaller. Because they are click handlers on bare
      `<div>`s, those nav items:
      - cannot be cmd/middle-clicked into a new tab, or right-click-copied
      - are not announced as links by screen readers — they carry no `role`,
        no `aria-haspopup`, and are not keyboard focusable
      - are invisible to search-engine crawlers
      Fix: render them as `<Link to=…>` inside the `MenuItem`, which keeps the
      menu and restores the anchor.

- [x] **Nav items are real links now.** Every `MenuItem` renders
      `component={Link}`; triggers have `role=button`, `tabIndex`,
      `aria-haspopup` and Enter/Space; the logo is a `Link`. Re-crawl confirms
      **22 links from the front door** and **zero real orphans** — the two the
      tool still lists are legacy aliases that resolve (`/results/interactions`
      → architecture, `/documentation/specifications` → models).

- [x] **No 404 handling anywhere.** FIXED 2026-08-29 — Measured 2026-08-26:
      `/documentation/<garbage>` renders the documentation shell (201 words)
      and looks like a real page; `/results/<garbage>` and `/totally/made/up`
      render a blank shell of 7-8 words. A mistyped or stale link fails
      silently. This matters more now that URLs are meant to be shared: someone
      pasting a link with a typo sees an empty page, not an explanation.

- [x] `/downloads` is a dead end — FIXED 2026-08-29, — nothing to click onward.
- [ ] Nothing is linkable. `useUrlState` exists but its only caller was
      archived with the folded panels; every picker now holds state that
      cannot be shared or cited.

### The 21 "earlier panels" — RESOLVED, removed 2026-08-26

Deleted from the site; the code is archived at `heap/frontend/deprecated/`
(outside `src/`, never compiled) with a README on how to revive one.

- [x] `/results/main` — 9 panels removed
- [x] `/results/summary` — 5 panels removed
- [x] `/results/mediation` — 7 panels removed
- [x] `Disclosure.js` is now unused by anything

**Measured result: only 7% less rendered prose** (1,153 -> 1,070 words across
the three pages). The panels were already behind a fold, and a visitor never
saw them unless they clicked "Show" -- so what actually disappeared was the
button label and its note. This was a CODE win (1,972 lines of page code -> 115)
and not a UI-clutter win. Do not cite it as one.

The clutter is on the pages nothing has been done to, where none of it is
folded: `/results/pes` (1,683 words), `/results/enrichment` (1,272),
`/results/intervention` (1,075 around a single plot) and `/results/causal`
(989) hold 5,019 words between them.

**What this cost, stated plainly.** Each of the 21 was the only view of its
payload section, so 22 sections are still built and published but nothing on
the site draws them.

- [ ] Decide whether those 22 sections keep being built, or are dropped from
      the payload too. Building and publishing data no page renders is waste,
      but they may belong on the Downloads page instead.
- [ ] **`ProteinLinks` went with them** — the per-protein mediation view, and
      the only component wired to `useUrlState`. `/results/mediation` now has
      no per-protein view, and `?protein=` deep links no longer resolve.
      `SITE_DESIGN.md` §5 argues this should come back as `/protein/<symbol>`
      rather than as a panel.

### Copy

- [x] 59 British spellings — FIXED 2026-08-29, 39 substitutions, zero remain.
      Original count of in rendered text across 23 files; worst are
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

## Caveat on `words per plot`

`page_audit.py` counts `.js-plotly-plot`, so a hand-drawn SVG panel does not
register as a visual. `/results/intervention` was reported as "1,075 words
around a SINGLE plot"; it has two major visuals — a Plotly scatter and an SVG
network — so the real figure was ~540 words each. The ranking was unaffected
(still worst by 2.7x) but the phrasing overstated it.

Pages with custom SVG components — intervention, enrichment's body map, the
triad DAG — are penalised by this metric. Use raw word count to rank them, and
check the `svgs` column before quoting a ratio.

## Prose method — what the intervention page taught

`/results/intervention` went **1,075 -> 773 rendered words (-28%)** with nothing
substantive dropped. The cuts were not stylistic; the same two faults produced
almost all of the volume, and both recur on the other pages.

**Fault 1 — the same point stated three times.** The estimand caveat (a
between-person UK Biobank slope is not a within-person trial change) appeared
in the page preamble, again in the scatter's subtitle, and again in a caption.
Say it once, in the place a reader cannot miss.

**Fault 2 — method in front of the plot instead of behind it.** How r is
weighted, which proteins the trial assayed, why markers are sized as they are:
all of it sat above the figure. It belongs in a `Disclosure` at the foot.

**What must NOT be compressed.** "This picker shows attenuation, not mediation"
stays at full length and in place. It is the correction withdrawn from the
manuscript in five places and it stops a reader drawing a causal conclusion the
data cannot support. Rendered NUMBERS are never touched.

Website copy may now be edited directly (user instruction, 2026-08-26);
manuscript prose and figure captions still are not.

Remaining, same shape, unfixed: `/results/pes` (1,683 words, 225 controls),
`/results/enrichment` (1,272), `/results/causal` (989, one 154-word block).

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

