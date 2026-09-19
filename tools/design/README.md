# design/ — exploratory scripts, not part of the build

Scratch analyses kept because they were expensive to work out and live nowhere
else. Run on O2 with `module load gcc/14.2.0 R/4.4.2`.

## `fig6c_web_safe.R`

Aggregate-safe renderings of **main Figure 6c**, for the website.

**Why it exists.** Figure 6c is individual-level: the alcohol panel is ~2,200
green dots, one per baseline→follow-up pair, and the smoking panel draws one
line per person. A static figure in a paper is not a data release; an
interactive web version of the same plot is, since hovering returns exact
per-person coordinates. So the site needs the same claims from aggregates.

**It follows the manuscript recipe exactly** (`fig_m6_panel_c.R`) and reproduces
its numbers:

    alcohol   r = 0.40 [0.36, 0.43]
    smoking   r = 0.69 [0.66, 0.71]   Quit n=86, Started n=15

Three details that are easy to get wrong, and were:

1. **Follow-up is `instance %in% c(2,3)`** — the IMAGING visits, ~10 and ~12
   years out. Not the repeat assessment at instance 1 (~4 years). Using
   instance 1 gives r = 0.39 over a different window and different people.
2. **The score column is `pes_prot_z`**, not `pred_prot`.
3. **n counts visit-pairs, not people.** Anyone with both imaging visits
   contributes twice: Quit's n=86 is 58 individuals, and alcohol's 2,200 pairs
   are 1,208 people. The published intervals do not account for that clustering.
   The web version therefore prints both counts.

**What was tried and rejected.** A hexbin of the alcohol cloud, publishing cell
counts with cells under 10 suppressed. Only 18 cells survived out of 1,208
people, leaving a blocky middle with the fitted line extending far past any
drawn cell — a plot asserting evidence it was not showing. Binned means with a
ribbon carry the same dose-response honestly.

**Not published.** Nothing here has been added to the payload; putting these on
the site needs a section in `web_sections.tsv`, a repack, and a pass through
`audit_payload.py`.
