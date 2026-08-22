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
