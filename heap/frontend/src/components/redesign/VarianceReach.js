import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { compColor } from '../../lib/palette';
import { useSection } from '../../lib/useSection';
import {
  COMPONENTS, COMPONENT_LABEL, proteinIndex, reachIndex, specLabel, specList,
} from '../../lib/varcomp';

// ---------------------------------------------------------------------------
// MAIN RESULTS -- "how far does each component reach across the proteome?"
//
// The nine sections this replaces each answered a slice of one question with a
// different chart. The question is: for a given share of variance, how many of
// the 2,686 proteins does each component explain at least that much of? That is
// a survival curve, and putting the four components on one pair of axes makes
// the ordering -- covariates, then genetics, then exposome, then GxE -- readable
// in one glance instead of across four charts.
//
// EVERYTHING HERE IS THE UNIQUE DECOMPOSITION -- what each component explains
// that the others do not, so the four are disjoint and directly comparable. The
// deposit also carries nested model totals (C, C+G, C+G+E, ...), and an earlier
// draft offered both behind a toggle. They answer different questions, and one
// control switching between them invited reading a unique share as a model
// total, so the totals are simply not on this chart.
//
// RIDGE IS NOT IN THE PICKER. Without variable selection there is no unique
// contribution to recover: under ridge the genetic component reaches 0 proteins
// at R2 >= 0.01 where lasso reaches 936. That is the estimator being unable to
// answer this question, not a finding about genetics. Elastic net does select
// and is kept. Excluded in the builder, so the data does not carry it either.
// ---------------------------------------------------------------------------



export default function VarianceReach() {
  const rc = useSection('varcomp_reach');
  const pr = useSection('varcomp_protein');
  const mt = useSection('varcomp_specs_meta');
  const loading = rc.loading || pr.loading || mt.loading;
  const error = rc.error || pr.error || mt.error;

  const [exp, setExp] = useState('M1_base_lasso');
  const [protein, setProtein] = useState(null);

  const specs = useMemo(() => specList(mt.data), [mt.data]);
  const specById = useMemo(() => new Map(specs.map((s) => [s.id, s])), [specs]);
  const reach = useMemo(() => reachIndex(rc.data), [rc.data]);
  const prot = useMemo(() => proteinIndex(pr.data), [pr.data]);

  // The reach curves. x is log-scaled: most proteins sit near zero for every
  // component, so a linear axis compresses the entire interesting range into
  // the first tick. The grid's leading 0 is dropped because log has no zero.
  const curves = useMemo(() => {
    const byComp = reach[exp];
    if (!byComp) return [];
    return COMPONENTS.map((c) => {
      const g = byComp[c];
      if (!g) return null;
      // The grid's leading 0 is dropped: a log axis has no zero.
      return {
        type: 'scatter',
        mode: 'lines',
        name: COMPONENT_LABEL[c] || c,
        x: g.grid.slice(1),
        y: g.n.slice(1),
        line: { color: compColor(c), width: 2.5 },
        hovertemplate: `<b>${COMPONENT_LABEL[c] || c}</b><br>` +
          'at least %{x:.3f} of variance<br>%{y} proteins<extra></extra>',
      };
    }).filter(Boolean);
  }, [reach, exp]);

  // One protein's decomposition, with the interval the deposit carries. Every
  // varcomp row has a CI and nothing on the site drew one before this.
  const drill = useMemo(() => {
    if (!prot || !protein) return null;
    const i = prot.index.get(protein);
    if (i === undefined) return null;
    const bs = prot.bySpec[exp];
    if (!bs) return null;
    const rows = COMPONENTS.map((c) => {
      const g = bs[c];
      return g ? { comp: c, r2: g.r2[i], lo: g.lo[i], hi: g.hi[i] } : { comp: c, r2: null };
    }).filter((r) => r.r2 != null);
    if (!rows.length) return null;
    return [{
      type: 'bar',
      orientation: 'h',
      x: rows.map((r) => r.r2),
      y: rows.map((r) => COMPONENT_LABEL[r.comp] || r.comp),
      marker: { color: rows.map((r) => compColor(r.comp)) },
      error_x: rows[0].lo != null ? {
        type: 'data',
        symmetric: false,
        array: rows.map((r) => (r.hi != null ? r.hi - r.r2 : 0)),
        arrayminus: rows.map((r) => (r.lo != null ? r.r2 - r.lo : 0)),
        color: '#555', thickness: 1.2, width: 4,
      } : undefined,
      hovertemplate: '%{y}: R² %{x:.4f}<extra></extra>',
    }];
  }, [prot, protein, exp]);

  const nProt = prot?.proteins?.length || 0;

  return (
    <SectionCard
      title="How far does each component reach across the proteome?"
      subtitle={
        'For a given share of variance on the x axis, the curve gives the number of proteins '
        + 'for which that component explains at least that much. Higher and further right is '
        + 'a component that reaches more of the proteome.'
      }
      loading={loading}
      error={error}
    >
      {prot && specs.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
            <Box sx={{ minWidth: 300, flex: '1 1 300px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Specification
              </Typography>
              <Autocomplete
                size="small"
                disableClearable
                options={specs.map((x) => x.id)}
                value={exp}
                onChange={(_, v) => v && setExp(v)}
                getOptionLabel={(o) => specLabel(specById.get(o))}
                renderInput={(p) => <TextField {...p} />}
              />
            </Box>
            <Chip size="small" variant="outlined" label={`${nProt.toLocaleString()} proteins`} />
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            Each curve is the component&apos;s <b>unique</b> contribution — what it explains that
            the other three do not — so the four are disjoint and can be read against each other
            directly.
          </Alert>

          <PlotPanel
            data={curves}
            height={430}
            layout={{
              xaxis: {
                type: 'log', title: 'variance explained (R², log scale)',
                tickvals: [0.001, 0.003, 0.01, 0.03, 0.1, 0.3],
                ticktext: ['0.001', '0.003', '0.01', '0.03', '0.1', '0.3'],
              },
              yaxis: { title: `proteins reaching it (of ${nProt.toLocaleString()})` },
              legend: { orientation: 'h', y: 1.12, x: 0 },
              margin: { l: 80, r: 20, t: 40, b: 60 },
            }}
          />

          <Box sx={{ mt: 3, maxWidth: 620 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
              One protein&apos;s decomposition, with 95% intervals
            </Typography>
            <Autocomplete
              size="small"
              options={prot.proteins}
              value={protein}
              onChange={(_, v) => setProtein(v)}
              renderInput={(p) => <TextField {...p} placeholder="Search a protein — e.g. LEP, CRP, IGFBP1" />}
            />
          </Box>
          {drill && (
            <PlotPanel
              data={drill}
              height={220}
              layout={{
                xaxis: { title: 'variance explained (R²)' },
                yaxis: { automargin: true },
                margin: { l: 110, r: 30, t: 30, b: 50 },
                showlegend: false,
              }}
            />
          )}
          {protein && !drill && (
            <Alert severity="info" sx={{ mt: 1 }}>
              {protein} has no rows under this specification.
            </Alert>
          )}
        </>
      )}
    </SectionCard>
  );
}
