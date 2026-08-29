import React, { useMemo } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import PlotPanel from '../PlotPanel';
import { useSection } from '../../lib/useSection';
import { useUrlState } from '../../lib/useUrlState';
import { ecatColor, prettyExposure } from '../../lib/palette';

// One exposure at a time: when THIS exposure changes, how does the score move?
//
// The other two tracking panels are one point per exposure -- a scatter of 132
// dots that says which exposures track, and never shows what tracking looks
// like. This is the Figure 6c view, generalized: pick an exposure, pick an
// span, and read the dose-response directly.
//
// THREE INTERVALS, and each one is a clean pairing of two visits:
//   10y  baseline -> imaging          (instance 0 -> 2)
//   2y   imaging  -> repeat imaging   (instance 2 -> 3), both held out
//   12y  baseline -> repeat imaging   (instance 0 -> 3)
//
// The manuscript panel pools instances 2 and 3 against baseline, so someone
// with both visits is counted twice and its n is visit-pairs. Here each
// span is one row per person, so n is people. That is why a number here
// can sit slightly below the printed one for the same exposure.
//
// BANDS. Aggregates only, and a band holding fewer than 10 people is dropped
// upstream by tools/build_pes_track_bands.R rather than drawn faint.
//   ordinal     integer moves, clipped to +/-3, for scales like alcohol
//               frequency where one category IS the unit people think in
//   sd          moves in SD of the baseline spread, so a band means the same
//               thing across exposures measured on different scales
//   transition  binary exposures have no dose, only a switch, so the four
//               states are shown as themselves
const INTERVALS = [
  ['10y', '~10 years', 'baseline → imaging'],
  ['2y', '~2 years', 'imaging → repeat imaging'],
  ['12y', '~12 years', 'baseline → repeat imaging'],
];

// The two the manuscript leans on, so the panel opens on a real result.
const DEFAULT_EXPOSURE = 'alcohol_intake_frequency_f1558_0_0';

const AXIS = {
  ordinal: 'Change in exposure (categories)',
  sd: 'Change in exposure (SD of baseline spread)',
  transition: 'Exposure at first visit → at second visit',
};

export default function PesWithinPerson() {
  const bands = useSection('pes_track_bands');
  const head = useSection('pes_track_headline');
  const [exposure, setExposure] = useUrlState('exposure', DEFAULT_EXPOSURE);
  const [span, setSpan] = useUrlState('interval', '10y');

  // Every exposure that has at least one drawable band, with its label.
  const options = useMemo(() => {
    const d = bands.data;
    if (!d?.exposure_id) return [];
    const seen = new Map();
    d.exposure_id.forEach((id, i) => {
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          label: d.exposure_label[i] || prettyExposure(id),
          category: String(d.category?.[i] || '').replace(/ /g, '_'),
        });
      }
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [bands.data]);

  // Which intervals this exposure actually has -- a rare exposure may only
  // clear the floor at one of the three, and offering a dead button is worse
  // than offering two live ones.
  const available = useMemo(() => {
    const d = bands.data;
    if (!d?.exposure_id) return new Set();
    const s = new Set();
    d.exposure_id.forEach((id, i) => { if (id === exposure) s.add(d.timescale[i]); });
    return s;
  }, [bands.data, exposure]);

  const shown = available.has(span) ? span
    : (INTERVALS.map((x) => x[0]).find((t) => available.has(t)) || span);

  const rows = useMemo(() => {
    const d = bands.data;
    if (!d?.exposure_id) return [];
    const out = [];
    d.exposure_id.forEach((id, i) => {
      if (id !== exposure || d.timescale[i] !== shown) return;
      out.push({
        band: d.band[i],
        order: Number(d.band_order[i]),
        mode: d.band_mode[i],
        n: Number(d.n[i]),
        mean: Number(d.mean_dscore[i]),
        lo: Number(d.lo[i]),
        hi: Number(d.hi[i]),
      });
    });
    return out.sort((a, b) => a.order - b.order);
  }, [bands.data, exposure, shown]);

  const stat = useMemo(() => {
    const d = head.data;
    if (!d?.exposure_id) return null;
    for (let i = 0; i < d.exposure_id.length; i += 1) {
      if (d.exposure_id[i] === exposure && d.timescale[i] === shown) {
        return {
          r: Number(d.r[i]),
          lo: Number(d.lo[i]),
          hi: Number(d.hi[i]),
          people: Number(d.n_people[i]),
          changed: Number(d.n_changed[i]),
        };
      }
    }
    return null;
  }, [head.data, exposure, shown]);

  if (bands.loading || head.loading) return <Typography variant="body2">Loading…</Typography>;
  if (bands.error) return <Typography variant="body2" color="error">{String(bands.error)}</Typography>;
  if (!options.length) return null;

  const sel = options.find((o) => o.id === exposure) || options[0];
  const mode = rows[0]?.mode || 'ordinal';
  const color = ecatColor(sel.category) || '#1B7837';
  const isTransition = mode === 'transition';
  // A transition always has four possible states; an ordinal band set runs
  // -3..+3. Anything absent was suppressed by the ten-person floor upstream,
  // which is a fact about the data and belongs on the page.
  const expected = isTransition ? 4 : (mode === 'sd' ? 5 : 7);
  const missing = Math.max(0, expected - rows.length);

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        When this exposure changes, does the score follow?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 880 }}>
        {isTransition
          ? 'Each point is a group of people who made the same switch, and its height is their mean '
            + 'change in score. A point below zero means the score fell as the exposure stopped.'
          : 'Each point is a group of people whose exposure moved by the same amount, and its height '
            + 'is their mean change in score. A rising line means the score followed the exposure.'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 320, flex: '1 1 340px' }}
          options={options}
          value={sel}
          onChange={(_, v) => v && setExposure(v.id)}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(p) => <TextField {...p} label="Exposure" />}
        />
        <ToggleButtonGroup
          size="small" exclusive value={shown}
          onChange={(_, v) => v && setSpan(v)}
        >
          {INTERVALS.map(([key, label, sub]) => (
            <ToggleButton key={key} value={key} disabled={!available.has(key)} title={sub}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {stat && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Chip size="small" label={`r = ${stat.r.toFixed(2)} [${stat.lo.toFixed(2)}, ${stat.hi.toFixed(2)}]`} />
          <Chip size="small" variant="outlined" label={`${stat.people.toLocaleString()} people`} />
          <Chip size="small" variant="outlined" label={`${stat.changed.toLocaleString()} changed`} />
        </Box>
      )}

      <PlotPanel
        data={[
          ...(isTransition ? [] : [{
            type: 'scatter', mode: 'lines', hoverinfo: 'skip', showlegend: false,
            x: rows.map((r) => r.order), y: rows.map((r) => r.mean),
            line: { color, width: 2 },
          }, {
            // The span as a band, drawn as one closed path.
            type: 'scatter', mode: 'lines', hoverinfo: 'skip', showlegend: false,
            x: [...rows.map((r) => r.order), ...rows.map((r) => r.order).reverse()],
            y: [...rows.map((r) => r.hi), ...rows.map((r) => r.lo).reverse()],
            fill: 'toself', fillcolor: color, opacity: 0.18,
            line: { width: 0 },
          }]),
          {
            type: 'scatter', mode: 'markers', showlegend: false,
            x: rows.map((r) => r.order), y: rows.map((r) => r.mean),
            error_y: isTransition ? {
              type: 'data', symmetric: false,
              array: rows.map((r) => r.hi - r.mean),
              arrayminus: rows.map((r) => r.mean - r.lo),
              color, thickness: 1.5, width: 5,
            } : undefined,
            marker: { size: 9, color },
            text: rows.map((r) => `${r.band}<br>${r.n.toLocaleString()} people`),
            hovertemplate: '%{text}<br>mean Δ score %{y:.2f}<extra></extra>',
          },
        ]}
        layout={{
          height: 420, showlegend: false,
          margin: { l: 70, r: 26, t: 12, b: 64 },
          xaxis: {
            title: AXIS[mode],
            tickmode: 'array',
            tickvals: rows.map((r) => r.order),
            ticktext: rows.map((r) => r.band),
          },
          yaxis: { title: 'Mean change in exposure score (SD)', zeroline: false },
          shapes: [{
            // Zero is the reading line: no movement in the score.
            type: 'line', xref: 'paper', yref: 'y',
            x0: 0, x1: 1, y0: 0, y1: 0,
            line: { color: '#bbb', width: 1, dash: 'dash' },
          }],
        }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, maxWidth: 880 }}>
        {isTransition
          ? 'A binary exposure has no dose, so the states are shown as themselves. '
          : ''}
        {/* Do not promise four states, or any fixed count: a state holding
            fewer than ten people is dropped upstream, and the gap it leaves on
            the axis has to be accounted for or it reads as a rendering fault.
            Current smoking over ten years draws three of four -- No to Yes is
            eight people. */}
        {missing > 0
          ? `${missing} ${isTransition ? 'state' : 'band'}${missing === 1 ? '' : 's'} `
            + `held fewer than ten people and ${missing === 1 ? 'is' : 'are'} not drawn, `
            + 'leaving a gap on the axis. '
          : `Every ${isTransition ? 'state' : 'band'} shown clears the ten-person floor. `}
        n is people, not visits: each span pairs two visits per person.
      </Typography>

      {rows.length < 3 && (
        <Alert severity="info" sx={{ mt: 2, maxWidth: 880 }}>
          Only {rows.length} band{rows.length === 1 ? '' : 's'} cleared the ten-person floor for this
          exposure over this span. Try a longer span, where more people have changed.
        </Alert>
      )}
    </Box>
  );
}
