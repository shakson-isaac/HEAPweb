import React, { useMemo, useState } from 'react';
import { Box, Chip, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import PlotPanel from '../PlotPanel';
import { useShard } from '../../lib/useSection';
import { prettyTissue } from '../../lib/tissueBodyMap';

// Where one protein is expressed, across the 54 GTEx tissues.
//
// The version this replaces drew all 54 as a lollipop column on a log axis. For
// ITGA11, 47 of them sit below a tenth of the maximum, so five sixths of the
// chart was an indistinguishable tail -- and artery aorta, the tissue the reader
// had just clicked, was rank 1 of 54 and the chart said so nowhere.
//
// So: state the rank in words, chart the ten that carry signal, and let the tail
// be a counted line rather than 47 rows. The full list is one toggle away, and
// is still worth having -- it is only a bad DEFAULT.
const BLUE = '#0072B2';
const ACCENT = '#D55E00';
const TOP_N = 10;

export default function GtexProfile({ gene, tissue }) {
  const { data, loading, error } = useShard('protein_tissue_profile', gene);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    if (!data?.tissue) return null;
    const out = data.tissue.map((t, i) => ({
      tissue: t,
      label: prettyTissue(t),
      tpm: Number(data.median_tpm[i]) || 0,
      n: Number(data.n_samples[i]) || 0,
      frac: Number(data.frac_of_max[i]) || 0,
      here: t === tissue,
    }));
    out.sort((a, b) => b.tpm - a.tpm);
    return out;
  }, [data, tissue]);

  if (loading) return <Typography variant="body2">Loading expression…</Typography>;
  if (error) return <Typography variant="body2" color="error">{String(error)}</Typography>;
  if (!rows?.length) return null;

  const here = rows.find((r) => r.here);
  const rank = rows.findIndex((r) => r.here) + 1;
  const tail = rows.filter((r) => r.frac < 0.1).length;
  const shown = showAll ? rows : rows.slice(0, TOP_N);
  const tau = data.tau ? Number(data.tau[0]) : null;

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {here
          ? `${prettyTissue(tissue)} is rank ${rank} of ${rows.length} for ${gene}`
          : `Where ${gene} is expressed`}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, my: 1, flexWrap: 'wrap' }}>
        {here && <Chip size="small" label={`${here.tpm.toFixed(1)} median TPM`} />}
        {here && <Chip size="small" label={`${here.n} donors`} />}
        <Chip size="small" variant="outlined"
              label={`${tail} of ${rows.length} tissues below 10% of the max`} />
        {tau != null && (
          <Chip size="small" variant="outlined" label={`tissue specificity τ = ${tau.toFixed(2)}`} />
        )}
      </Box>
      <PlotPanel
        data={[{
          type: 'bar',
          orientation: 'h',
          x: shown.map((r) => r.tpm).reverse(),
          y: shown.map((r) => r.label).reverse(),
          marker: { color: shown.map((r) => (r.here ? ACCENT : BLUE)).reverse() },
          hovertemplate: '%{y}<br>%{x:.2f} median TPM<extra></extra>',
        }]}
        layout={{
          height: 46 + shown.length * 26,
          margin: { l: 210, r: 30, t: 8, b: 46 },
          xaxis: { title: 'GTEx median TPM' },
          yaxis: { automargin: true },
        }}
      />
      <ToggleButtonGroup size="small" exclusive value={showAll}
                         onChange={(_, v) => v !== null && setShowAll(v)}>
        <ToggleButton value={false} sx={{ textTransform: 'none' }}>{`Top ${TOP_N}`}</ToggleButton>
        <ToggleButton value={true} sx={{ textTransform: 'none' }}>{`All ${rows.length}`}</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
