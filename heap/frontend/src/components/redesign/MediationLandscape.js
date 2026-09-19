import React, { useMemo, useState } from 'react';
import {
  Autocomplete, Box, Chip, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { compColor } from '../../lib/palette';
import { useKeys, useSection, useShard } from '../../lib/useSection';
import {
  SPEC_LABEL, binMedian, diseaseInfo, distIndex, shardRows, specsIn,
} from '../../lib/mediation';

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
// cases, and this manuscript withdrew exactly that claim. The on-screen warning
// that refused this reading moved to the FAQ ("Does the estimate shrinking under
// "+ BMI" mean the effect is mediated by BMI?") and Methods on 2026-09-19 --
// results pages carry no caveats. Never reintroduce the claim as copy.
// ---------------------------------------------------------------------------

// Movable, because no principled cut exists here. The default is a round number,
// not a finding.
const CUTS = [0.05, 0.10, 0.15, 0.25, 0.50];

export default function MediationLandscape() {
  const { data, loading, error } = useSection('med_pm_dist');
  const dcSec = useSection('med_disease');
  const { data: dzKeys } = useKeys('med_dz_links');
  const [spec, setSpec] = useState('base');
  const [disease, setDisease] = useState(null);
  const [cut, setCut] = useState(0.10);

  const specs = useMemo(() => specsIn(data), [data]);
  const dz = useMemo(() => diseaseInfo(dcSec.data), [dcSec.data]);
  const nameOf = (id) => dz.label.get(id) || id;
  const pm = useMemo(() => distIndex(data, 'prop_mediated', null), [data]);
  const { data: shard } = useShard('med_dz_links', disease);
  const rows = useMemo(
    () => shardRows(shard, disease).filter((r) => r.spec === spec && r.pxs.sig),
    [shard, spec, disease],
  );

  // Everything the header and the histogram need comes from the BINS. The link
  // rows are no longer in memory -- only the selected disease's shard is -- so a
  // count over them would report that one disease rather than the whole
  // specification.
  const dist = useMemo(() => {
    const g = pm[spec];
    const b = g && g.all;
    if (!b) return null;
    const total = b.y.reduce((a, c) => a + c, 0);
    let below = 0;
    for (let i = 0; i < b.x.length; i += 1) if (b.x[i] < cut) below += b.y[i];
    return {
      trace: [{
        type: 'bar',
        x: b.x,
        y: b.y,
        marker: { color: '#1B6CA8', line: { width: 0 } },
        hovertemplate: 'proportion mediated %{x}<br>%{y} links<extra></extra>',
      }],
      n: total,
      median: binMedian(b),
      pct: total ? (100 * below) / total : 0,
    };
  }, [pm, spec, cut]);

  const summary = useMemo(() => {
    if (!dist) return null;
    return { n_sig: dist.n, n_disease: (dzKeys?.keys ? Object.keys(dzKeys.keys).length : 0) };
  }, [dist, dzKeys]);

  const diseases = useMemo(() => (dzKeys?.keys ? Object.keys(dzKeys.keys).sort() : []), [dzKeys]);

  // One disease's mediators, strongest indirect effect first, coloured by the
  // exposure category the link starts from.
  const forest = useMemo(() => {
    // `rows` IS this disease's shard, already filtered to significant exposomic
    // links, so there is nothing left to select on.
    if (!rows?.length || !disease) return null;
    const sel = rows;
    sel.sort((a, b) => Math.abs((b.pxs.hr || 1) - 1) - Math.abs((a.pxs.hr || 1) - 1));
    const top = sel.slice(0, 25).reverse();
    return [{
      type: 'scatter',
      mode: 'markers',
      x: top.map((r) => r.pxs.hr),
      y: top.map((r) => r.protein),
      marker: { size: 9, color: compColor('E'), line: { color: '#333', width: 0.6 } },
      error_x: {
        type: 'data',
        symmetric: false,
        array: top.map((r) => (r.pxs.hi != null ? r.pxs.hi - r.pxs.hr : 0)),
        arrayminus: top.map((r) => (r.pxs.lo != null ? r.pxs.hr - r.pxs.lo : 0)),
        color: '#777', thickness: 1.1, width: 0,
      },
      customdata: top.map((r) => [r.pm, r.nCases]),
      hovertemplate: '<b>%{y}</b><br>indirect effect HR %{x:.4f}<br>'
        + 'proportion mediated %{customdata[0]}<br>%{customdata[1]} cases<extra></extra>',
    }];
  }, [rows, disease]);

  return (
    <SectionCard
      title="Reporter or intermediate?"
      subtitle={
        'Individual proteins explained only small fractions of a single exposure–disease '
        + 'association, suggestive of lifestyle influencing disease through shared proteomic '
        + 'responses rather than singular mediators.'
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
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip size="small" variant="outlined" label={`${dist.n.toLocaleString()} significant links`} />
            <Chip size="small" variant="outlined" label={`${summary.n_disease} diseases`} />
            <Chip
              size="small"
              label={`median link carries ${dist.median != null ? (100 * dist.median).toFixed(1) : '—'}%`}
              sx={{ bgcolor: '#1B6CA8', color: 'white', fontWeight: 700 }}
            />
            <Chip size="small" variant="outlined" label={`${dist.pct.toFixed(0)}% below the marked cut`} />
          </Box>

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
              getOptionLabel={nameOf}
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
