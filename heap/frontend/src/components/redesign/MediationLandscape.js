import React, { useMemo, useState } from 'react';
import {
  Alert, AlertTitle, Autocomplete, Box, Chip, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { ecatColor } from '../../lib/palette';
import { useMockup } from '../../lib/mockupData';

// ---------------------------------------------------------------------------
// DISEASE LINKS -- "reporter or intermediate?"
//
// Eight sections became one distribution and one forest. The page's claim is
// that most exposure->protein->disease links are REPORTERS -- the protein tracks
// the exposure and the disease without carrying much of the effect -- and that a
// minority are intermediates carrying a substantial share. The proportion
// mediated is exactly that quantity, so its distribution is the claim, drawn.
//
// WHY THE SPECIFICATION PICKER IS DANGEROUS HERE, AND WHAT IS DONE ABOUT IT.
// Significant links fall from 22,270 under the primary model to 11,387 under
// + BMI and 9,754 under + clinical. It is very tempting to read that collapse as
// "BMI was the mediator all along". It does not license that: adjusting for a
// variable that may be a confounder, a mediator, or both cannot separate those
// cases, and this manuscript withdrew exactly that claim. So the drop is stated
// as a sensitivity result and the reading is named and refused on screen rather
// than left for the visitor to reach on their own.
// ---------------------------------------------------------------------------

const SPEC_LABEL = {
  base: 'Primary',
  base_plus_bmi: '+ BMI',
  base_plus_clinical: '+ clinical',
  base_plus_blood_draw: '+ blood draw',
  exclude_prevalent_disease: 'Healthy at baseline',
  estimator_ridge: 'Ridge',
  estimator_elastic_net: 'Elastic net',
};
const ORDER = ['base', 'base_plus_bmi', 'base_plus_clinical', 'base_plus_blood_draw',
  'exclude_prevalent_disease', 'estimator_ridge', 'estimator_elastic_net'];

// Movable, because no principled cut exists here. The default is a round number,
// not a finding.
const CUTS = [0.05, 0.10, 0.15, 0.25, 0.50];

export default function MediationLandscape() {
  const { data, loading, error } = useMockup('mediation');
  const [spec, setSpec] = useState('base');
  const [disease, setDisease] = useState(null);
  const [cut, setCut] = useState(0.10);

  const specs = useMemo(() => {
    if (!data) return [];
    return ORDER.filter((s) => data.specs.includes(s));
  }, [data]);

  const rows = data?.links?.[spec] || null;
  const summary = data?.summary?.[spec] || null;

  // Column order comes from the payload rather than being assumed.
  const C = useMemo(() => {
    const m = {};
    (data?.cols || []).forEach((c, i) => { m[c] = i; });
    return m;
  }, [data]);

  const dist = useMemo(() => {
    if (!rows) return null;
    const pm = rows.map((r) => r[C.prop_mediated]).filter((v) => v != null);
    const below = pm.filter((v) => v < cut).length;
    const sorted = [...pm].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    return {
      trace: [{
        type: 'histogram',
        x: pm,
        nbinsx: 60,
        marker: { color: '#1B6CA8', line: { color: 'white', width: 0.5 } },
        hovertemplate: 'proportion mediated %{x}<br>%{y} links<extra></extra>',
      }],
      n: pm.length,
      median,
      pct: pm.length ? (100 * below) / pm.length : 0,
    };
  }, [rows, C, cut]);

  const diseases = useMemo(() => (
    summary ? summary.by_disease.map((d) => d[0]) : []
  ), [summary]);

  // One disease's mediators, strongest indirect effect first, coloured by the
  // exposure category the link starts from.
  const forest = useMemo(() => {
    if (!rows || !disease) return null;
    const sel = rows.filter((r) => r[C.disease] === disease);
    if (!sel.length) return null;
    sel.sort((a, b) => Math.abs((b[C.nie_HR] || 1) - 1) - Math.abs((a[C.nie_HR] || 1) - 1));
    const top = sel.slice(0, 25).reverse();
    return [{
      type: 'scatter',
      mode: 'markers',
      x: top.map((r) => r[C.nie_HR]),
      y: top.map((r) => `${r[C.protein]}  ·  ${String(r[C.category]).replace(/_/g, ' ')}`),
      marker: {
        size: 9,
        color: top.map((r) => ecatColor(r[C.category])),
        line: { color: '#333', width: 0.6 },
      },
      error_x: {
        type: 'data',
        symmetric: false,
        array: top.map((r) => (r[C.hi] != null ? r[C.hi] - r[C.nie_HR] : 0)),
        arrayminus: top.map((r) => (r[C.lo] != null ? r[C.nie_HR] - r[C.lo] : 0)),
        color: '#777', thickness: 1.1, width: 0,
      },
      customdata: top.map((r) => [r[C.prop_mediated], r[C.n_cases]]),
      hovertemplate: '<b>%{y}</b><br>indirect effect HR %{x:.4f}<br>'
        + 'proportion mediated %{customdata[0]}<br>%{customdata[1]} cases<extra></extra>',
    }];
  }, [rows, disease, C]);

  return (
    <SectionCard
      title="Reporter or intermediate?"
      subtitle={
        'The proportion mediated is the share of an exposure’s effect on disease that '
        + 'travels through the protein. Pick a disease to see the proteins carrying it, '
        + 'with the interval on every estimate.'
      }
      loading={loading}
      error={error}
    >
      {data && dist && (
        <>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
              Specification
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={spec}
              onChange={(_, v) => { if (v) { setSpec(v); setDisease(null); } }}
            >
              {specs.map((s) => (
                <ToggleButton key={s} value={s} sx={{ textTransform: 'none' }}>
                  {SPEC_LABEL[s] || s}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
              Mark a cut at
            </Typography>
            <ToggleButtonGroup size="small" exclusive value={cut} onChange={(_, v) => v && setCut(v)}>
              {CUTS.map((v) => (
                <ToggleButton key={v} value={v} sx={{ textTransform: 'none' }}>{v}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5, maxWidth: 780 }}>
              There is no principled place to split a reporter from an intermediate on this
              axis, so the line is yours to move. It is a reading aid, not a classification.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip size="small" variant="outlined" label={`${dist.n.toLocaleString()} significant links`} />
            <Chip size="small" variant="outlined" label={`${summary.n_disease} diseases`} />
            <Chip size="small" variant="outlined" label={`${summary.n_protein.toLocaleString()} proteins`} />
            <Chip
              size="small"
              label={`median link carries ${dist.median != null ? (100 * dist.median).toFixed(1) : '—'}%`}
              sx={{ bgcolor: '#1B6CA8', color: 'white', fontWeight: 700 }}
            />
            <Chip size="small" variant="outlined" label={`${dist.pct.toFixed(0)}% below the marked cut`} />
          </Box>

          {spec !== 'base' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle sx={{ fontSize: '0.85rem' }}>
                Fewer links here is a sensitivity result, not evidence of what mediates
              </AlertTitle>
              This specification leaves {dist.n.toLocaleString()} significant links against{' '}
              {data.summary.base.n_sig.toLocaleString()} under the primary model. It is tempting
              to read a drop under adjustment as showing that the adjusted-for variable was the
              real mediator. <b>It does not show that.</b> A variable can be a confounder, a
              mediator, or both at once, and adjusting for it moves the estimate in the same
              direction in every one of those cases — so attenuation cannot tell them apart.
              Read this as how much the finding depends on the model, and nothing more.
            </Alert>
          )}

          <PlotPanel
            data={dist.trace}
            height={330}
            layout={{
              xaxis: { title: 'proportion of the exposure→disease effect carried by the protein' },
              yaxis: { title: 'significant links' },
              margin: { l: 80, r: 20, t: 20, b: 60 },
              shapes: [{
                type: 'line', x0: cut, x1: cut, y0: 0, y1: 1,
                yref: 'paper', line: { color: '#B00', width: 1.5, dash: 'dot' },
              }],
              annotations: [{
                x: cut, y: 1, yref: 'paper', yanchor: 'bottom',
                text: `cut at ${cut}`, showarrow: false,
                font: { size: 11, color: '#B00' }, xanchor: 'left',
              }],
            }}
          />

          <Box sx={{ mt: 3, maxWidth: 640 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
              {`One disease's mediators — ${diseases.length} diseases have at least one significant link here`}
            </Typography>
            <Autocomplete
              size="small"
              options={diseases}
              value={disease}
              onChange={(_, v) => setDisease(v)}
              renderInput={(p) => <TextField {...p} placeholder="Search a disease — e.g. type 2 diabetes" />}
            />
          </Box>

          {forest && (
            <PlotPanel
              data={forest}
              height={Math.max(260, 26 * forest[0].y.length + 90)}
              layout={{
                xaxis: { title: 'indirect effect (HR), with 95% interval' },
                yaxis: { automargin: true },
                margin: { l: 260, r: 30, t: 20, b: 55 },
                showlegend: false,
                shapes: [{
                  type: 'line', x0: 1, x1: 1, y0: 0, y1: 1, yref: 'paper',
                  line: { color: '#999', width: 1 },
                }],
              }}
            />
          )}
        </>
      )}
    </SectionCard>
  );
}
