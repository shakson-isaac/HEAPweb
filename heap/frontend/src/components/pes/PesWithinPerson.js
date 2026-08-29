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
  // Binary exposures are always a level -- a switch has no dose to plot
  // against. For the others the delta is the clearer default, but the levels
  // answer a question the delta cannot: whether the people who moved most
  // started somewhere different in the first place.
  const [view, setView] = useUrlState('view', 'change');

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
        before: Number(d.mean_before[i]),
        after: Number(d.mean_after[i]),
        seBefore: Number(d.se_before[i]),
        seAfter: Number(d.se_after[i]),
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
  const asLevels = isTransition || view === 'levels';
  // A transition always has four possible states; an ordinal band set runs
  // -3..+3. Anything absent was suppressed by the ten-person floor upstream,
  // which is a fact about the data and belongs on the page.
  const expected = isTransition ? 4 : (mode === 'sd' ? 5 : 7);
  const missing = Math.max(0, expected - rows.length);
  // Say WHICH state is absent, not just how many. "One state was suppressed"
  // leaves the reader guessing why a line they expected is not there; naming
  // it answers the question. The count itself stays unpublished -- it is a
  // small cell in its own right.
  const ALL_STATES = ['No → No', 'No → Yes', 'Yes → No', 'Yes → Yes'];
  const absent = isTransition
    ? ALL_STATES.filter((x) => !rows.some((r) => r.band === x))
    : [];

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        When this exposure changes, does the score follow?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 880 }}>
        {asLevels
          ? (isTransition
            ? 'Each line is a group of people who made the same switch, drawn at its mean score on '
              + 'each visit. A line that falls means the score came down as the exposure stopped.'
            : 'Each line is a group of people whose exposure moved by the same amount, drawn at its '
              + 'mean score on each visit. Where the lines start shows whether the groups began alike.')
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
        {!isTransition && (
          <ToggleButtonGroup
            size="small" exclusive value={view}
            onChange={(_, v) => v && setView(v)}
          >
            <ToggleButton value="change" title="Mean change in score, by how far the exposure moved">
              Change
            </ToggleButton>
            <ToggleButton value="levels" title="Mean score at each visit, one line per group">
              Before / after
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {stat && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Chip size="small" label={`r = ${stat.r.toFixed(2)} [${stat.lo.toFixed(2)}, ${stat.hi.toFixed(2)}]`} />
          <Chip size="small" variant="outlined" label={`${stat.people.toLocaleString()} people`} />
          <Chip size="small" variant="outlined" label={`${stat.changed.toLocaleString()} changed`} />
        </Box>
      )}

      <PlotPanel
        data={asLevels ? rows.map((r) => {
          // A delta answers "did it move". For a switch the reader also needs
          // "from where to where": in main Fig 6c the quitters start at smoker
          // level and come down to nearly non-smoker, and a single delta hides
          // that they started high. So draw the LEVEL at each visit.
          //
          // Grey for the two groups whose state did not change, colour for the
          // two that switched -- the same division Fig 6c makes.
          // Seven lines in one colour is spaghetti. The bands are ORDERED,
          // so colour has to carry that order: blue for the groups that cut
          // back, red for the groups that went up, grey at no change. Then
          // the reading is immediate -- blue lines should fall and red rise,
          // and a crossing is visible instead of buried.
          const noMove = isTransition
            ? (r.band === 'No → No' || r.band === 'Yes → Yes')
            : (r.band === '0' || r.band === '-0.5 to +0.5');
          let c;
          if (isTransition) {
            c = noMove ? '#9aa0a6' : color;
          } else if (noMove) {
            c = '#9aa0a6';
          } else {
            const centre = mode === 'sd' ? 3 : 4;
            const span2 = Math.max(...rows.map((x) => Math.abs(x.order - centre)), 1);
            const t = (r.order - centre) / span2;          // -1 .. +1
            const mix = (from, to, u) => from.map((v, k) => Math.round(v + (to[k] - v) * u));
            const rgb = t < 0 ? mix([120, 160, 200], [8, 81, 156], -t)
              : mix([230, 160, 150], [165, 15, 21], t);
            c = `rgb(${rgb.join(',')})`;
          }
          const switched = !noMove;
          return {
            type: 'scatter',
            mode: isTransition ? 'lines+markers+text' : 'lines+markers',
            x: ['First visit', 'Second visit'],
            y: [r.before, r.after],
            error_y: {
              type: 'data', array: [1.96 * r.seBefore, 1.96 * r.seAfter],
              color: c, thickness: 1.2, width: 4,
            },
            line: { color: c, width: switched ? 2.5 : 1.5 },
            marker: { size: 8, color: c },
            // Without this the label on the second visit is clipped at the
            // axis edge and reads "Yes -> Y", however wide the margin is.
            cliponaxis: false,
            ...(isTransition ? {
              text: ['', `  ${r.band} (${r.n.toLocaleString()})`],
              textposition: 'middle right',
              textfont: { size: 11, color: c },
            } : {}),
            name: `${r.band}  (${r.n.toLocaleString()})`,
            showlegend: !isTransition,
            hovertemplate: `${r.band}, ${r.n.toLocaleString()} people`
              + '<br>%{x}: %{y:.2f}<extra></extra>',
          };
        }) : [
          ...(asLevels ? [] : [{
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
          height: 420,
          showlegend: asLevels && !isTransition,
          legend: { x: 1.02, y: 1, xanchor: 'left', font: { size: 11 },
                    title: { text: 'Change in exposure', font: { size: 11 } } },
          // The slope view writes its group labels to the right of the second
          // visit, outside the plotting area, so it needs the room.
          margin: { l: 70, r: asLevels ? (isTransition ? 200 : 210) : 26, t: 12, b: 64 },
          xaxis: asLevels
            ? { title: '', tickfont: { size: 12 } }
            : {
              title: AXIS[mode],
              tickmode: 'array',
              tickvals: rows.map((r) => r.order),
              ticktext: rows.map((r) => r.band),
            },
          yaxis: {
            title: asLevels
              ? 'Exposure score (SD)'
              : 'Mean change in exposure score (SD)',
            zeroline: false,
          },
          shapes: [{
            // In the delta view zero means no movement. In the slope view it
            // is the cohort mean, which is what a level is measured against.
            type: 'line', xref: 'paper', yref: 'y',
            x0: 0, x1: 1, y0: 0, y1: 0,
            line: { color: '#bbb', width: 1, dash: 'dash' },
          }],
        }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, maxWidth: 880 }}>
        {isTransition
          ? 'A binary exposure has no dose, so what it has is a switch, read as a level on each visit. '
          : ''}
        {/* Do not promise four states, or any fixed count: a state holding
            fewer than ten people is dropped upstream, and the gap it leaves on
            the axis has to be accounted for or it reads as a rendering fault.
            Current smoking over ten years draws three of four -- No to Yes is
            eight people. */}
        {absent.length > 0
          ? `${absent.join(' and ')} held fewer than five people and `
            + `${absent.length === 1 ? 'is' : 'are'} not drawn. `
          : missing > 0
            ? `${missing} band${missing === 1 ? '' : 's'} held fewer than five people and `
              + `${missing === 1 ? 'is' : 'are'} not drawn, leaving a gap on the axis. `
            : `Every ${isTransition ? 'state' : 'band'} shown clears the five-person floor. `}
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
