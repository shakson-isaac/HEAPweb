import React, { useMemo } from 'react';
import { Alert, Box, Chip, Link, Typography } from '@mui/material';
import PlotPanel from './PlotPanel';
import { useKeys, useSection, useShard } from '../lib/useSection';

// ---------------------------------------------------------------------------
// Interactive regional colocalization plot -- the picture behind PP.H4.
//
// A posterior of 0.998 asks to be taken on trust. This shows the reason for it:
// the cis-pQTL and the disease association over the same window, each variant
// coloured by its LD to the lead. The LD is the part that carries the argument.
// One shared causal variant (PP.H4) looks like a red high-r2 cluster peaking
// together on both tracks; two distinct variants in LD (PP.H3) looks like each
// trait peaking on variants the other does not.
//
// The web counterpart of ModuleMR/COLOC/LocusZoom.R, and coloured from the same
// PLINK/1000G-EUR r2 that script computes, so the site and the print figure
// agree. Gene track from EnsDb.Hsapiens.v86, same as the figure.
//
// Variants are the harmonized set coloc.abf itself consumed, never an external
// API: a different variant set would disagree with the posterior we publish.
// ---------------------------------------------------------------------------

// locuszoomr's LD bins, so the legend reads the same as the paper's.
const LD_BINS = [
  { min: 0.8, color: '#E4211C', label: '0.8 – 1.0' },
  { min: 0.6, color: '#F7A83E', label: '0.6 – 0.8' },
  { min: 0.4, color: '#8FD14F', label: '0.4 – 0.6' },
  { min: 0.2, color: '#3FC0C6', label: '0.2 – 0.4' },
  { min: -1, color: '#3B65AE', label: '< 0.2' },
];
const ldColor = (r2) => (r2 == null || Number.isNaN(r2)
  ? '#BDBDBD'
  : (LD_BINS.find((b) => r2 >= b.min) || LD_BINS[LD_BINS.length - 1]).color);

const GW = -Math.log10(5e-8);

export default function ColocRegional({ locusId, protein, target, pph4, pph3 }) {
  const { data: keyIndex } = useKeys('mr_coloc_locus');
  const available = !!(keyIndex && keyIndex.keys && locusId in keyIndex.keys);
  const { data, loading, error } = useShard('mr_coloc_locus', available ? locusId : null);
  const { data: genes } = useShard('mr_coloc_genes', available ? locusId : null);
  const { data: meta } = useSection('mr_coloc_locus_meta');

  // r2 is to the lead variant unless the lead is missing from the 1000G panel,
  // in which case LD is anchored on the strongest in-panel variant. Saying so
  // matters: an unlabelled proxy makes the colours mean something subtly other
  // than what a reader assumes.
  const anchorInfo = useMemo(() => {
    if (!meta?.locus_id || !locusId) return null;
    const i = meta.locus_id.indexOf(locusId);
    if (i < 0) return null;
    const isLead = meta.anchor_is_lead[i] === true
      || meta.anchor_is_lead[i] === 'TRUE' || meta.anchor_is_lead[i] === 'True';
    return { lead: meta.lead[i], anchor: meta.anchor[i], isLead };
  }, [meta, locusId]);

  const pts = useMemo(() => {
    if (!data?.pos) return null;
    const n = data.pos.length;
    const out = {
      mb: new Array(n), pq: new Array(n), dz: new Array(n),
      r2: new Array(n), snp: new Array(n), color: new Array(n),
    };
    let lead = null;
    for (let i = 0; i < n; i += 1) {
      const mb = Number(data.pos[i]) / 1e6;
      const r2 = data.r2[i] === '' || data.r2[i] == null ? null : Number(data.r2[i]);
      const pq = data.mlog10p_pqtl[i] === '' ? null : Number(data.mlog10p_pqtl[i]);
      const dz = data.mlog10p_disease[i] === '' ? null : Number(data.mlog10p_disease[i]);
      out.mb[i] = mb; out.pq[i] = pq; out.dz[i] = dz;
      out.r2[i] = r2; out.snp[i] = data.snp[i]; out.color[i] = ldColor(r2);
      // r2 == 1 against itself identifies the LD anchor, which is the lead
      // variant unless a proxy was used.
      if (r2 != null && r2 >= 0.9999 && (lead == null || (pq ?? 0) > (lead.pq ?? 0))) {
        lead = { mb, snp: data.snp[i], pq, dz };
      }
    }
    return { ...out, lead, chr: data.chr?.[0], n };
  }, [data]);

  const geneTrack = useMemo(() => {
    if (!genes?.gene) return [];
    return genes.gene.map((g, i) => ({
      gene: g,
      start: Number(genes.start[i]) / 1e6,
      end: Number(genes.end[i]) / 1e6,
      strand: genes.strand[i],
    })).sort((a, b) => a.start - b.start);
  }, [genes]);

  if (!available) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No per-variant data retained for this locus yet, so only the posterior
        above can be shown. The pipeline writes the harmonized variant table it
        used, but it was kept for one locus only; the rerun fills in the rest.
      </Alert>
    );
  }
  if (loading) return <Typography variant="body2" sx={{ mt: 2 }}>Loading variants…</Typography>;
  if (error) return <Typography variant="body2" color="error">{String(error)}</Typography>;
  if (!pts) return null;

  const hover = (which) => (
    '<b>%{text}</b><br>' + which + ' −log10 p %{y:.2f}'
    + '<br>r² %{customdata:.2f}<br>chr' + pts.chr + ':%{x:.3f} Mb<extra></extra>'
  );

  const track = (y, which, axis) => ([{
    type: 'scattergl',
    mode: 'markers',
    x: pts.mb,
    y,
    text: pts.snp,
    customdata: pts.r2,
    hovertemplate: hover(which),
    marker: { size: 6, color: pts.color, opacity: 0.85,
              line: { width: 0.4, color: 'rgba(0,0,0,0.25)' } },
    yaxis: axis,
    showlegend: false,
  }, ...(pts.lead ? [{
    type: 'scattergl',
    mode: 'markers',
    x: [pts.lead.mb],
    y: [which === 'pQTL' ? pts.lead.pq : pts.lead.dz],
    text: [pts.lead.snp],
    hovertemplate: '<b>%{text}</b> (lead)<extra></extra>',
    marker: { size: 13, color: '#E4211C', symbol: 'diamond',
              line: { width: 1.2, color: '#000' } },
    yaxis: axis,
    showlegend: false,
  }] : [])]);

  // Genes are laid out on stacked rows so overlapping ones stay readable, the
  // way the figure's gene track does.
  const geneShapes = []; const geneLabels = [];
  const rowEnds = [];
  geneTrack.forEach((g) => {
    let row = rowEnds.findIndex((e) => g.start > e + 0.012);
    if (row === -1) { rowEnds.push(g.end); row = rowEnds.length - 1; } else rowEnds[row] = g.end;
    const y = -(row + 1);
    geneShapes.push({
      type: 'line', xref: 'x', yref: 'y3',
      x0: g.start, x1: g.end, y0: y, y1: y,
      line: { width: 3, color: '#3B4A6B' },
    });
    geneLabels.push({
      xref: 'x', yref: 'y3', x: (g.start + g.end) / 2, y: y,
      text: g.strand === '-' ? `←${g.gene}` : `${g.gene}→`,
      showarrow: false, yshift: 9, font: { size: 8, color: '#3B4A6B' },
    });
  });
  const geneRows = Math.max(1, rowEnds.length);

  const finngenUrl = pts.lead
    ? `https://results.finngen.fi/variant/${pts.chr}-${Math.round(pts.lead.mb * 1e6)}`
    : null;

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
          <Chip size="small" variant="outlined" label={`PP.H3 ${Number(pph3).toFixed(3)}`} />
        )}
        {anchorInfo && (
          anchorInfo.isLead
            ? <Chip size="small" variant="outlined" label={`lead ${anchorInfo.lead}`} />
            : (
              <Chip
                size="small" color="warning" variant="outlined"
                label={`lead ${anchorInfo.lead} · LD via proxy ${anchorInfo.anchor}`}
              />
            )
        )}
        {!anchorInfo && pts.lead && (
          <Chip size="small" variant="outlined" label={`lead ${pts.lead.snp}`} />
        )}
        <Chip size="small" variant="outlined" label={`${pts.n.toLocaleString()} variants`} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 460px', minWidth: 0 }}>
          <PlotPanel
            data={[...track(pts.pq, 'pQTL', 'y'), ...track(pts.dz, 'disease', 'y2')]}
            height={520}
            layout={{
              // Three stacked panels sharing x: pQTL, disease, genes.
              xaxis: { title: `chr${pts.chr} position (Mb)`, anchor: 'y3' },
              yaxis: { title: 'pQTL −log10 p', domain: [0.60, 1] },
              yaxis2: { title: 'disease −log10 p', domain: [0.24, 0.56] },
              yaxis3: {
                domain: [0, 0.20], showticklabels: false, zeroline: false,
                showgrid: false, range: [-(geneRows + 0.6), -0.4], fixedrange: true,
              },
              shapes: [
                ...geneShapes,
                { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: GW, y1: GW,
                  line: { dash: 'dot', width: 1, color: '#999' } },
                { type: 'line', xref: 'paper', yref: 'y2', x0: 0, x1: 1, y0: GW, y1: GW,
                  line: { dash: 'dot', width: 1, color: '#999' } },
              ],
              annotations: geneLabels,
              showlegend: false,
              margin: { l: 60, r: 12, t: 30, b: 45 },
              title: { text: 'Same window, both signals, coloured by LD',
                       font: { size: 13 } },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center',
                     mt: 0.5, pl: 1 }}>
            <Box sx={{ fontSize: 11, color: 'text.secondary' }}>LD r² to lead:</Box>
            {LD_BINS.map((b) => (
              <Box key={b.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 11, height: 11, borderRadius: '2px', bgcolor: b.color }} />
                <Box sx={{ fontSize: 11 }}>{b.label}</Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <PlotPanel
            data={[{
              type: 'scattergl',
              mode: 'markers',
              x: pts.pq,
              y: pts.dz,
              text: pts.snp,
              customdata: pts.r2,
              hovertemplate: '<b>%{text}</b><br>pQTL %{x:.2f}<br>disease %{y:.2f}'
                + '<br>r² %{customdata:.2f}<extra></extra>',
              marker: { size: 6, color: pts.color, opacity: 0.8 },
            }, ...(pts.lead ? [{
              type: 'scattergl',
              mode: 'markers',
              x: [pts.lead.pq],
              y: [pts.lead.dz],
              text: [pts.lead.snp],
              hovertemplate: '<b>%{text}</b> (lead)<extra></extra>',
              marker: { size: 13, color: '#E4211C', symbol: 'diamond',
                        line: { width: 1.2, color: '#000' } },
            }] : [])]}
            height={520}
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
        and the posterior describe the same data; r² is to the lead variant in the
        1000 Genomes European panel{anchorInfo && !anchorInfo.isLead
          ? `, anchored on ${anchorInfo.anchor} because the lead variant `
            + `${anchorInfo.lead} is not in that panel`
          : ''}. On the right, red points climbing together
        means one shared causal variant (PP.H4); red points high on one axis and
        flat on the other means two distinct variants in LD (PP.H3).
        {' '}
        {finngenUrl && (
          <Link href={finngenUrl} target="_blank" rel="noopener noreferrer">
            View {pts.lead.snp} in FinnGen
          </Link>
        )}
      </Typography>
    </Box>
  );
}
