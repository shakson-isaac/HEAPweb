import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { compColor } from '../../lib/palette';
import { useMockup } from '../../lib/mockupData';

// ---------------------------------------------------------------------------
// DISEASE LINKS -- an exposomic effect against its genetic counterparts.
//
// A mediated effect means little in isolation: an HR of 1.05 per SD is small or
// large depending on what the same protein does under a genetic driver. Every
// protein-disease link here is scored under four drivers on the same grid of
// 451,520, so the comparison needs no aggregation and no matching:
//
//   PXS    total exposome score
//   cis    variants at the protein's own locus -- the protein's own genetics
//   trans  variants elsewhere -- a broader, more polygenic signal
//   PGS    the total polygenic score, cis and trans together
//
// CIS IS THE ONE TO WATCH. A cis instrument moves the protein directly and is
// the closest thing here to an intervention on it, so a link mediated by cis is
// evidence of a different kind from one mediated by an exposure score. That is
// why the drivers are shown side by side rather than reduced to one axis.
//
// The picker offers only specifications with a PARTITIONED run. cis and trans
// exist solely there: primary_total fits one combined genetic score, so a
// specification without a partitioned run has no cis estimate to show and is
// left out of the picker rather than offered and inert.
// ---------------------------------------------------------------------------

const SPEC_LABEL = {
  base: 'Primary', base_bmi: '+ BMI', base_clinical: '+ clinical',
  base_draw: '+ blood draw', base_exclprev: 'Healthy at baseline',
};

const DRIVERS = [
  { key: 'pxs', label: 'PXS — exposome', color: compColor('E') },
  { key: 'cis', label: 'cis — own locus', color: '#B8860B' },
  { key: 'trans', label: 'trans — elsewhere', color: '#1B6CA8' },
];

export default function DriverComparison() {
  const { data, loading, error } = useMockup('drivers');
  const [spec, setSpec] = useState('base');
  const [mode, setMode] = useState('overview');
  const [protein, setProtein] = useState(null);

  const C = useMemo(() => {
    const m = {};
    (data?.cols || []).forEach((c, i) => { m[c] = i; });
    return m;
  }, [data]);

  const rows = useMemo(() => data?.rows_by_spec?.[spec] || null, [data, spec]);

  const proteins = useMemo(() => (
    rows ? [...new Set(rows.map((r) => r[C.protein]))].sort() : []
  ), [rows, C]);

  // Distribution of the mediated effect under each driver, significant links
  // only. Drawn as |HR - 1| in percent so the three are on one scale and a
  // protective and a harmful effect of the same size sit together.
  const overview = useMemo(() => {
    if (!rows) return null;
    const t = DRIVERS.map((d) => {
      const v = [];
      rows.forEach((r) => {
        if (!r[C[`${d.key}_sig`]]) return;
        const hr = r[C[d.key]];
        if (hr != null) v.push(Math.abs(hr - 1) * 100);
      });
      return {
        type: 'violin', name: `${d.label} (${v.length.toLocaleString()})`,
        y: v, box: { visible: true }, meanline: { visible: true },
        line: { color: d.color }, fillcolor: d.color, opacity: 0.45,
        points: false, spanmode: 'hard',
        hovertemplate: '%{y:.2f}% per SD<extra></extra>',
      };
    });
    return t;
  }, [rows, C]);

  // One protein: every disease it links to, all four drivers with intervals.
  const detail = useMemo(() => {
    if (!rows || !protein) return null;
    const sel = rows.filter((r) => r[C.protein] === protein);
    if (!sel.length) return null;
    sel.sort((a, b) => Math.abs((b[C.pxs] || 1) - 1) - Math.abs((a[C.pxs] || 1) - 1));
    const top = sel.slice(0, 12).reverse();
    return DRIVERS.map((d) => ({
      type: 'scatter', mode: 'markers', name: d.label,
      x: top.map((r) => r[C[d.key]]),
      y: top.map((r) => r[C.disease]),
      marker: {
        size: 9, color: d.color,
        symbol: top.map((r) => (r[C[`${d.key}_sig`]] ? 'circle' : 'circle-open')),
        line: { color: d.color, width: 1.5 },
      },
      error_x: {
        type: 'data', symmetric: false,
        array: top.map((r) => ((r[C[`${d.key}_hi`]] != null && r[C[d.key]] != null)
          ? r[C[`${d.key}_hi`]] - r[C[d.key]] : 0)),
        arrayminus: top.map((r) => ((r[C[`${d.key}_lo`]] != null && r[C[d.key]] != null)
          ? r[C[d.key]] - r[C[`${d.key}_lo`]] : 0)),
        color: d.color, thickness: 1.1, width: 0,
      },
      hovertemplate: `<b>%{y}</b><br>${d.label}: HR %{x:.4f}<extra></extra>`,
    }));
  }, [rows, protein, C]);

  return (
    <SectionCard
      title="How large is an exposure-mediated effect, next to a genetic one?"
      subtitle={
        'The same protein–disease link scored under the exposome score and under genetic '
        + 'drivers split into cis (the protein’s own locus) and trans (everywhere else).'
      }
      loading={loading}
      error={error}
    >
      {data && rows && (
        <>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 1.5 }}>
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)}>
              <ToggleButton value="overview" sx={{ textTransform: 'none' }}>all links</ToggleButton>
              <ToggleButton value="protein" sx={{ textTransform: 'none' }}>one protein</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup size="small" exclusive value={spec}
                               onChange={(_, v) => { if (v) { setSpec(v); setProtein(null); } }}>
              {(data.specs || ['base']).map((x) => (
                <ToggleButton key={x} value={x} sx={{ textTransform: 'none' }}>
                  {SPEC_LABEL[x] || x}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {mode === 'protein' && (
              <Box sx={{ minWidth: 260, flex: '1 1 260px' }}>
                <Autocomplete
                  size="small" options={proteins} value={protein}
                  onChange={(_, v) => setProtein(v)}
                  renderInput={(p) => <TextField {...p} placeholder="Search a protein — e.g. LEP" />}
                />
              </Box>
            )}
          </Box>

          {mode === 'overview' && overview && (
            <>
              <PlotPanel
                data={overview}
                height={420}
                layout={{
                  yaxis: { title: 'mediated effect |HR − 1| (% per SD)', rangemode: 'tozero' },
                  xaxis: { showticklabels: false },
                  legend: { orientation: 'h', y: 1.12, x: 0 },
                  margin: { l: 80, r: 30, t: 45, b: 30 },
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1, maxWidth: 900 }}>
                Significant links only, so each violin is conditioned on its own driver clearing
                FDR — the counts differ and the shapes are not directly a statement about which
                driver is stronger overall. What they do show is the size of effect each driver
                delivers when it delivers one, which is the number to hold an exposomic effect
                against.
              </Typography>
            </>
          )}

          {mode === 'protein' && detail && (
            <>
              <PlotPanel
                data={detail}
                height={Math.max(320, 34 * detail[0].y.length + 110)}
                layout={{
                  xaxis: { title: 'mediated effect (HR per SD), 95% interval' },
                  yaxis: { automargin: true },
                  legend: { orientation: 'h', y: 1.08, x: 0 },
                  margin: { l: 230, r: 30, t: 45, b: 55 },
                  shapes: [{
                    type: 'line', x0: 1, x1: 1, y0: 0, y1: 1, yref: 'paper',
                    line: { color: '#999', width: 1 },
                  }],
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1, maxWidth: 900 }}>
                Filled markers cleared FDR for that driver; hollow ones did not and are drawn
                anyway, because a driver that was tested and did not reach significance is
                information, not an absence.
              </Typography>
            </>
          )}

          {mode === 'protein' && !protein && (
            <Alert severity="info">Pick a protein to compare its drivers disease by disease.</Alert>
          )}
        </>
      )}
    </SectionCard>
  );
}
