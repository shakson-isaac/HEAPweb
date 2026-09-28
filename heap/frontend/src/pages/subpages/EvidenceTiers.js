import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Chip, Paper, Typography } from '@mui/material';
import {
  AuthorNote, DocPage, HeadlineFallback, Mono, P, Section, SimpleTable,
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
    detail: 'The exposure–protein or protein–disease model was fitted and returned a coefficient.',
  },
  {
    tier: 'Replicated',
    kind: 'association',
    adds: 'Holds in both splits',
    detail: 'The association is significant in the training split and again in the held-out split, with the same sign.',
  },
  {
    tier: 'MR Suggestive',
    kind: 'causal',
    adds: 'MR run, unresolved',
    detail: 'An FDR-significant MR estimate with a weak instrument, a failed sensitivity check, or an unresolved causal direction. Flagged for review.',
  },
  {
    tier: 'MR Tier 2',
    kind: 'causal',
    adds: 'FDR-significant',
    detail: 'The two-sample MR estimate survives multiple-testing correction across the tested edges. Trans-instrumented evidence enters here.',
  },
  {
    tier: 'MR Tier 1',
    kind: 'causal',
    adds: '+ sensitivity robustness + established direction',
    detail: 'Adds heterogeneity (Cochran Q), directional pleiotropy (MR-Egger, MR-PRESSO) and causal-direction checks. Steiger must be significant and forward.',
  },
  {
    tier: 'MR Tier 1+',
    kind: 'causal',
    adds: '+ cis-anchored, colocalized, cross-platform',
    detail: 'Cis-anchored, colocalized, and replicated across the UK Biobank Olink and deCODE SomaScan pQTL panels. The strictest rung.',
  },
  {
    tier: 'Colocalized',
    kind: 'causal',
    adds: 'PP.H4 ≥ 0.8',
    detail: 'The pQTL and the outcome signal at the locus are consistent with one shared causal variant. Evaluated for cis instruments only.',
  },
  {
    tier: 'Intervention concordant',
    kind: 'external',
    adds: 'External perturbation agrees',
    detail: 'The proteomic response in HERITAGE, STEP 1 or STEP 2 agrees in direction with the observational association. Restricted to proteins measured on both platforms.',
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
        The motif-count table could not be read from the payload
        {error ? ` (${String(error.message || error)})` : ''}. It carries the Tier-1 bar and the
        nominal-significance bar, described below.
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
      lead="Every relationship on this site carries an evidence badge. This page defines each badge and the evidence it requires."
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
      </Section>

      <Section
        title="How a relationship reads"
        subtitle="Filled nodes are the evidence obtained for that relationship. An open node records evidence that was not obtained."
      >
        <Rail />
      </Section>

      <Section title="Cis and trans instruments">
        <P>
          Tier 1 and Tier 1+ are cis-only in practice. Both rungs require cis anchoring and
          colocalization, which a trans instrument cannot satisfy. A protein with trans support
          alone is ineligible for them.
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
          Trans evidence enters at Tier 2, where it outnumbers cis evidence more than two to one.
        </P>
      </Section>

      <Section title="Motif counts by rung">
        <P>
          The five MR motifs are signatures over the six directed edges of a triad, and each
          signature requires some edges to be absent. Absence is evaluated at the rung being drawn,
          so a motif can match at one rung and not at another.
        </P>
        <P>
          Counts are therefore not monotonic across rungs. Motif A (mediator) covers 6 triads at
          Tier 1 and 69 at Tier 2, while motifs B and C shrink over the same step. Counts from two
          rungs cannot be differenced.
        </P>
        <P>
          The Tier-1 bar ({n('nMotifTierOne')} triads across {n('nMotifTierOneProt')} proteins) is
          the published headline. The nominal-significance bar ({n('nMotifTriads')} triads) is a
          diagnostic, and the two sets are separate.
        </P>
        <Box sx={{ mb: 2 }}>
          <MotifCounts />
        </Box>
      </Section>

      <Section title="Colocalization">
        <P>
          Colocalization is a gate at PP.H4 ≥ 0.8, the posterior probability that the pQTL and the
          outcome share one causal variant. {n('nColoc')} cis-pQTL loci clear it. A cis edge whose
          pQTL and outcome signals sit on distinct variants in linkage disequilibrium is demoted
          and labeled LD-confounded wherever it appears. The same gate is applied in{' '}
          <Link to="/results/causal">Causal evidence</Link>.
        </P>
      </Section>

      <Section title="Observational mediation">
        <Alert severity="info" sx={{ maxWidth: 820, mb: 1 }}>
          Observational mediation estimates are descriptive and may reflect confounding, reverse
          causation, or shared upstream causes. Causal support is evaluated separately using MR
          and colocalization.
        </Alert>
        <P>
          A mediated fraction sits outside the ladder and does not raise a badge. A relationship
          can carry a large mediated fraction with no MR support.
        </P>
      </Section>

      <AuthorNote what="Two different definitions of Tier 1 exist in the manuscript source.">
        The Fig. 4a caption in <Mono>results_m5_mr.tex</Mono> defines Tier 1 as adding sensitivity
        robustness and an established causal direction — that is the definition used above, and
        it matches the implemented symmetric Steiger rule. The Extended Data flowchart caption in{' '}
        <Mono>extended_data.tex</Mono> instead says Tier 1 is “cis + colocalized or replicated”.
        That caption is currently commented out in the LaTeX, so nothing is published under the
        second wording, but the two should be reconciled before the ED figure is restored.
      </AuthorNote>

      <Section title="Badges the site does not use">
        <SimpleTable
          head={['Not used', 'What the site shows instead']}
          rows={[
            ['A generic "significant" badge', 'Replication, MR support and colocalization are badged separately.'],
            ['A single causal label per protein', 'A motif profile per protein–disease pair, because the motif rule is defined per triad.'],
            ['An empty cell', 'Untested relationships and tested relationships below significance are drawn differently.'],
          ]}
        />
      </Section>
    </DocPage>
  );
}
