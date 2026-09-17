import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { compColor } from '../../lib/palette';
import { useKeys, useSection, useShard } from '../../lib/useSection';
import {
  SPEC_LABEL, diseaseInfo, distIndex, shardRows, specsIn,
} from '../../lib/mediation';

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

const DRIVERS = [
  { key: 'pxs', label: 'PXS — exposome', color: compColor('E') },
  { key: 'cis', label: 'cis — own locus', color: '#B8860B' },
  { key: 'trans', label: 'trans — elsewhere', color: '#1B6CA8' },
];

export default function DriverComparison() {
  // The overview reads BINNED distributions, not the links -- it only ever drew
  // a shape from them. The per-protein view fetches that protein's shard.
  const { data, loading, error } = useSection('med_driver_dist');
  const dcSec = useSection('med_disease');
  const { data: keys } = useKeys('med_drivers');
  const [spec, setSpec] = useState('base');
  const [mode, setMode] = useState('overview');
  const [protein, setProtein] = useState(null);

  const specs = useMemo(() => specsIn(data), [data]);
  const dz = useMemo(() => diseaseInfo(dcSec.data), [dcSec.data]);
  const nameOf = useCallback((id) => dz.label.get(id) || id, [dz]);
  const dist = useMemo(() => distIndex(data, 'effect_pct', 'driver'), [data]);

  // Protein keys come from the shard index, so the picker lists everything the
  // section holds without fetching any of it.
  const proteins = useMemo(() => (keys?.keys ? Object.keys(keys.keys).sort() : []), [keys]);
  const { data: shard } = useShard('med_drivers', protein);
  const rows = useMemo(
    () => shardRows(shard, protein).filter((r) => r.spec === spec),
    [shard, spec, protein],
  );

  // Distribution of the mediated effect under each driver, significant links
  // only. Drawn as |HR - 1| in percent so the three are on one scale and a
  // protective and a harmful effect of the same size sit together.
  const overview = useMemo(() => {
    const byDriver = dist[spec];
    if (!byDriver) return null;
    return DRIVERS.map((d) => {
      const g = byDriver[d.key];
      if (!g) return null;
      const n = g.y.reduce((a, b) => a + b, 0);
      return {
        type: 'bar', name: `${d.label} (${n.toLocaleString()})`,
        x: g.x, y: g.y,
        marker: { color: d.color, line: { width: 0 } },
        opacity: 0.55,
        hovertemplate: `<b>${d.label}</b><br>%{x}% per SD<br>%{y} links<extra></extra>`,
      };
    }).filter(Boolean);
  }, [dist, spec]);

  // One protein: every disease it links to, all four drivers with intervals.
  const detail = useMemo(() => {
    if (!rows || !protein) return null;
    const sel = rows.filter((r) => r.protein === protein);
    if (!sel.length) return null;
    sel.sort((a, b) => Math.abs((b.pxs.hr || 1) - 1) - Math.abs((a.pxs.hr || 1) - 1));
    const top = sel.slice(0, 12).reverse();
    return DRIVERS.map((d) => ({
      type: 'scatter', mode: 'markers', name: d.label,
      x: top.map((r) => r[d.key].hr),
      y: top.map((r) => nameOf(r.disease)),
      marker: {
        size: 9, color: d.color,
        symbol: top.map((r) => (r[d.key].sig ? 'circle' : 'circle-open')),
        line: { color: d.color, width: 1.5 },
      },
      error_x: {
        type: 'data', symmetric: false,
        array: top.map((r) => ((r[d.key].hi != null && r[d.key].hr != null)
          ? r[d.key].hi - r[d.key].hr : 0)),
        arrayminus: top.map((r) => ((r[d.key].lo != null && r[d.key].hr != null)
          ? r[d.key].hr - r[d.key].lo : 0)),
        color: d.color, thickness: 1.1, width: 0,
      },
      hovertemplate: `<b>%{y}</b><br>${d.label}: HR %{x:.4f}<extra></extra>`,
    }));
  }, [rows, protein, nameOf]);

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
      {data && specs.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 1.5 }}>
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)}>
              <ToggleButton value="overview" sx={{ textTransform: 'none' }}>all links</ToggleButton>
              <ToggleButton value="protein" sx={{ textTransform: 'none' }}>one protein</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup size="small" exclusive value={spec}
                               onChange={(_, v) => { if (v) { setSpec(v); setProtein(null); } }}>
              {specs.map((x) => (
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
                  barmode: 'overlay',
                  xaxis: { title: 'mediated effect |HR − 1| (% per SD)', range: [0, 12] },
                  yaxis: { title: 'significant links' },
                  legend: { orientation: 'h', y: 1.12, x: 0 },
                  margin: { l: 80, r: 30, t: 45, b: 60 },
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1, maxWidth: 900 }}>
Significant links only, so each distribution is conditioned on its own driver
                clearing FDR — the counts differ, and the shapes are not a statement about which
                driver is stronger overall. What they show is the size of effect each driver
                delivers when it delivers one, which is the number to hold an exposomic effect
                against. Binned at 0.25%, with everything above 30% in the last bar; the axis is
                clipped at 12% where the mass is.
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
