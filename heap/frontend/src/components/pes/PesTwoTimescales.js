import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, Typography,
} from '@mui/material';
import PlotPanel from '../PlotPanel';
import { useSection } from '../../lib/useSection';
import { ecatColor, prettyExposure } from '../../lib/palette';

// Does the score still track over a SHORT interval, with no baseline anchor?
//
// Two held-out intervals, both published, taken straight from
// fig_pes_imaging_tracking.R:
//
//   dcor_base   baseline -> each imaging visit, median ~10 years. The
//               baseline-anchored delta-correlation used in main Fig 3c.
//   dcor_23     imaging -> repeat imaging (instance 2 -> 3), median ~2 years,
//               where BOTH timepoints are held-out follow-ups. A stronger test:
//               nothing in it was seen during training, at either end.
//
// The claim the figure makes is about the DIAGONAL: exposures that track over
// ten years also track over two. So the diagonal is drawn, and a point's
// distance from it is the reading -- above means the short interval tracks
// better than the long one, below the reverse.
//
// The exemplars are the ones the printed figure labels, smoking and alcohol
// first, because they are the two the manuscript leans on.
const EXEMPLARS = [
  ['current_tobacco_smoking_f1239_0_0_Yes._on_most_or_all_days', 'Current smoking'],
  ['alcohol_intake_frequency_f1558_0_0', 'Alcohol frequency'],
  ['number_of_days_week_of_vigorous_physical_activity_10_plus_minutes_f904_0_0', 'Vigorous activity'],
  ['usual_walking_pace_f924_0_0', 'Walking pace'],
  ['processed_meat_intake_f1349_0_0', 'Processed meat'],
];

export default function PesTwoTimescales() {
  const { data, loading, error } = useSection('pes_imaging_tracking');
  const [picked, setPicked] = useState(null);

  const rows = useMemo(() => {
    if (!data?.exposure_id) return null;
    return data.exposure_id.map((id, i) => ({
      id,
      label: data.exposure_label[i] || prettyExposure(id),
      category: data.category[i],
      long: Number(data.dcor_base[i]),
      short: Number(data.dcor_23[i]),
      nPairs: Number(data.n_pairs_23[i]) || 0,
      nChange: Number(data.n_change_23[i]) || 0,
    })).filter((r) => Number.isFinite(r.long) && Number.isFinite(r.short));
  }, [data]);

  if (loading) return <Typography variant="body2">Loading…</Typography>;
  if (error) return <Typography variant="body2" color="error">{String(error)}</Typography>;
  if (!rows?.length) return null;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const exemplars = EXEMPLARS.map(([id, lab]) => (byId.has(id) ? { ...byId.get(id), lab } : null))
    .filter(Boolean);
  const sel = picked ? byId.get(picked.id) : null;
  const bothPositive = rows.filter((r) => r.long > 0 && r.short > 0).length;
  const all = rows.flatMap((r) => [r.long, r.short]);
  const diagLo = Math.min(...all) - 0.02;
  const diagHi = Math.max(...all) + 0.02;

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        The same score, over ten years and over two
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 880 }}>
        Each point is one exposure. The dashed line is equal tracking at both intervals — above it the
        score tracks better over two years than over ten.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip size="small" label={`${rows.length} exposures`} />
        <Chip size="small" variant="outlined"
              label={`${bothPositive} track in both windows`} />
        <Autocomplete
          size="small"
          sx={{ minWidth: 300, flex: '1 1 320px' }}
          options={rows}
          value={sel || null}
          onChange={(_, v) => setPicked(v)}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(p) => <TextField {...p} label="Highlight an exposure" />}
        />
      </Box>

      <PlotPanel
        data={[
          {
            type: 'scatter', mode: 'markers', name: 'all exposures',
            x: rows.map((r) => r.long), y: rows.map((r) => r.short),
            marker: {
              size: 8, opacity: 0.65,
              color: rows.map((r) => ecatColor(String(r.category).replace(/ /g, '_'))),
            },
            text: rows.map((r) => r.label),
            hovertemplate: '%{text}<br>10-year Δr %{x:.3f}<br>2-year Δr %{y:.3f}<extra></extra>',
          },
          {
            type: 'scatter', mode: 'markers+text', name: 'exemplars',
            x: exemplars.map((r) => r.long), y: exemplars.map((r) => r.short),
            marker: { size: 13, color: '#fff', line: { color: '#23282D', width: 2 } },
            text: exemplars.map((r) => r.lab), textposition: 'top center',
            textfont: { size: 11 },
            hovertemplate: '%{text}<br>10-year Δr %{x:.3f}<br>2-year Δr %{y:.3f}<extra></extra>',
          },
          ...(sel ? [{
            type: 'scatter', mode: 'markers', name: 'selected',
            x: [sel.long], y: [sel.short],
            marker: { size: 20, color: 'rgba(0,0,0,0)', line: { color: '#D55E00', width: 3 } },
            hovertemplate: `${sel.label}<extra></extra>`,
          }] : []),
        ]}
        layout={{
          height: 470, showlegend: false,
          margin: { l: 68, r: 26, t: 12, b: 56 },
          xaxis: { title: 'Δ-correlation, baseline → imaging (~10 years)', zeroline: true, zerolinecolor: '#ccc' },
          yaxis: { title: 'Δ-correlation, imaging → repeat imaging (~2 years)', zeroline: true, zerolinecolor: '#ccc' },
          // Spans the data, not a guessed range. Hardcoding x1 = 0.35 left the
          // reference line stopping less than halfway to Current smoking at
          // (0.77, 0.63) -- the diagonal IS the claim, so it has to reach the
          // point the claim is most about.
          shapes: [{
            type: 'line', xref: 'x', yref: 'y',
            x0: diagLo, y0: diagLo, x1: diagHi, y1: diagHi,
            line: { color: '#999', width: 1, dash: 'dash' },
          }],
        }}
      />

      {sel && (
        <Alert severity="info" sx={{ mt: 1 }}>
          <b>{sel.label}</b>
          {` — Δr ${sel.long.toFixed(3)} over ~10 years, ${sel.short.toFixed(3)} over ~2 years,
             from ${sel.nPairs.toLocaleString()} people with both imaging visits
             (${sel.nChange.toLocaleString()} of them changed).`}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        The two-year window is the stronger test: both of its timepoints are held-out follow-ups, so
        nothing in it was seen during training at either end.
      </Typography>
    </Box>
  );
}
