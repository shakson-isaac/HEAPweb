import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { useMockup } from '../../lib/mockupData';

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
// TWO DRIVERS, AND THEY DO NOT AGREE. The printed panel counts, per protein,
// the diseases mediated by its DOMINANT exposure category, from the per-category
// deposit: 325 disease-specific, 303 pleiotropic. Only the total-exposome arm
// was refitted under the other specifications, so a spec-aware version has to
// count diseases mediated by the TOTAL score, which at base gives 361 and 438.
//
// Both are offered and both are labeled. Silently showing the total-driver
// numbers under the paper's framing would put figures on the site that do not
// match Figure 3c and give no way to tell why.
// ---------------------------------------------------------------------------

const SPECIFIC_AT = 3;
const HUB_AT = 20;
const COL = { specific: '#5E3C99', intermediate: '#B5B5B5', hub: '#C51B7D' };
const N_LABEL = 8;

const SPEC_LABEL = {
  base: 'Primary',
  base_plus_bmi: '+ BMI',
  base_plus_clinical: '+ clinical',
  base_plus_blood_draw: '+ blood draw',
  exclude_prevalent_disease: 'Healthy at baseline',
};

export default function PleiotropySpectrum() {
  const { data, loading, error } = useMockup('med_structure');
  const sp = useMockup('spectrum_specs');
  const [find, setFind] = useState(null);
  const [driver, setDriver] = useState('category');   // 'category' = as printed
  const [spec, setSpec] = useState('base');
  const [catSpec, setCatSpec] = useState('base');

  // Point size is the number of driving exposure categories, which only the
  // per-category deposit knows. Under the total-exposome driver there is one
  // driver by construction, so the size channel is switched off rather than
  // filled with a constant that would read as information.
  const sizeOf = useMemo(() => {
    const m = new Map();
    const s = data?.spectrum_by_spec?.[catSpec];
    if (s) s.proteins.forEach((p, i) => m.set(p, s.n_exposures[i] || 1));
    return m;
  }, [data, catSpec]);

  const view = useMemo(() => {
    // The category driver now has its own specification set -- whichever
    // partitioned runs have been summarised -- and it is NOT the same set the
    // total driver offers, so each keeps its own selection.
    const s = driver === 'category'
      ? data?.spectrum_by_spec?.[catSpec]
      : sp.data?.by_spec?.[spec];
    if (!s) return null;
    const pts = s.proteins.map((p, i) => ({
      p,
      x: s.pleiotropy[i] || 0,
      y: s.max_eff[i],
      n: driver === 'category' ? (s.n_exposures?.[i] || 1) : (sizeOf.get(p) || 1),
      dz: s.diseases[i] || [],
      tier: (s.pleiotropy[i] || 0) <= SPECIFIC_AT ? 'specific'
        : (s.pleiotropy[i] || 0) >= HUB_AT ? 'hub' : 'intermediate',
    })).filter((d) => d.x > 0);
    const hubs = pts.filter((d) => d.tier === 'hub').sort((a, b) => b.y - a.y).slice(0, N_LABEL);
    // NOT `spec` -- that shadows the specification state read a few lines above
    // in this same scope, putting it in the temporal dead zone and throwing the
    // moment the total-exposome driver is selected.
    const specific = pts.filter((d) => d.tier === 'specific').sort((a, b) => b.y - a.y).slice(0, 6);
    return {
      pts,
      labels: [...hubs, ...specific].map((d) => d.p),
      nSpec: pts.filter((d) => d.tier === 'specific').length,
      nHub: pts.filter((d) => d.tier === 'hub').length,
    };
  }, [data, sp.data, driver, spec, catSpec, sizeOf]);

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
          size: driver === 'category' ? g.map((d) => 4 + 3 * Math.min(d.n, 4)) : 6,
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
  }, [view, find, driver]);

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
                Count diseases mediated by
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={driver}
                                 onChange={(_, v) => v && setDriver(v)}>
                <ToggleButton value="category" sx={{ textTransform: 'none' }}>
                  dominant exposure category
                </ToggleButton>
                <ToggleButton value="total" sx={{ textTransform: 'none' }}>
                  total exposome score
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {driver === 'category' && (data.specs || []).length > 1 && (
              <Box>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                  Specification
                </Typography>
                <ToggleButtonGroup size="small" exclusive value={catSpec}
                                   onChange={(_, v) => v && setCatSpec(v)}>
                  {(data.specs || []).map((x) => (
                    <ToggleButton key={x} value={x} sx={{ textTransform: 'none' }}>
                      {SPEC_LABEL[x] || x}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}
            {driver === 'total' && (
              <Box>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                  Specification
                </Typography>
                <ToggleButtonGroup size="small" exclusive value={spec}
                                   onChange={(_, v) => v && setSpec(v)}>
                  {(sp.data?.specs || []).map((x) => (
                    <ToggleButton key={x} value={x} sx={{ textTransform: 'none' }}>
                      {SPEC_LABEL[x] || x}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}
          </Box>

          <Alert severity={driver === 'category' ? 'success' : 'info'} sx={{ mb: 2 }}>
            {driver === 'category'
              ? (catSpec === 'base'
                ? `As printed in Figure 3c: pleiotropy is the number of diseases a protein
                   mediates through its dominant exposure category, and point size is how many
                   categories drive it. This is the published view — 325 and 303.`
                : `Pleiotropy through the dominant exposure category, as in Figure 3c, but under
                   a different adjustment: ${view.nSpec} disease-specific and ${view.nHub}
                   pleiotropic against the published 325 and 303.`)
              : `Pleiotropy here counts diseases mediated by the TOTAL exposome score, which is the
                 only arm refitted under other specifications. At base this gives ${view.nSpec}
                 disease-specific and ${view.nHub} pleiotropic against the 325 and 303 printed in
                 Figure 3c — a different driver, not a different result. Point size is off, because
                 the total score is one driver by construction.`}
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
