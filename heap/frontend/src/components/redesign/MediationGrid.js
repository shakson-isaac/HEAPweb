import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, Slider, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { ecatColor } from '../../lib/palette';
import { useSection } from '../../lib/useSection';
import { SPEC_LABEL, diseaseClass, gridIndex, specsIn } from '../../lib/mediation';

// ---------------------------------------------------------------------------
// DISEASE LINKS, alternative B -- main Figure 3b made interactive.
//
// The printed panel is a hand-chosen 5 x 13 excerpt of exposure categories
// against diseases, with the mediator count in each cell. The full grid is
// 12 x 132, which is exactly the kind of thing a page can do and a page cannot:
// the reader picks how much of it to see and clicks a cell to get the proteins,
// instead of being handed someone else's five rows.
//
// COLUMNS ARE SECTIONED BY DISEASE CLASS, as in the printed panel: circulatory,
// endocrine/metabolic, renal, digestive and the rest are kept together so a
// block of colour reads as an organ system rather than as an accident of
// alphabetical order. Within a section, diseases are ordered by total mediator
// count, and the number of sections shown is a control -- the tail is long and
// sparse, and all 132 at once is a band of near-empty cells that hides the
// structure in the head.
//
// 29 of the 132 diseases carry no class in the source and are grouped as
// "Other" rather than dropped, so the grid still totals what the deposit holds.
//
// The specification picker offers whatever partitioned runs have been
// summarised, which is not the five the rest of the site shows: only a
// partitioned run fits the 13 categories separately, and primary_total fits one
// combined exposome score. Specifications without one are absent from the
// picker rather than present and inert.
// ---------------------------------------------------------------------------

const prettyCat = (c) => String(c).replace(/_/g, ' ');


export default function MediationGrid() {
  const g0 = useSection('med_grid');
  const dc = useSection('med_disease');
  const loading = g0.loading || dc.loading;
  const error = g0.error || dc.error;
  const specs = useMemo(() => specsIn(g0.data), [g0.data]);
  const grids = useMemo(() => gridIndex(g0.data), [g0.data]);
  const sysOf = useMemo(() => diseaseClass(dc.data), [dc.data]);
  const [spec, setSpec] = useState('base');
  const [nDz, setNDz] = useState(24);
  const [cell, setCell] = useState(null);

  const view = useMemo(() => {
    const g = grids[spec];
    if (!g) return null;
    const total = Object.fromEntries(g.total);
    // Take the strongest diseases, then regroup them by class so the columns
    // arrive in blocks. Selecting first and grouping second keeps the cut on
    // "most mediators" rather than giving every class an equal share.
    const top = [...g.diseases].sort((a, b) => total[b] - total[a]).slice(0, nDz);
    const bySys = new Map();
    top.forEach((d) => {
      const k = sysOf.get(d) || 'Other';
      if (!bySys.has(k)) bySys.set(k, []);
      bySys.get(k).push(d);
    });
    const sysOrder = [...bySys.keys()].sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return bySys.get(b).reduce((s, d) => s + total[d], 0)
        - bySys.get(a).reduce((s, d) => s + total[d], 0);
    });
    const dz = [];
    const bands = [];
    sysOrder.forEach((k) => {
      const list = bySys.get(k).sort((a, b) => total[b] - total[a]);
      bands.push({ sys: k, from: dz.length, to: dz.length + list.length - 1 });
      list.forEach((d) => dz.push(d));
    });
    const cats = [...g.categories].sort((a, b) => (
      dz.reduce((s, d) => s + (g.counts.get(`${b}|${d}`) || 0), 0)
      - dz.reduce((s, d) => s + (g.counts.get(`${a}|${d}`) || 0), 0)
    ));
    const z = cats.map((c) => dz.map((d) => g.counts.get(`${c}|${d}`) || 0));
    return { dz, cats, z, total, bands, nAll: g.diseases.length };
  }, [grids, sysOf, nDz, spec]);

  const detail = useMemo(() => {
    const g = grids[spec];
    if (!g || !cell) return null;
    const key = `${cell.cat}|${cell.dz}`;
    return { n: g.counts.get(key) || 0, proteins: g.proteins.get(key) || [] };
  }, [grids, cell, spec]);

  return (
    <SectionCard
      title="Which exposures mediate into which diseases?"
      subtitle={
        'Each cell is the number of proteins carrying a significant mediated effect from that '
        + 'exposure category into that disease. Click a cell for the proteins.'
      }
      loading={loading}
      error={error}
    >
      {view && specs.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Box sx={{ minWidth: 280, flex: '1 1 280px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                {`Showing the ${nDz} diseases with the most mediators, of ${view.nAll}`}
              </Typography>
              <Slider size="small" value={nDz} min={8} max={60} step={4}
                      onChange={(_, v) => { setNDz(v); setCell(null); }} valueLabelDisplay="auto" />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Specification
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={spec}
                                 onChange={(_, v) => { if (v) { setSpec(v); setCell(null); } }}>
                {specs.map((x) => (
                  <ToggleButton key={x} value={x} sx={{ textTransform: 'none' }}>
                    {SPEC_LABEL[x] || x}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Box>

          <PlotPanel
            data={[{
              type: 'heatmap',
              z: view.z,
              x: view.dz,
              y: view.cats.map(prettyCat),
              colorscale: [[0, '#F2F6F9'], [0.25, '#8FC7C0'], [0.6, '#2E7EA8'], [1, '#22245B']],
              hovertemplate: '<b>%{y}</b> → <b>%{x}</b><br>%{z} mediator proteins<extra></extra>',
              colorbar: { title: { text: 'mediator<br>proteins', font: { size: 11 } }, thickness: 12 },
            }]}
            height={Math.max(340, 26 * view.cats.length + 220)}
            onPointClick={(p) => setCell({ cat: view.cats[p.pointIndex[0]], dz: p.x })}
            layout={{
              xaxis: { tickangle: -40, automargin: true },
              yaxis: { automargin: true },
              margin: { l: 170, r: 30, t: 56, b: 160 },
              shapes: view.bands.slice(1).map((b) => ({
                type: 'line', xref: 'x', yref: 'paper',
                x0: b.from - 0.5, x1: b.from - 0.5, y0: 0, y1: 1.03,
                line: { color: '#444', width: 1.2 },
              })),
              annotations: view.bands.map((b) => ({
                xref: 'x', x: (b.from + b.to) / 2, yref: 'paper', y: 1.045,
                text: `<b>${b.sys}</b>`, showarrow: false, xanchor: 'center',
                font: { size: 10, color: '#333' },
              })),
            }}
          />

          {cell && detail && (
            <Alert severity="info" sx={{ mt: 2 }}
                   icon={false}
                   onClose={() => setCell(null)}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={prettyCat(cell.cat)}
                      sx={{ bgcolor: ecatColor(cell.cat), color: 'white', fontWeight: 700 }} />
                <Typography variant="body2"><b>→ {cell.dz}</b></Typography>
                <Chip size="small" variant="outlined" label={`${detail.n} mediator proteins`} />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {detail.proteins.join(', ')}
                {detail.n > detail.proteins.length
                  && ` … and ${detail.n - detail.proteins.length} more`}
              </Typography>
            </Alert>
          )}

          {!cell && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>
              Click any cell to list the proteins mediating that exposure into that disease.
            </Typography>
          )}
        </>
      )}
    </SectionCard>
  );
}
