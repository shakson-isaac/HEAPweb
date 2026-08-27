// A scratch surface for redesigning the three panels of the per-organ drill-in.
//
// UNLINKED and iterative. Each section shows the shape currently shipping next
// to alternatives, on real data for one worked example, so the choice can be
// argued with rather than imagined. Nothing here is wired into the live page
// until a variant is chosen.
//
// The three panels, and what is wrong with each as it stands:
//
//   1. GTEx median TPM      54 tissues stacked vertically. For ITGA11, 47 of
//                           them sit below 10% of the maximum, so five sixths
//                           of the chart is an indistinguishable tail -- and
//                           artery aorta, the tissue the reader just clicked,
//                           is rank 1 of 54 and says so nowhere. `tau` (0.75)
//                           and `frac_of_max` are already in the payload and
//                           are never shown.
//   2. Effect sizes         a 145-word methods paragraph sits between the
//                           reader and the forest plot.
//   3. The leading edge     a 93-word definition above a table whose two
//                           numeric columns are mostly 1 and 0.
import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, Divider, Paper, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import PlotPanel from '../../components/PlotPanel';
import { useShard } from '../../lib/useSection';
import { prettyTissue } from '../../lib/tissueBodyMap';

// One worked example throughout, so the variants are comparable.
const GENE = 'ITGA11';
const OPENED = 'artery_aorta';

const BLUE = '#0072B2';
const ACCENT = '#D55E00';
const GREY = '#9AA3AB';

function Section({ n, title, problem, children }) {
  return (
    <Box sx={{ mt: 5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        {`Panel ${n}`}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Alert severity="warning" sx={{ my: 1.5, maxWidth: 940 }}>{problem}</Alert>
      {children}
    </Box>
  );
}

function Variant({ tag, name, rationale, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', mb: 0.5 }}>
        <Chip size="small" label={tag} sx={{ fontWeight: 700 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{name}</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 900 }}>
        {rationale}
      </Typography>
      {children}
    </Paper>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 1 — GTEx median TPM
 * ------------------------------------------------------------------ */
function GtexDesigns() {
  const { data, loading } = useShard('protein_tissue_profile', GENE);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    if (!data?.tissue) return null;
    const out = data.tissue.map((t, i) => ({
      tissue: t,
      label: prettyTissue(t),
      tpm: Number(data.median_tpm[i]) || 0,
      n: Number(data.n_samples[i]) || 0,
      frac: Number(data.frac_of_max[i]) || 0,
      here: t === OPENED,
    }));
    out.sort((a, b) => b.tpm - a.tpm);
    return out;
  }, [data]);

  if (loading || !rows) return <Typography variant="body2">Loading…</Typography>;

  const here = rows.find((r) => r.here);
  const rank = rows.findIndex((r) => r.here) + 1;
  const tail = rows.filter((r) => r.frac < 0.1).length;
  const top = rows.slice(0, 10);
  const shown = showAll ? rows : top;

  return (
    <>
      <Variant
        tag="A"
        name="Headline the rank, chart only the top"
        rationale={`The finding is that ${GENE} is most expressed in the very tissue you opened. Say that in
          words, chart the ten that carry signal, and collapse the tail into one honest line rather than
          drawing 47 indistinguishable rows.`}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {`${prettyTissue(OPENED)} is where ${GENE} is most expressed — rank ${rank} of ${rows.length}`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Chip size="small" label={`${here.tpm.toFixed(1)} median TPM`} />
          <Chip size="small" label={`${here.n} donors`} />
          <Chip size="small" variant="outlined" label={`${tail} of ${rows.length} tissues below 10% of the max`} />
        </Box>
        <PlotPanel
          data={[{
            type: 'bar', orientation: 'h',
            x: shown.map((r) => r.tpm).reverse(),
            y: shown.map((r) => r.label).reverse(),
            marker: { color: shown.map((r) => (r.here ? ACCENT : BLUE)).reverse() },
            hovertemplate: '%{y}<br>%{x:.2f} TPM<extra></extra>',
          }]}
          layout={{
            height: 40 + shown.length * 26,
            margin: { l: 210, r: 30, t: 10, b: 44 },
            xaxis: { title: 'GTEx median TPM' },
            yaxis: { automargin: true },
          }}
        />
        <ToggleButtonGroup size="small" exclusive value={showAll}
                           onChange={(_, v) => v !== null && setShowAll(v)} sx={{ mt: 1 }}>
          <ToggleButton value={false} sx={{ textTransform: 'none' }}>Top 10</ToggleButton>
          <ToggleButton value={true} sx={{ textTransform: 'none' }}>{`All ${rows.length}`}</ToggleButton>
        </ToggleButtonGroup>
      </Variant>

      <Variant
        tag="B"
        name="One strip, every tissue, the opened one marked"
        rationale="All 54 kept, but as a distribution on a single axis instead of 54 stacked rows. It costs
          one line instead of a page, and it shows the shape the ranked list hides: a long flat tail with a
          few tissues far out to the right."
      >
        <PlotPanel
          data={[
            {
              type: 'scatter', mode: 'markers',
              x: rows.filter((r) => !r.here).map((r) => r.tpm),
              y: rows.filter((r) => !r.here).map(() => 0),
              marker: { size: 11, color: GREY, opacity: 0.75 },
              text: rows.filter((r) => !r.here).map((r) => r.label),
              hovertemplate: '%{text}<br>%{x:.2f} TPM<extra></extra>',
              name: 'other tissues',
            },
            {
              type: 'scatter', mode: 'markers+text',
              x: [here.tpm], y: [0],
              marker: { size: 18, color: ACCENT, line: { color: '#fff', width: 2 } },
              text: [prettyTissue(OPENED)], textposition: 'top center',
              textfont: { size: 13 },
              hovertemplate: `${prettyTissue(OPENED)}<br>%{x:.2f} TPM<extra></extra>`,
              name: 'the tissue you opened',
            },
          ]}
          layout={{
            height: 190, showlegend: false,
            margin: { l: 30, r: 40, t: 40, b: 52 },
            xaxis: { type: 'log', title: 'GTEx median TPM (log scale)' },
            yaxis: { visible: false, range: [-1, 1.6] },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {`Tissue specificity τ = ${Number(data.tau[0]).toFixed(2)} — already in the payload, never shown today.
            1 means the protein is confined to one tissue, 0 means it is everywhere.`}
        </Typography>
      </Variant>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panels 2 and 3 — the prose problem, shown rather than described
 * ------------------------------------------------------------------ */
const EFFECT_PROSE = `Held-out β with a 95% Wald interval (β ± 1.96 × SE), from the test split — the same
estimate the rest of the site plots, never the discovery-split β. Ranking by |β| needs the βs, and the
association sections are sharded by protein, so the ten are found in two passes rather than by fetching the
whole leading edge: the leading edge is stored in GSEA ranked-list order, so the first 24 of it are fetched
and then re-ranked by the β actually returned. That proxy has a median |ρ| of about 0.85 against |β|, not 1,
so a protein just outside the shortlist can outrank one inside it. Adjusting for BMI or the clinical
covariates attenuates many adiposity-linked effects; attenuation under adjustment cannot on its own separate
mediation from confounding, so read the specification buttons as a sensitivity check rather than a mechanism.`;

function ProseDesigns() {
  return (
    <>
      <Variant
        tag="A"
        name="One line above the plot, the rest behind a fold"
        rationale="Everything in that paragraph is true and most of it answers a question nobody has yet. The
          reader needs to know what the dot and the whisker are; the two-pass shortlist, the ρ≈0.85 proxy and
          the BMI caveat are answers to questions raised by the plot, so they belong under it."
      >
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Held-out β with a 95% interval. Filled = replicated in both splits.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            13 words instead of 145. The rest moves to “How these were chosen”, one click down.
          </Typography>
        </Paper>
      </Variant>

      <Variant
        tag="—"
        name="What is there now, for comparison"
        rationale="145 words between the reader and the forest plot."
      >
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fff8f5' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{EFFECT_PROSE}</Typography>
        </Paper>
      </Variant>
    </>
  );
}

export default function DrillDesign() {
  return (
    <Box sx={{ mt: 3, maxWidth: 1080 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Drill-in panels — design iteration
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {`Worked example: ${GENE} opened from ${prettyTissue(OPENED)}. Real data, real sections — only the
          presentation is in question.`}
      </Typography>
      <Alert severity="info" sx={{ mt: 2 }}>
        Unlinked scratch page. Nothing here is on the live drill-in until a variant is chosen.
      </Alert>

      <Section
        n={1}
        title="GTEx median TPM across 54 tissues"
        problem={`47 of 54 tissues sit below 10% of the maximum, so most of the chart is an indistinguishable
          tail — and artery aorta, the tissue just clicked, is rank 1 of 54 and the chart never says so. τ and
          frac_of_max are already in the payload and unused.`}
      >
        <GtexDesigns />
      </Section>

      <Divider sx={{ mt: 4 }} />

      <Section
        n={2}
        title="Effect sizes for the top proteins"
        problem="A 145-word methods paragraph sits between the reader and the forest plot."
      >
        <ProseDesigns />
      </Section>

      <Divider sx={{ mt: 4 }} />

      <Section
        n={3}
        title="The leading-edge table"
        problem="A 93-word definition above a table whose two numeric columns are mostly 1 and 0. Next round —
          say which direction to take panels 1 and 2 first and this follows the same treatment."
      >
        <Typography variant="body2" color="text.secondary">
          Not drafted yet, deliberately. The table's fix depends on what is decided above.
        </Typography>
      </Section>
    </Box>
  );
}
