import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { compColor } from '../../lib/palette';
import { useSection } from '../../lib/useSection';
import { gradientIndex, proteinIndex, specLabel, specList } from '../../lib/varcomp';

// ---------------------------------------------------------------------------
// MAIN RESULTS, second view -- the exposure-responsive spectrum, as printed.
//
// This is main-manuscript Figure 1b made interactive: each protein placed by its
// genetic contribution against its exposomic one, with the exposure-responsive
// set (exposomic >= 1% of variance) picked out and exemplars labeled.
//
// TWO PANELS, TWO METHODS, DELIBERATELY NOT MERGED. The top panel is HEAP's
// cross-validated prediction R2 and the bottom is GREML's variance components --
// two independent estimators of the same quantity, and their agreement is the
// argument. Stacking them lets a reader check that the proteins picked out in
// one are picked out in the other; averaging them would destroy exactly that.
//
// ONLY THE HEAP PANEL TAKES A SPECIFICATION. GREML was fitted once, multi-kernel,
// at GRM cutoff 0.025 -- there is no + BMI GREML to switch to. The panel says so
// rather than offering a control that would silently do nothing.
//
// THE PROTEIN SET IS A CONTROL because it changes the headline number. Restricted
// to the 2,051 proteins GREML also estimated, HEAP flags 608 exposure-responsive
// and GREML 1,026 -- the published counts, reproduced. Across all 2,686 proteins
// HEAP flags more, and a reader comparing against the paper needs to know which
// set is on screen rather than discovering the gap.
// ---------------------------------------------------------------------------

const THR = 0.01;
const GRAY = '#C9CDD2';
const N_LABEL = 8;

export default function ExposomicGradient() {
  const pr = useSection('varcomp_protein');
  const gr = useSection('varcomp_gradient');
  const mt = useSection('varcomp_specs_meta');
  const [exp, setExp] = useState('M1_base_lasso');
  const [scope, setScope] = useState('greml');   // 'greml' = the comparable set
  const [find, setFind] = useState(null);

  const loading = pr.loading || gr.loading || mt.loading;
  const error = pr.error || gr.error || mt.error;

  const specs = useMemo(() => specList(mt.data), [mt.data]);
  const specById = useMemo(() => new Map(specs.map((x) => [x.id, x])), [specs]);
  const prot = useMemo(() => proteinIndex(pr.data), [pr.data]);
  const gm = useMemo(() => gradientIndex(gr.data), [gr.data]);

  // The proteins labeled in BOTH panels: the strongest exposomic signal under
  // the specification on screen. Same names in both, as in the printed figure,
  // so a reader can follow a protein across methods.
  const heap = useMemo(() => {
    if (!prot || !gm) return null;
    const keep = scope === 'greml' ? new Set(gm.proteins) : null;
    const G = prot.bySpec[exp]?.G?.r2;
    const E = prot.bySpec[exp]?.E?.r2;
    if (!G || !E) return null;
    const pts = [];
    prot.proteins.forEach((p, i) => {
      if (keep && !keep.has(p)) return;
      if (G[i] == null || E[i] == null) return;
      pts.push({ p, x: G[i], y: E[i], resp: E[i] >= THR });
    });
    const labels = pts.filter((d) => d.resp).sort((a, b) => b.y - a.y)
      .slice(0, N_LABEL).map((d) => d.p);
    return { pts, labels, nResp: pts.filter((d) => d.resp).length, n: pts.length };
  }, [prot, gm, exp, scope]);

  const greml = useMemo(() => {
    if (!gm) return null;
    const pts = [];
    gm.proteins.forEach((p, i) => {
      const x = gm.greml.G[i];
      const y = gm.greml.E[i];
      if (x == null || y == null) return;
      pts.push({ p, x, y, resp: y >= THR });
    });
    return { pts, nResp: pts.filter((d) => d.resp).length, n: pts.length };
  }, [gm]);

  const panel = (pts, labels, title, xTitle, yTitle, nResp) => {
    const resp = pts.filter((d) => d.resp);
    const rest = pts.filter((d) => !d.resp);
    const lab = pts.filter((d) => labels.includes(d.p));
    const traces = [
      {
        type: 'scattergl', mode: 'markers', name: 'not exposure-responsive',
        x: rest.map((d) => d.x), y: rest.map((d) => d.y), text: rest.map((d) => d.p),
        marker: { size: 4, color: GRAY, opacity: 0.75, line: { width: 0 } },
        hovertemplate: `<b>%{text}</b><br>${xTitle} %{x:.4f}<br>${yTitle} %{y:.4f}<extra></extra>`,
        showlegend: false,
      },
      {
        type: 'scattergl', mode: 'markers', name: 'exposure-responsive',
        x: resp.map((d) => d.x), y: resp.map((d) => d.y), text: resp.map((d) => d.p),
        marker: { size: 4.5, color: compColor('E'), opacity: 0.8, line: { width: 0 } },
        hovertemplate: `<b>%{text}</b><br>${xTitle} %{x:.4f}<br>${yTitle} %{y:.4f}<extra></extra>`,
        showlegend: false,
      },
      {
        type: 'scatter', mode: 'markers+text',
        x: lab.map((d) => d.x), y: lab.map((d) => d.y), text: lab.map((d) => d.p),
        textposition: 'middle right', textfont: { size: 10, color: '#111' },
        marker: { size: 6, color: '#111' },
        hoverinfo: 'skip', showlegend: false,
      },
    ];
    if (find) {
      const hit = pts.find((d) => d.p === find);
      if (hit) {
        traces.push({
          type: 'scatter', mode: 'markers+text',
          x: [hit.x], y: [hit.y], text: [find], textposition: 'top center',
          textfont: { size: 12, color: '#B00' },
          marker: { size: 13, color: 'rgba(0,0,0,0)', line: { color: '#B00', width: 2 } },
          hoverinfo: 'skip', showlegend: false,
        });
      }
    }
    return (
      <PlotPanel
        data={traces}
        height={360}
        layout={{
          title: { text: title, font: { size: 13 } },
          xaxis: { title: xTitle },
          yaxis: { title: yTitle },
          margin: { l: 80, r: 30, t: 45, b: 55 },
          shapes: [{
            type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: THR, y1: THR,
            line: { color: '#666', width: 1, dash: 'dot' },
          }],
          annotations: [
            {
              xref: 'paper', x: 0.99, yref: 'y', y: THR, yanchor: 'bottom', xanchor: 'right',
              text: 'exposure-responsive: ≥ 1% of variance', showarrow: false,
              font: { size: 10, color: '#666' },
            },
            {
              xref: 'paper', x: 0.99, yref: 'paper', y: 0.9, xanchor: 'right',
              text: `<b>${nResp.toLocaleString()} exposure-responsive</b>`, showarrow: false,
              font: { size: 12, color: compColor('E') },
            },
          ],
        }}
      />
    );
  };

  return (
    <SectionCard
      title="The exposure-responsive spectrum"
      subtitle={
        'Each protein placed by its genetic contribution against its exposomic one. Green marks '
        + 'the proteins whose exposomic component reaches 1% of variance. Two independent '
        + 'methods, shown separately so their agreement stays visible.'
      }
      loading={loading}
      error={error}
    >
      {prot && gm && heap && greml && specs.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'flex-end', mb: 1.5 }}>
            <Box sx={{ minWidth: 260, flex: '1 1 260px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Specification — HEAP panel only
              </Typography>
              <Autocomplete
                size="small" disableClearable options={specs.map((x) => x.id)} value={exp}
                onChange={(_, v2) => v2 && setExp(v2)}
                getOptionLabel={(o) => specLabel(specById.get(o))}
                renderInput={(p) => <TextField {...p} />}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Proteins shown
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={scope} onChange={(_, x) => x && setScope(x)}>
                <ToggleButton value="greml" sx={{ textTransform: 'none' }}>
                  {`GREML-comparable (${gm.proteins.length.toLocaleString()})`}
                </ToggleButton>
                <ToggleButton value="all" sx={{ textTransform: 'none' }}>
                  {`all (${prot.proteins.length.toLocaleString()})`}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ minWidth: 220, flex: '1 1 220px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Find a protein in both panels
              </Typography>
              <Autocomplete
                size="small" options={gm.proteins} value={find}
                onChange={(_, x) => setFind(x)}
                renderInput={(p) => <TextField {...p} placeholder="e.g. LEP" />}
              />
            </Box>
          </Box>

          {exp === 'M1_base_lasso' && scope === 'greml' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              This is the published view: {heap.nResp} exposure-responsive proteins by HEAP and{' '}
              {greml.nResp} by GREML, over the same {greml.n.toLocaleString()} proteins — the counts
              printed in Figure 1b.
            </Alert>
          )}

          {panel(heap.pts, heap.labels, 'HEAP — cross-validated prediction R²',
            'PGS predictive R²', 'PXS predictive R²', heap.nResp)}

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, mb: 0.5 }}>
            <Chip size="small" variant="outlined" label="base specification only" />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              GREML was fitted once, multi-kernel, at GRM cutoff 0.025 — the specification picker
              above does not move this panel.
            </Typography>
          </Box>
          {panel(greml.pts, heap.labels, 'GREML — variance components',
            'genetics: SNP-h²', 'exposome: σ²E', greml.nResp)}

          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5, maxWidth: 900 }}>
            The same {N_LABEL} proteins are labeled in both panels — the strongest exposomic signal
            under the specification on screen — so a protein can be followed from one method to the
            other. The two disagree on the absolute count, which is expected: they estimate the
            same component by different means, and the argument rests on them selecting overlapping
            proteins rather than identical numbers.
          </Typography>
        </>
      )}
    </SectionCard>
  );
}
