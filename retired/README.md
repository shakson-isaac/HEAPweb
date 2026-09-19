# Retired

Code that no longer runs, kept as the record of how something used to be built.

Deliberately OUTSIDE `heap/frontend/src/` so it is neither linted nor bundled,
and cannot drift back into the build by someone adding an import. Same rule the
decommissioned Python prototypes follow in `tools/prototypes/`: a thing that has
been superseded is archived rather than deleted, but it must stop being live.

| file | was | replaced by |
|---|---|---|
| `intervention_page/Intervention_superseded.js` | the five original Interventions panels | `components/intervention/InterventionConcordance.js` and `InterventionNetwork.js` |

Each file carries a header saying what it was, why it was retired, and what
replaced it. If you are reading one to revive it, read that header first — in
every case so far the retired version reads thinner data than its replacement.
