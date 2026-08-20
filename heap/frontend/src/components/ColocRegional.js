import React, { useMemo } from 'react';
import { Alert, Box, Chip, Link, Typography } from '@mui/material';
import PlotPanel from './PlotPanel';
import { useKeys, useShard } from '../lib/useSection';

// ---------------------------------------------------------------------------
// The regional colocalization plot: the picture behind PP.H4.
//
// A posterior of 0.998 asks to be taken on trust. This shows the reason for it
// -- the cis-pQTL association and the disease association rising over the same
// variants in the same window -- so a reader can judge whether one shared signal
// is the honest reading, or whether two distinct peaks are being averaged.
//
// Three views of one window:
//   * two stacked tracks, pQTL above and disease below, sharing an x axis
//   * a scatter of the two -log10 p values, where colocalization looks like a
//     diagonal and PP.H3 (distinct variants) looks like an L
//
// Data is the harmonized SNP table that coloc.abf itself consumed
// (run_coloc_locus.R), never an external API: a different variant set would
// disagree with the posterior we publish, and we could not explain the gap.
// ---------------------------------------------------------------------------

const PQTL_COL = '#2C7FB8';
const DZ_COL = '#B0653C';
const LEAD_COL = '#D32F2F';

export default function ColocRegional({ locusId, protein, target, pph4, pph3 }) {
  const { data: keyIndex } = useKeys('mr_coloc_locus');
  const available = !!(keyIndex && keyIndex.keys && locusId in keyIndex.keys);
  const { data, loading, error } = useShard('mr_coloc_locus', available ? locusId : null);

  const pts = useMemo(() => {
    if (!data?.pos) return null;
    const n = data.pos.length;
    const pos = []; const pq = []; const dz = []; const snp = [];
    let lead = null;
    for (let i = 0; i < n; i += 1) {
      const mb = Number(data.pos[i]) / 1e6;
      pos.push(mb);
      pq.push(data.mlog10p_pqtl[i] === '' ? null : Number(data.mlog10p_pqtl[i]));
      dz.push(data.mlog10p_disease[i] === '' ? null : Number(data.mlog10p_disease[i]));
      snp.push(data.snp[i]);
      const isLead = data.is_lead[i] === true || data.is_lead[i] === 'TRUE';
      if (isLead) lead = { mb, snp: data.snp[i], pq: Number(data.mlog10p_pqtl[i]),
                           dz: Number(data.mlog10p_disease[i]) };
    }
    return { pos, pq, dz, snp, lead, chr: data.chr?.[0] };
  }, [data]);

  if (!available) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No per-variant data retained for this locus, so the regional plot cannot
        be drawn yet — only the posterior above. The colocalization pipeline
        writes the harmonized SNP table it used, but it was kept for one locus
        only; re-running it over the manifest fills in the rest.
      </Alert>
    );
  }
  if (loading) return <Typography variant="body2" sx={{ mt: 2 }}>Loading variants…</Typography>;
  if (error) return <Typography variant="body2" color="error">{String(error)}</Typography>;
  if (!pts) return null;

  const track = (y, name, color) => ({
    type: 'scattergl',
    mode: 'markers',
    name,
    x: pts.pos,
    y,
    text: pts.snp,
    hovertemplate: `<b>%{text}</b><br>${name} −log10 p %{y:.2f}`
      + '<br>chr' + pts.chr + ':%{x:.3f} Mb<extra></extra>',
    marker: { size: 5, color, opacity: 0.7 },
  });

  const leadMark = (yVal) => (pts.lead ? [{
    type: 'scattergl',
    mode: 'markers',
    name: 'lead',
    x: [pts.lead.mb],
    y: [yVal],
    text: [pts.lead.snp],
    hovertemplate: '<b>%{text}</b> (lead)<extra></extra>',
    marker: { size: 12, color: LEAD_COL, symbol: 'diamond',
              line: { width: 1, color: '#fff' } },
    showlegend: false,
  }] : []);

  const finngenUrl = `https://results.finngen.fi/variant/${
    pts.lead ? `${pts.chr}-${Math.round(pts.lead.mb * 1e6)}` : ''}`;

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {protein} × {String(target).replace(/^finngen_R12_/, '')}
        </Typography>
        {pph4 != null && (
          <Chip size="small" color={Number(pph4) >= 0.8 ? 'success' : 'default'}
                label={`PP.H4 ${Number(pph4).toFixed(3)}`} />
        )}
        {pph3 != null && (
          <Chip size="small" variant="outlined"
                label={`PP.H3 ${Number(pph3).toFixed(3)}`} />
        )}
        {pts.lead && <Chip size="small" variant="outlined" label={`lead ${pts.lead.snp}`} />}
        <Chip size="small" variant="outlined" label={`${pts.pos.length.toLocaleString()} variants`} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 420px', minWidth: 0 }}>
          <PlotPanel
            data={[
              { ...track(pts.pq, 'cis-pQTL', PQTL_COL), yaxis: 'y' },
              ...leadMark(pts.lead?.pq).map((t) => ({ ...t, yaxis: 'y' })),
              { ...track(pts.dz, 'disease', DZ_COL), yaxis: 'y2' },
              ...leadMark(pts.lead?.dz).map((t) => ({ ...t, yaxis: 'y2' })),
            ]}
            height={430}
            layout={{
              // Stacked tracks sharing x: the classic locuszoom read, where a
              // shared signal is two peaks at the same position.
              grid: { rows: 2, columns: 1, pattern: 'coupled' },
              xaxis: { title: `chr${pts.chr} position (Mb)` },
              yaxis: { title: 'pQTL −log10 p', domain: [0.56, 1] },
              yaxis2: { title: 'disease −log10 p', domain: [0, 0.44], autorange: 'reversed' },
              showlegend: false,
              title: { text: 'Same window, both signals', font: { size: 13 } },
            }}
          />
        </Box>
        <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
          <PlotPanel
            data={[{
              type: 'scattergl',
              mode: 'markers',
              x: pts.pq,
              y: pts.dz,
              text: pts.snp,
              hovertemplate: '<b>%{text}</b><br>pQTL %{x:.2f}<br>disease %{y:.2f}<extra></extra>',
              marker: { size: 5, color: '#78909C', opacity: 0.6 },
            }, ...(pts.lead ? [{
              type: 'scattergl',
              mode: 'markers',
              x: [pts.lead.pq],
              y: [pts.lead.dz],
              text: [pts.lead.snp],
              hovertemplate: '<b>%{text}</b> (lead)<extra></extra>',
              marker: { size: 12, color: LEAD_COL, symbol: 'diamond',
                        line: { width: 1, color: '#fff' } },
            }] : [])]}
            height={430}
            layout={{
              xaxis: { title: 'pQTL −log10 p' },
              yaxis: { title: 'disease −log10 p' },
              showlegend: false,
              title: { text: 'One signal or two?', font: { size: 13 } },
            }}
          />
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Variants are the harmonized set colocalization actually used, so the plot
        and the posterior above describe the same data. On the right, a diagonal
        cloud means the two signals rise together over the same variants (one
        shared causal variant, PP.H4); an L-shape means each trait peaks at
        variants the other does not (two distinct variants in LD, PP.H3).
        {' '}
        {pts.lead && (
          <Link href={finngenUrl} target="_blank" rel="noopener noreferrer">
            View {pts.lead.snp} in FinnGen
          </Link>
        )}
      </Typography>
    </Box>
  );
}
