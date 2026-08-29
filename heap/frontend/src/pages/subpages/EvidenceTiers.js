import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Chip, Paper, Typography } from '@mui/material';
import {
  AuthorNote, DocPage, HeadlineFallback, Mono, P, Section, SimpleTable, SourceNote,
  macro, useHeadline,
} from '../Documentation';
import ColumnarTable from '../../components/ColumnarTable';
import { useSection } from '../../lib/useSection';

// The badge vocabulary, transcribed from the manuscript:
//   HEAP_manuscript/sections/results_m5_mr.tex:12   (the ladder itself)
//   HEAP_manuscript/sections/extended_data.tex:56   (Tier 1+, currently commented out)
// Nothing here interprets a result; each rung states what the badge asserts and
// what evidence it required.
const RUNGS = [
  {
    tier: 'Observational',
    kind: 'association',
    adds: 'An estimate exists',
    detail: 'The exposure–protein (or protein–disease) model was fitted and returned a coefficient. Says nothing about replication or direction.',
  },
  {
    tier: 'Replicated',
    kind: 'association',
    adds: 'Holds in both splits',
    detail: 'The association reaches significance in the training split and again in the held-out test split, with the same sign.',
  },
  {
    tier: 'MR Suggestive',
    kind: 'causal',
    adds: 'MR run, not resolved',
    detail: 'An FDR-significant MR estimate that is weakly instrumented, fails a sensitivity check, or has an unresolved causal direction. Flagged only.',
  },
  {
    tier: 'MR Tier 2',
    kind: 'causal',
    adds: 'FDR-significant',
    detail: 'The two-sample MR estimate survives multiple-testing correction across the tested edges. This is where trans-instrumented evidence lives, and where most of it stays.',
  },
  {
    tier: 'MR Tier 1',
    kind: 'causal',
    adds: '+ sensitivity robustness + established direction',
    detail: 'Adds heterogeneity (Cochran Q), directional-pleiotropy (MR-Egger, MR-PRESSO) and causal-direction checks. The direction rule is symmetric: Steiger must be significant AND forward — reading the sign alone was biased by instrument strength and was replaced.',
  },
  {
    tier: 'MR Tier 1+',
    kind: 'causal',
    adds: '+ cis-anchored, colocalized, cross-platform',
    detail: 'Cis-anchored, colocalized, and replicated across both the UK Biobank Olink and the deCODE SomaScan pQTL panels. The strictest rung in the MR ladder.',
  },
  {
    tier: 'Colocalized',
    kind: 'causal',
    adds: 'PP.H4 ≥ 0.8',
    detail: 'The pQTL and the outcome signal at the locus are consistent with one shared causal variant rather than two variants in linkage disequilibrium, evaluated for cis instruments only.',
  },
  {
    tier: 'Intervention concordant',
    kind: 'external',
    adds: 'External perturbation agrees',
    detail: 'The direction of the proteomic response in HERITAGE, STEP 1 or STEP 2 agrees with the observational exposure association. Restricted to proteins measured on both platforms.',
  },
];

const KIND_COLOR = { association: '#0072B2', causal: '#124533', external: '#D55E00' };

function Rail() {
  const nodes = ['Association', 'Replication', 'MR', 'Colocalization', 'External perturbation'];
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1, maxWidth: 820 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        {nodes.map((label, i) => (
          <React.Fragment key={label}>
            <Box sx={{ textAlign: 'center', minWidth: 92 }}>
              <Box
                sx={{
                  width: 16, height: 16, borderRadius: '50%', mx: 'auto', mb: 0.5,
                  border: '2px solid #124533',
                  backgroundColor: i < 4 ? '#124533' : 'transparent',
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
            </Box>
            {i < nodes.length - 1 && (
              <Box sx={{ flex: '0 0 24px', height: 2, backgroundColor: '#124533', opacity: i < 3 ? 1 : 0.25 }} />
            )}
          </React.Fragment>
        ))}
      </Box>
    </Paper>
  );
}

function MotifCounts() {
  const { data, loading, error } = useSection('mr_motif_counts');
  if (loading) return <Typography variant="body2" color="text.secondary">Loading motif counts…</Typography>;
  if (error || !data) {
    return (
      <Alert severity="info" sx={{ maxWidth: 820 }}>
        The published motif-count table could not be read from the payload
        {error ? ` (${String(error.message || error)})` : ''}. The two bars it carries are the
        Tier-1 bar and the nominal-significance bar; they are described below.
      </Alert>
    );
  }
  return <ColumnarTable data={data} initialRowsPerPage={10} />;
}

export default function EvidenceTiers() {
  const { data: h, error } = useHeadline();
  const n = (k) => macro(h, k);

  return (
    <DocPage
      title="Evidence tiers"
      lead="Every relationship on this site carries an explicit evidence level. There is no generic green “significant” badge, and association is never styled as causation. This page defines each badge and states, plainly, what it does and does not require."
    >
      <HeadlineFallback error={error} />

      <Section
        title="The ladder"
        subtitle="Rungs are cumulative within their arm: an MR Tier 1 edge has already met every Tier 2 requirement."
      >
        <SimpleTable
          head={['Badge', 'Arm', 'What it adds', 'What it required']}
          rows={RUNGS.map((r) => [
            <Chip
              size="small" label={r.tier}
              sx={{ fontWeight: 600, backgroundColor: KIND_COLOR[r.kind], color: '#fff' }}
            />,
            r.kind,
            r.adds,
            r.detail,
          ])}
        />
        <SourceNote>
          <Mono>HEAP_manuscript/sections/results_m5_mr.tex</Mono> (Fig. 4a caption, the ladder) and{' '}
          <Mono>sections/extended_data.tex</Mono> (tier construction). Colocalization gate and
          locus count from <Mono>S_coloc_summary</Mono>.
        </SourceNote>
      </Section>

      <Section
        title="How a relationship reads"
        subtitle="Filled nodes are the evidence that exists for that relationship; open nodes are evidence that was not obtained. An open node never means “refuted”."
      >
        <Rail />
        <SourceNote>rendering specified in <Mono>docs/WEBSITE_PLAN.md</Mono> §5.</SourceNote>
      </Section>

      <Section title="The ladder is also a cis → cis+trans axis">
        <P>
          This is the least obvious property of the ladder, and it changes how the top rungs
          should be read. <b>Tier 1 and Tier 1+ are cis-only in practice.</b> No trans-instrumented
          edge reaches either rung.
        </P>
        <SimpleTable
          head={['Rung', 'Cis-instrumented edges', 'Trans-instrumented edges']}
          rows={[
            ['MR Tier 1', '14', '0'],
            ['MR Tier 1+', '4', '0'],
            ['MR Tier 2', '55', '135'],
          ]}
        />
        <P>
          Trans evidence enters at Tier 2, where it outnumbers cis evidence more than two to one,
          and then disappears entirely above it. The reason is structural rather than statistical:
          the Tier-1 and Tier-1+ definitions require cis anchoring and colocalization, which a
          trans instrument cannot satisfy. So a protein with only trans support is not a weaker
          version of a Tier-1 protein — it was never eligible for that rung.
        </P>
        <SourceNote>
          counted from the MR edge table during the site build and recorded in{' '}
          <Mono>docs/WEBSITE_PLAN.md</Mono> §5. The per-rung cis/trans split is not yet emitted as
          a column by <Mono>summarize_mr_triads.R</Mono>.
        </SourceNote>
      </Section>

      <Section title="Motif counts are recomputed at each rung, not filtered">
        <P>
          The five MR motifs are ✓/✗/○ signatures over the six directed edges of a triad, and the
          signatures contain negations — motif A requires exposure → protein and protein → disease
          to be supported <i>and</i> other edges to be absent. Absence is evaluated against the
          rung being drawn, so moving up the ladder can create a motif match that did not exist
          below it.
        </P>
        <P>
          <b>Counts are therefore not monotonic across rungs.</b> Motif A (mediator) is 6 triads at
          Tier 1 and 69 at Tier 2, while motifs B and C shrink over the same step. A bar chart of
          motifs at one rung is not a filtered subset of the bar chart at a looser rung, and the
          two cannot be differenced.
        </P>
        <P>
          Because of this, the two published bars must never be mixed. The Tier-1 bar (
          {n('nMotifTierOne')} triads across {n('nMotifTierOneProt')} proteins) is the headline;
          the nominal-significance bar ({n('nMotifTriads')} triads) is a diagnostic and is not
          nested inside it.
        </P>
        <Box sx={{ mb: 2 }}>
          <MotifCounts />
        </Box>
        <SourceNote>
          live from <Mono>s/mr_motif_counts.json.gz</Mono> (supplementary sheet{' '}
          <Mono>S_mr_motifs</Mono>, generated from{' '}
          <Mono>HEAP/docs/manuscript_stats/module5/mr_motif_counts.tsv</Mono>). The Tier-2 bar is
          not one of the published columns; the 6 → 69 figure was measured during the site build
          and is logged as <Mono>docs/TASKS.md</Mono> item B4.
        </SourceNote>
      </Section>

      <Section title="Colocalization">
        <P>
          Colocalization is a gate, not a score: an edge is colocalized when the posterior
          probability of a single shared causal variant is at least 0.8 (PP.H4 ≥ 0.8).{' '}
          {n('nColoc')} cis-pQTL loci clear it. Cis edges that fail the gate because the pQTL and the outcome
          signal sit on distinct variants in linkage disequilibrium are demoted rather than
          dropped, and they are labeled LD-confounded wherever they appear.
        </P>
        <SourceNote>
          <Mono>S_coloc_summary</Mono>; the same tier gate is applied in{' '}
          <Link to="/results/causal">Causal evidence</Link>.
        </SourceNote>
      </Section>

      <Section title="Observational mediation sits outside the ladder">
        <Alert severity="info" sx={{ maxWidth: 820, mb: 1 }}>
          Observational mediation estimates are descriptive and may reflect confounding, reverse
          causation, or shared upstream causes. Causal support is evaluated separately using MR
          and colocalization.
        </Alert>
        <P>
          That sentence is shown verbatim next to every mediated-fraction figure on the site. A
          mediated fraction is not a rung and never upgrades one: a relationship can have a large
          observational mediated fraction and no MR support at all.
        </P>
        <SourceNote>
          verbatim caveat text from <Mono>docs/WEBSITE_PLAN.md</Mono> §5 (standing decision S11).
        </SourceNote>
      </Section>

      <AuthorNote what="Two different definitions of Tier 1 exist in the manuscript source.">
        The Fig. 4a caption in <Mono>results_m5_mr.tex</Mono> defines Tier 1 as adding sensitivity
        robustness and an established causal direction — that is the definition used above, and
        it matches the implemented symmetric Steiger rule. The Extended Data flowchart caption in{' '}
        <Mono>extended_data.tex</Mono> instead says Tier 1 is “cis + colocalized or replicated”.
        That caption is currently commented out in the LaTeX, so nothing is published under the
        second wording, but the two should be reconciled before the ED figure is restored.
      </AuthorNote>

      <Section title="What no badge on this site means">
        <SimpleTable
          head={['Not shown', 'Why']}
          rows={[
            ['A generic "significant" badge', 'It collapses replication, MR support and colocalization into one green dot, which is the exact conflation this resource exists to prevent.'],
            ['A single causal label per protein', <span>Classification is a motif profile per (protein, disease) pair, because the motif rule is per-triad by construction. Applied protein-wide it contradicts the manuscript for its own mediators.</span>],
            ['An empty cell', <span>A relationship that was never tested and one that was tested without reaching significance are shown differently, everywhere.</span>],
          ]}
        />
        <SourceNote><Mono>docs/TASKS.md</Mono> standing decisions S3, S4 and S7.</SourceNote>
      </Section>
    </DocPage>
  );
}
