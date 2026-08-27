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

## `Disclosure.js`

The fold itself, moved here 2026-08-26 once the last of its three callers went.
It is a generic "rest of the page, folded" widget with a count in the label —
worth reviving verbatim if anything needs progressive disclosure again, rather
than writing a new one.
