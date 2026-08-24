import React, { useMemo, useState } from 'react';
import {
  Autocomplete, Box, Chip, Slider, TextField, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import ColumnarTable from '../ColumnarTable';
import { ecatColor } from '../../lib/palette';
import { useSection } from '../../lib/useSection';
import { catProteinIndex, catReachIndex, specLabel, specList } from '../../lib/varcomp';

// ---------------------------------------------------------------------------
// LIFESTYLE CATEGORIES -- "which parts of life leave the widest mark?"
//
// Five sections became one ranked chart. For each of the 13 exposure categories,
// the bar is the number of proteins whose variance that category explains at or
// above the threshold. Sorted, so the ranking IS the finding, and coloured with
// the same palette as the manuscript figures.
//
// The threshold is a control rather than a constant because the ranking is not
// threshold-invariant: a category that touches many proteins weakly and one that
// touches few proteins strongly swap places as the bar rises, and that crossover
// is the interesting part. Fixing it at one value would hide it.
//
// Clicking a bar lists that category's proteins, so the chart is an entry point
// rather than a terminus.
// ---------------------------------------------------------------------------

const prettyCat = (c) => String(c).replace(/_/g, ' ');

export default function CategoryReach() {
  const vr = useSection('varcat_reach');
  const vc = useSection('varcat_protein');
  const mt = useSection('varcomp_specs_meta');
  const loading = vr.loading || vc.loading || mt.loading;
  const error = vr.error || vc.error || mt.error;
  const [exp, setExp] = useState('M1_base_lasso');
  // Opens at the lowest threshold on purpose: at R2 >= 0.01 only 7 of the 13
  // categories have any protein at all, so a higher default would open on a
  // chart that is mostly empty bars and read as missing data.
  const [thrIdx, setThrIdx] = useState(0);
  const [picked, setPicked] = useState(null);

  const specs = useMemo(() => specList(mt.data), [mt.data]);
  const specById = useMemo(() => new Map(specs.map((x) => [x.id, x])), [specs]);
  const reach = useMemo(() => catReachIndex(vr.data), [vr.data]);
  const cats = useMemo(() => catProteinIndex(vc.data), [vc.data]);

  // A few round thresholds rather than the full grid -- the slider is for
  // exploring the crossover, not for precision.
  const THRESHOLDS = [0.0025, 0.005, 0.0075, 0.01, 0.02, 0.03, 0.05, 0.1];
  const thr = THRESHOLDS[thrIdx];
  const bars = useMemo(() => {
    const byCat = reach[exp];
    if (!byCat || !cats) return null;
    const at = (c) => {
      const g = byCat[c];
      if (!g) return 0;
      const k = g.grid.indexOf(thr);
      return k < 0 ? 0 : g.n[k];
    };
    const rows = cats.categories.map((c) => ({ cat: c, n: at(c) }))
      .sort((a, b) => a.n - b.n);
    return {
      rows,
      trace: [{
        type: 'bar',
        orientation: 'h',
        x: rows.map((r) => r.n),
        y: rows.map((r) => prettyCat(r.cat)),
        marker: { color: rows.map((r) => ecatColor(r.cat)) },
        hovertemplate: '<b>%{y}</b><br>%{x} proteins at or above R² '
          + `${thr}<extra></extra>`,
      }],
    };
  }, [reach, cats, exp, thr]);

  // The proteins behind one bar, strongest first.
  const detail = useMemo(() => {
    if (!cats || !picked) return null;
    const arr = cats.bySpec[exp]?.[picked];
    if (!arr) return null;
    const rows = [];
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] != null && arr[i] >= thr) rows.push({ protein: cats.proteins[i], r2: arr[i] });
    }
    rows.sort((a, b) => b.r2 - a.r2);
    return rows;
  }, [cats, picked, exp, thr]);

  return (
    <SectionCard
      title="Which parts of life leave the widest mark on the proteome?"
      subtitle={
        'Each bar is the number of proteins for which that exposure category explains at '
        + 'least the chosen share of variance. Click a bar to see the proteins behind it.'
      }
      loading={loading}
      error={error}
    >
      {cats && bars && specs.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
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
            <Box sx={{ minWidth: 260, flex: '1 1 260px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                {`Counting proteins at or above R² = ${thr}`}
              </Typography>
              <Slider
                size="small"
                value={thrIdx}
                min={0}
                max={THRESHOLDS.length - 1}
                step={1}
                marks
                onChange={(_, v) => { setThrIdx(v); }}
                valueLabelDisplay="off"
              />
            </Box>
          </Box>

          <PlotPanel
            data={bars.trace}
            height={420}
            onPointClick={(p) => {
              const row = bars.rows[p.pointIndex];
              setPicked(row ? row.cat : null);
            }}
            layout={{
              xaxis: { title: `proteins reaching R² ≥ ${thr}` },
              yaxis: { automargin: true },
              margin: { l: 180, r: 30, t: 20, b: 55 },
              showlegend: false,
            }}
          />

          {picked && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Chip
                  size="small"
                  label={prettyCat(picked)}
                  onDelete={() => setPicked(null)}
                  sx={{ bgcolor: ecatColor(picked), color: 'white', fontWeight: 700 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {`${detail ? detail.length : 0} proteins at or above R² ${thr}, strongest first`}
                </Typography>
              </Box>
              {detail && detail.length > 0 && (
                <ColumnarTable
                  data={{
                    protein: detail.map((r) => r.protein),
                    R2: detail.map((r) => r.r2),
                  }}
                  initialRowsPerPage={10}
                />
              )}
            </Box>
          )}
        </>
      )}
    </SectionCard>
  );
}
