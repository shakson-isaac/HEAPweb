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
import { getShard } from '../../lib/heapdata';
import { prettyTissue } from '../../lib/tissueBodyMap';

// One worked example throughout, so the variants are comparable.
const GENE = 'ITGA11';
const OPENED = 'artery_aorta';

const BLUE = '#0072B2';
const ACCENT = '#D55E00';

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

    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panels 2 and 3 — the prose problem, shown rather than described
 * ------------------------------------------------------------------ */
const EXPOSURE = 'types_of_physical_activity_in_last_4_weeks_f6164_0_0.multi_Strenuous_sports';
const EXPOSURE_TERM = 'multi_Strenuous_sports';
const SHOW = 12;   // preview cap: one shard fetch per protein

// Panels 2 and 3 are the SAME 30 proteins.
//
// The leading-edge table lists them with two derived counts, because -- as the
// live component says itself -- every leading-edge row of a term repeats that
// term's NES and q, so there is no per-protein statistic to rank by. The effect
// panel directly below has exactly that missing statistic, for a subset of the
// same list.
//
// So the page currently spends two panels, two explanations and 238 words
// showing one list twice, and the half with the ranking number is the half that
// does not name the specificity. This merges them.
function MergedPanel() {
  const { data: le } = useShard('bodymap_leading_edge', EXPOSURE);
  const [rows, setRows] = useState(null);

  const genes = useMemo(() => {
    if (!le?.gene) return null;
    const out = [];
    for (let i = 0; i < le.gene.length; i += 1) {
      if (le.term[i] === OPENED && le.spec[i] === 'base') out.push(le.gene[i]);
    }
    return out;
  }, [le]);

  React.useEffect(() => {
    let alive = true;
    if (!genes) return undefined;
    (async () => {
      const got = await Promise.all(genes.slice(0, SHOW).map(async (g) => {
        try {
          const d = await getShard('assoc_base', g);
          const k = d.Term.findIndex((t) => t === EXPOSURE_TERM);
          if (k < 0) return { gene: g, missing: true };
          return {
            gene: g,
            beta: Number(d.beta_test[k]),
            se: Number(d.SE_test[k]),
            repl: String(d.replicated[k]).toUpperCase() === 'TRUE',
          };
        } catch { return { gene: g, missing: true }; }
      }));
      if (alive) setRows(got.sort((a, b) => Math.abs(b.beta || 0) - Math.abs(a.beta || 0)));
    })();
    return () => { alive = false; };
  }, [genes]);

  if (!rows) return <Typography variant="body2">Loading…</Typography>;
  const ok = rows.filter((r) => !r.missing);

  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Held-out β with a 95% interval. Filled = replicated in both splits.
      </Typography>
      <PlotPanel
        data={[{
          type: 'scatter', mode: 'markers', orientation: 'h',
          x: ok.map((r) => r.beta).reverse(),
          y: ok.map((r) => r.gene).reverse(),
          error_x: {
            type: 'data', array: ok.map((r) => 1.96 * r.se).reverse(),
            color: '#888', thickness: 1.2, width: 0,
          },
          marker: {
            size: 11,
            color: ok.map((r) => (r.repl ? ACCENT : '#fff')).reverse(),
            line: { color: ACCENT, width: 2 },
          },
          hovertemplate: '%{y}<br>β %{x:+.3f}<extra></extra>',
        }]}
        layout={{
          height: 60 + ok.length * 28,
          margin: { l: 92, r: 34, t: 8, b: 46 },
          xaxis: { title: 'held-out β per SD of exposure', zeroline: true, zerolinecolor: '#bbb' },
          yaxis: { automargin: true },
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {`Showing ${ok.length} of ${genes.length} leading-edge proteins (preview cap). `}
        {rows.length - ok.length > 0
          ? `${rows.length - ok.length} have no association row — missing, not zero.`
          : ''}
      </Typography>
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
        n="2 + 3"
        title="The leading edge and the effect sizes — one list, shown twice"
        problem={`These are the SAME 30 proteins. The table ranks them by two derived counts because the
          leading edge has no per-protein statistic — every row repeats the term's NES and q. The panel below
          it has the missing statistic, for a subset. Together they spend two panels, two explanations and
          238 words on one list.`}
      >
        <Variant
          tag="A"
          name="Merge them: one ranked list, sorted by effect size"
          rationale="The proteins that carried the enrichment, ranked by how strongly this exposure actually
            moves them, with the interval and replication on the same row. One panel, one explanation, and a
            sort that means something. The 145-word methods note moves to a fold beneath it."
        >
          <MergedPanel />
        </Variant>
      </Section>
    </Box>
  );
}
