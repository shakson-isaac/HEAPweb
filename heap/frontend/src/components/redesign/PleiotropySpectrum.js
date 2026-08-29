import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { useSection } from '../../lib/useSection';
import { SPEC_LABEL, spectrumIndex, specsIn } from '../../lib/mediation';

// ---------------------------------------------------------------------------
// DISEASE LINKS, alternative A -- main Figure 3c made interactive.
//
// THIS is where the reporter claim actually lives, and it is a claim about
// BREADTH, not about the size of the mediated fraction. A protein that mediates
// two diseases is a specific intermediary; one that mediates thirty is a shared
// reporter carrying a general signal that happens to track many outcomes. An
// earlier draft of this page tried to make the same argument from the proportion
// mediated and could not, because that quantity does not say it: its median is
// 0.127 and its bulk sits between 0.10 and 0.25 regardless of breadth.
//
// PLEIOTROPY IS COUNTED THE WAY THE PRINTED PANEL COUNTS IT: diseases mediated
// by the protein's DOMINANT exposure category, read from the same file Figure 3c
// is drawn from. At base that is 325 disease-specific and 303 pleiotropic, the
// published numbers.
//
// An earlier version also offered a TOTAL-exposome driver, because only that arm
// had been refitted under the other specifications and it was the only way to
// show more than base. It gave different numbers for the same word -- 361 and
// 438 at base -- and needed a paragraph to explain why. The partitioned runs
// have since been fitted for the other specifications, so the workaround is
// gone and the picker simply offers whichever ones are summarised.
// ---------------------------------------------------------------------------

const SPECIFIC_AT = 3;
const HUB_AT = 20;
const COL = { specific: '#5E3C99', intermediate: '#B5B5B5', hub: '#C51B7D' };
const N_LABEL = 8;


export default function PleiotropySpectrum() {
  const { data, loading, error } = useSection('med_spectrum');
  const [find, setFind] = useState(null);
  const [spec, setSpec] = useState('base');

  const specs = useMemo(() => specsIn(data), [data]);
  const bySpec = useMemo(() => spectrumIndex(data), [data]);

  const view = useMemo(() => {
    const rows = bySpec[spec];
    if (!rows) return null;
    const pts = rows.map((d) => ({
      ...d,
      tier: d.x <= SPECIFIC_AT ? 'specific' : d.x >= HUB_AT ? 'hub' : 'intermediate',
    })).filter((d) => d.x > 0);
    const hubs = pts.filter((d) => d.tier === 'hub').sort((a, b) => b.y - a.y).slice(0, N_LABEL);
    // NOT `spec` -- that shadows the specification state read a few lines above
    // in this same scope, putting it in the temporal dead zone and throwing on
    // the next render.
    const specific = pts.filter((d) => d.tier === 'specific').sort((a, b) => b.y - a.y).slice(0, 6);
    return {
      pts,
      labels: [...hubs, ...specific].map((d) => d.p),
      nSpec: pts.filter((d) => d.tier === 'specific').length,
      nHub: pts.filter((d) => d.tier === 'hub').length,
    };
  }, [bySpec, spec]);

  const traces = useMemo(() => {
    if (!view) return [];
    const groups = [
      ['specific', `disease-specific (≤ ${SPECIFIC_AT})`],
      ['intermediate', 'intermediate'],
      ['hub', `pleiotropic hub (≥ ${HUB_AT})`],
    ];
    const t = groups.map(([k, name]) => {
      const g = view.pts.filter((d) => d.tier === k);
      return {
        type: 'scatter', mode: 'markers', name: `${name} (${g.length})`,
        x: g.map((d) => d.x), y: g.map((d) => d.y), text: g.map((d) => d.p),
        customdata: g.map((d) => d.n),
        marker: {
          color: COL[k], opacity: 0.75, line: { width: 0 },
          size: g.map((d) => 4 + 3 * Math.min(d.n, 4)),
        },
        hovertemplate: '<b>%{text}</b><br>mediates %{x} diseases<br>'
          + 'strongest effect %{y:.2f}% per SD<br>%{customdata} driving exposures<extra></extra>',
      };
    });
    const lab = view.pts.filter((d) => view.labels.includes(d.p));
    t.push({
      type: 'scatter', mode: 'text', x: lab.map((d) => d.x), y: lab.map((d) => d.y),
      text: lab.map((d) => d.p), textposition: 'top center',
      textfont: { size: 10, color: '#111' }, hoverinfo: 'skip', showlegend: false,
    });
    if (find) {
      const h = view.pts.find((d) => d.p === find);
      if (h) {
        t.push({
          type: 'scatter', mode: 'markers+text', x: [h.x], y: [h.y], text: [find],
          textposition: 'bottom center', textfont: { size: 12, color: '#B00' },
          marker: { size: 16, color: 'rgba(0,0,0,0)', line: { color: '#B00', width: 2 } },
          hoverinfo: 'skip', showlegend: false,
        });
      }
    }
    return t;
  }, [view, find]);

  const picked = useMemo(() => (
    view && find ? view.pts.find((d) => d.p === find) : null
  ), [view, find]);

  return (
    <SectionCard
      title="From disease-specific intermediary to shared reporter"
      subtitle={
        'Each mediator protein by how many diseases it mediates and how strong its strongest '
        + 'mediated effect is. Point size is the number of exposure categories driving it.'
      }
      loading={loading}
      error={error}
    >
      {view && (
        <>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'flex-end', mb: 1.5 }}>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Specification
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={spec}
                                 onChange={(_, v) => v && setSpec(v)}>
                {specs.map((x) => (
                  <ToggleButton key={x} value={x} sx={{ textTransform: 'none' }}>
                    {SPEC_LABEL[x] || x}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Box>

          <Alert severity={spec === 'base' ? 'success' : 'info'} sx={{ mb: 2 }}>
            {spec === 'base'
              ? `As printed in Figure 3c: pleiotropy is the number of diseases a protein mediates
                 through its dominant exposure category, and point size is how many categories
                 drive it. This is the published view — ${view.nSpec} disease-specific and
                 ${view.nHub} pleiotropic.`
              : `The same count under a different adjustment: ${view.nSpec} disease-specific and
                 ${view.nHub} pleiotropic, against the 325 and 303 printed in Figure 3c. Fewer
                 links clear significance under this specification, so proteins move left as
                 well as out of the plot entirely.`}
          </Alert>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
            <Chip size="small" label={`${view.nSpec} disease-specific`}
                  sx={{ bgcolor: COL.specific, color: 'white', fontWeight: 700 }} />
            <Chip size="small" label={`${view.nHub} pleiotropic shared reporters`}
                  sx={{ bgcolor: COL.hub, color: 'white', fontWeight: 700 }} />
            <Box sx={{ minWidth: 220, flex: '1 1 220px' }}>
              <Autocomplete
                size="small" options={view.pts.map((d) => d.p)} value={find}
                onChange={(_, v) => setFind(v)}
                renderInput={(p) => <TextField {...p} placeholder="Find a protein — e.g. LEP" />}
              />
            </Box>
          </Box>

          <PlotPanel
            data={traces}
            height={480}
            layout={{
              // Explicit integer ticks. A log axis over counts otherwise labels
              // itself 10^0.5 and similar, which is unreadable when the quantity
              // is "how many diseases" -- the axis has to say 1, 3, 10, 30.
              xaxis: {
                type: 'log',
                title: 'number of diseases this protein mediates',
                tickvals: [1, 2, 3, 5, 10, 20, 30, 50, 100],
                ticktext: ['1', '2', '3', '5', '10', '20', '30', '50', '100'],
                tickmode: 'array',
              },
              yaxis: { title: 'strongest mediated effect |NIE| (% per SD)' },
              legend: { orientation: 'h', y: 1.1, x: 0 },
              margin: { l: 80, r: 30, t: 45, b: 70 },
              // The two tier boundaries drawn, so the colour split has a visible
              // cause on the axis instead of being asserted by the legend alone.
              shapes: [SPECIFIC_AT, HUB_AT].map((v) => ({
                type: 'line', xref: 'x', yref: 'paper',
                x0: v, x1: v, y0: 0, y1: 1,
                line: { color: '#999', width: 1, dash: 'dot' },
              })),
              annotations: [
                {
                  xref: 'x', x: Math.log10(SPECIFIC_AT), yref: 'paper', y: -0.13,
                  text: `≤ ${SPECIFIC_AT}: disease-specific`, showarrow: false,
                  xanchor: 'right', font: { size: 10, color: COL.specific },
                },
                {
                  xref: 'x', x: Math.log10(HUB_AT), yref: 'paper', y: -0.13,
                  text: `≥ ${HUB_AT}: shared reporter`, showarrow: false,
                  xanchor: 'left', font: { size: 10, color: COL.hub },
                },
              ],
            }}
          />

          {picked && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <b>{picked.p}</b> mediates {picked.x} disease{picked.x === 1 ? '' : 's'} with a
              strongest effect of {picked.y.toFixed(2)}% per SD, driven by {picked.n} exposure
              categor{picked.n === 1 ? 'y' : 'ies'}.
              {picked.dz.length > 0 && (
                <> Diseases: {picked.dz.slice(0, 12).join(', ')}
                  {picked.dz.length > 12 ? ` and ${picked.dz.length - 12} more` : ''}.</>
              )}
            </Alert>
          )}

          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5, maxWidth: 900 }}>
            The claim this panel carries is about <b>breadth</b>, not about how much of an
            exposure&apos;s effect a protein conducts. A protein mediating thirty diseases is
            reporting something general that tracks many outcomes; one mediating two is a candidate
            for a specific mechanism. The proportion mediated does not separate those — its median
            is 0.13 across the significant links regardless of how many diseases a protein touches.
          </Typography>
        </>
      )}
    </SectionCard>
  );
}
