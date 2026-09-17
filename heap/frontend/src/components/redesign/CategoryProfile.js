import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { ecatColor } from '../../lib/palette';
import { useSection } from '../../lib/useSection';
import { catProteinIndex, specLabel, specList } from '../../lib/varcomp';

// ---------------------------------------------------------------------------
// LIFESTYLE CATEGORIES, second view -- "do the categories reach the SAME
// proteins, or different ones?"
//
// The ranked bars answer how widely each category reaches. They cannot answer
// whether thirteen categories are thirteen different signals or one signal
// counted thirteen times -- and that distinction decides whether the exposome is
// a broad instrument or a redundant one.
//
// Two readings of the same question:
//
//   BREADTH  for each protein, how many of the 13 categories explain it at or
//            above the threshold. A proteome where most proteins answer to one
//            category is modular; one where most answer to many is diffuse.
//
//   PROFILE  for one protein, which categories those are. This is where a
//            reader goes after finding their protein anywhere else on the site.
// ---------------------------------------------------------------------------

const THRESHOLDS = [0.0025, 0.005, 0.0075, 0.01, 0.02];
const prettyCat = (c) => String(c).replace(/_/g, ' ');

export default function CategoryProfile() {
  const vc = useSection('varcat_protein');
  const mt = useSection('varcomp_specs_meta');
  const loading = vc.loading || mt.loading;
  const error = vc.error || mt.error;
  const [exp, setExp] = useState('M1_base_lasso');
  const [thr, setThr] = useState(0.0025);
  const [mode, setMode] = useState('breadth');
  const [protein, setProtein] = useState(null);

  const specs = useMemo(() => specList(mt.data), [mt.data]);
  const specById = useMemo(() => new Map(specs.map((x) => [x.id, x])), [specs]);
  const cats = useMemo(() => catProteinIndex(vc.data), [vc.data]);

  // How many categories reach each protein.
  const breadth = useMemo(() => {
    if (!cats) return null;
    const counts = new Array(cats.proteins.length).fill(0);
    cats.categories.forEach((c) => {
      const arr = cats.bySpec[exp]?.[c];
      if (!arr) return;
      for (let i = 0; i < arr.length; i += 1) {
        if (arr[i] != null && arr[i] >= thr) counts[i] += 1;
      }
    });
    const hist = new Array(cats.categories.length + 1).fill(0);
    counts.forEach((n) => { hist[n] += 1; });
    // The zero bar is left OFF the chart and reported as a number instead. At
    // the lowest threshold 1,605 of 2,686 proteins are reached by no single
    // category, so plotting it makes one bar 60% of the figure and flattens the
    // shape the chart exists to show. The count is on a chip and in the caption,
    // so it is stated rather than hidden -- and it is not a gap in the data: a
    // category is a SUBSET of the exposome, so a protein the exposome reaches as
    // a whole can still be reached by no category on its own.
    return { counts, hist, touched: counts.filter((n) => n > 0).length };
  }, [cats, exp, thr]);

  const profile = useMemo(() => {
    if (!cats || !protein) return null;
    const i = cats.index.get(protein);
    if (i === undefined) return null;
    const rows = cats.categories
      .map((c) => ({ cat: c, r2: cats.bySpec[exp]?.[c]?.[i] }))
      .filter((r) => r.r2 != null && r.r2 > 0)
      .sort((a, b) => a.r2 - b.r2);
    if (!rows.length) return { empty: true };
    return {
      trace: [{
        type: 'bar',
        orientation: 'h',
        x: rows.map((r) => r.r2),
        y: rows.map((r) => prettyCat(r.cat)),
        marker: { color: rows.map((r) => ecatColor(r.cat)) },
        hovertemplate: '%{y}: R² %{x:.4f}<extra></extra>',
      }],
      n: rows.length,
    };
  }, [cats, protein, exp]);

  return (
    <SectionCard
      title="Do the categories reach the same proteins, or different ones?"
      subtitle={
        'Thirteen categories could be thirteen signals or one signal counted thirteen times. '
        + 'Breadth counts how many categories reach each protein; profile shows which ones '
        + 'reach a protein you choose.'
      }
      loading={loading}
      error={error}
    >
      {cats && breadth && specs.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
            <Box sx={{ minWidth: 260, flex: '1 1 260px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Specification
              </Typography>
              <Autocomplete
                size="small" disableClearable options={specs.map((x) => x.id)} value={exp}
                onChange={(_, v) => v && setExp(v)}
                getOptionLabel={(o) => specLabel(specById.get(o))}
                renderInput={(p) => <TextField {...p} />}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Counting a category as reaching a protein at R² ≥
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={thr} onChange={(_, v) => v && setThr(v)}>
                {THRESHOLDS.map((v) => (
                  <ToggleButton key={v} value={v} sx={{ textTransform: 'none' }}>{v}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                View
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)}>
                <ToggleButton value="breadth" sx={{ textTransform: 'none' }}>breadth</ToggleButton>
                <ToggleButton value="profile" sx={{ textTransform: 'none' }}>one protein</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {mode === 'breadth' && (
            <>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <Chip size="small" variant="outlined"
                      label={`${breadth.touched.toLocaleString()} of ${cats.proteins.length.toLocaleString()} proteins reached by at least one category`} />
                <Chip size="small" variant="outlined"
                      label={`${breadth.hist[0].toLocaleString()} reached by none`} />
              </Box>
              <PlotPanel
                data={[{
                  type: 'bar',
                  x: breadth.hist.map((_, i) => i),
                  y: breadth.hist,
                  marker: { color: '#1B6CA8' },
                  hovertemplate: '%{y} proteins reached by %{x} categories<extra></extra>',
                }]}
                height={340}
                layout={{
                  xaxis: { title: 'number of exposure categories reaching the protein', dtick: 1 },
                  yaxis: { title: 'proteins' },
                  margin: { l: 80, r: 20, t: 20, b: 60 },
                  showlegend: false,
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1, maxWidth: 900 }}>
                Proteins reached by no category at all are counted on the chip above rather than
                drawn, because that bar is large enough to flatten the rest — and a category is a
                subset of the exposome, so a protein the full exposome reaches can still be reached
                by no single category. Among the rest: a distribution concentrated at one or two
                categories is modular, different exposures marking different proteins. One pushed
                to the right is diffuse, and would mean the categories largely re-measure a shared
                signal rather than contributing independent information.
              </Typography>
            </>
          )}

          {mode === 'profile' && (
            <>
              <Box sx={{ maxWidth: 620, mb: 1.5 }}>
                <Autocomplete
                  size="small" options={cats.proteins} value={protein}
                  onChange={(_, v) => setProtein(v)}
                  renderInput={(p) => <TextField {...p} placeholder="Search a protein — e.g. LEP, CRP" />}
                />
              </Box>
              {profile && !profile.empty && (
                <PlotPanel
                  data={profile.trace}
                  height={Math.max(220, 26 * profile.n + 90)}
                  layout={{
                    xaxis: { title: 'variance explained (R²)' },
                    yaxis: { automargin: true },
                    margin: { l: 190, r: 30, t: 20, b: 55 },
                    showlegend: false,
                  }}
                />
              )}
              {profile && profile.empty && (
                <Alert severity="info">
                  No exposure category explains any measurable variance in {protein} under this
                  specification. That is a result about the protein, not a gap in the data.
                </Alert>
              )}
              {!protein && (
                <Alert severity="info">Pick a protein to see which categories mark it.</Alert>
              )}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}
