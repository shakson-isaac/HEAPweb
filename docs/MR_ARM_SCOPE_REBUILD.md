# Task: rebuild the heap.bio MR payloads after the pQTL arm-scope change

The analysis repo changed how Mendelian-randomization results are scoped across the
two pQTL platforms. The site is still serving the old numbers. Rebuild the affected
payloads on O2, verify them, and report before deploying.

Upstream commits: HEAP `82fae32`, `9c25c15`. Manuscript `1100db6`, `cc92162`.

## The rule that changed

An MR edge that touches the protein is measured on one pQTL platform, so it is
evaluated WITHIN that platform:

- **Tier 1**  = supported on EITHER platform (UKB Olink or deCODE SomaScan)
- **Tier 1+** = supported on BOTH

Exposure→disease and disease→exposure edges carry no protein and are common to the two.

A MOTIF is assembled within a platform: its four protein-involving edges must come from
the same panel. It is Tier 1 if either platform supports it.

**Do not pool the two arms' edge sets and evaluate motifs on the union.** That is a
different, weaker rule: it lets a deCODE reverse edge veto a UKB triad, and it drops
FURIN from the mediator set (6 triads/3 proteins becomes 4/2). If you see 4 mediator
triads anywhere, that is the bug.

## Numbers that must appear after the rebuild

| quantity | old (UKB-only) | new |
|---|---|---|
| mediator motif | 6 triads / 3 proteins | **6 / 3** (unchanged) |
| biomarker | 1,353 | **1,368** (326 proteins) |
| exposure-marker | 4,499 | **4,591** (460) |
| reverse | 30 | **30** (4) |
| disease-liability | 12,892 / 469 | **14,273 / 490** |
| causal intermediates (Tier-1 cis P→D + colocalized) | 6 | **8** — gains ICAM1, SOST |

Mediator proteins are ADM, ASGR1, FURIN — unchanged, all UKB-supported. ICAM1 and SOST
are causal intermediates but NOT mediators: each has its exposure leg in UKB and its
disease leg in deCODE, so no single platform closes the chain.

## Regenerated source tables (already rebuilt on O2, no action needed)

    HEAP/docs/manuscript_stats/module5/mr_motif_counts.tsv   now has ukb_triads,
        decode_triads, tier1_triads, tier1_proteins, tier1plus_triads,
        tier1plus_proteins, nominal_triads, nominal_proteins
    HEAP/docs/manuscript_stats/module5/mr_triad_motifs.tsv   20,064 rows (was 18,780),
        NEW COLUMN `arms` in {UKB, DECODE, UKB+DECODE}
    $HEAP_OUTPUT/mr_edges/summary/supp/mr_triads_wide.tsv    20,064 x 72
    $HEAP_OUTPUT/support/intervention_compare/mr_pd_tiered.tsv  regenerated; content
        identical to the previous file, it was stale in date only

## Tools to re-run (each reads at least one changed table)

    build_triad_tiers.py            mr_tiered_edges, mr_triad_motifs
    build_decode_triads.py          MRmotifs, mr_triad_motifs
    build_motif_browse.py           mr_triads_wide
    build_pd_effects.py             mr_triads_wide
    build_intervention_network.py   mr_pd_tiered, mr_triads_wide
    build_intervention_concordance.py  mr_pd_tiered, mr_triads_wide
    build_payload.py                MRmotifs
    check_public.py                 mr_motif_counts

Pipeline per docs/DATA_PIPELINE.md: run the packers on O2 (their input lives there),
producing build/web/v1/**, then tools/sync_gcs.py pushes to gs://heap-data/web/v1/**.

## Traps

1. **The deCODE triad table is a separate file, not a `dataset` partition.** UKB is
   `summary/MRmotifs.tsv`; deCODE is `summary/DECODE/MRmotifs.tsv`. Reading the
   top-level file and filtering `dataset == "DECODE"` returns ZERO rows silently. This
   bug was live in the analysis summariser and is exactly why deCODE looked like it
   contributed nothing. Check `build_decode_triads.py` for the same pattern.
2. **`mr_triad_motifs.tsv` gained a column and 1,284 rows.** Anything doing positional
   column access or asserting a row count will break.
3. **Stacking motif counts on a log axis is invalid** — segments do not sum to the bar.
   If any site chart stacks these, dodge them instead.
4. Any page text saying "six proteins" for the causal core, or quoting 12,892 /
   469 for disease-liability, needs updating to eight / 14,273 / 490.

## Deliverable

Rebuild, verify the table above against the generated payloads, and report the diff.
**Do not sync to GCS or deploy without explicit approval** — that publishes to the
live public site.
