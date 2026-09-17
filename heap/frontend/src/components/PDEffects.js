import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import Select from 'react-select';
import PlotPanel from './PlotPanel';
import ColumnarTable from './ColumnarTable';
import SectionCard from './SectionCard';
import { useKeys, useShard } from '../lib/useSection';

// ---------------------------------------------------------------------------
// Which diseases can this protein influence -- asked twice, once of the MR and
// once of the observational data, on the same diseases and the same axes.
//
// This replaces a panel titled "Protein -> disease MR priority" that contained
// no MR estimate at all: its columns were protein_HR, protein_p, cox_cindex and
// mediator_adjR2, i.e. Cox survival models from the mediation module. The two
// were never comparable and the title said they were.
//
// Showing both is the point rather than a courtesy. The observational panel
// lights up and the MR panel mostly does not, and that gap IS the paper's
// claim: proteins that track disease are common, proteins that cause it are
// rare. Collapsing to one panel would delete the finding.
//
// Data: mr_pd_effects, built by tools/build_pd_effects.py. cis and trans are
// separate instruments for the same edge and are never pooled here -- Tier 1 is
// cis-only in practice, so which one carried the evidence matters.
// ---------------------------------------------------------------------------

const TIER_COLOR = {
  Tier1plus: '#1A6B30',
  Tier1: '#2E8B4F',
  Tier2: '#2C7FB8',
  Suggestive: '#B0A24A',
  Null: '#B0BEC5',
  '': '#B0BEC5',
};
const TIER_RANK = { Tier1plus: 0, Tier1: 1, Tier2: 2, Suggestive: 3, Null: 4 };

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function PDEffects() {
  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('mr_pd_effects');
  // ADM opens the panel: it carries the strongest cis evidence in the table
  // (two Tier-1 protein->disease edges) alongside 46 observational estimates,
  // so the gap the panel exists to show is visible without hunting for it.
  const [protein, setProtein] = useState('ADM');
  const [inst, setInst] = useState('cis');
  const { data, loading, error } = useShard('mr_pd_effects', protein);

  const options = useMemo(
    () => (keyIndex ? Object.keys(keyIndex.keys).map((k) => ({ value: k, label: k })) : []),
    [keyIndex],
  );

  const rows = useMemo(() => {
    if (!data?.disease) return [];
    const out = [];
    for (let i = 0; i < data.disease.length; i += 1) {
      const b = num(data[`mr_b_${inst}`]?.[i]);
      const padj = num(data[`mr_padj_${inst}`]?.[i]);
      const hr = num(data.obs_HR?.[i]);
      const op = num(data.obs_p?.[i]);
      out.push({
        label: data.disease_label[i],
        icd10: data.icd10?.[i] || '',
        tier: data[`mr_tier_${inst}`]?.[i] || '',
        nsnp: num(data[`mr_nsnp_${inst}`]?.[i]),
        pph4: num(data.coloc_pph4_cis?.[i]),
        mr_b: b,
        mr_y: padj != null && padj > 0 ? -Math.log10(padj) : null,
        // Reported as the hazard ratio itself, not a log transform of it: the
        // interval is what makes an HR readable, and log2(HR) with a
        // back-transformed interval is a number nobody quotes.
        obs_x: hr,
        obs_lo: num(data.obs_HR_l95?.[i]),
        obs_hi: num(data.obs_HR_u95?.[i]),
        obs_y: op != null && op > 0 ? -Math.log10(op) : null,
        n_cases: num(data.n_cases?.[i]),
      });
    }
    return out;
  }, [data, inst]);

  const mrRows = rows.filter((r) => r.mr_b != null && r.mr_y != null);
  const obsRows = rows.filter((r) => r.obs_x != null && r.obs_x > 0 && r.obs_y != null);
  const nMrHit = mrRows.filter((r) => r.tier && r.tier !== 'Null').length;
  // Bonferroni across the diseases actually shown, matching how the observational
  // panel is read in the paper rather than inventing a new threshold here.
  const obsThresh = obsRows.length ? -Math.log10(0.05 / obsRows.length) : null;

  const mrTrace = useMemo(() => {
    const byTier = {};
    mrRows.forEach((r) => { (byTier[r.tier || 'Null'] ||= []).push(r); });
    return Object.entries(byTier)
      .sort((a, b) => (TIER_RANK[b[0]] ?? 9) - (TIER_RANK[a[0]] ?? 9))
      .map(([tier, rs]) => ({
        type: 'scattergl',
        mode: 'markers',
        name: tier,
        x: rs.map((r) => r.mr_b),
        y: rs.map((r) => r.mr_y),
        text: rs.map((r) => r.label),
        customdata: rs.map((r) => [r.nsnp ?? '—', r.pph4 == null ? '—' : r.pph4.toFixed(2)]),
        hovertemplate: '<b>%{text}</b><br>MR β %{x:.3f}<br>−log10 p<sub>adj</sub> %{y:.2f}'
          + '<br>SNPs %{customdata[0]}<br>PP.H4 %{customdata[1]}<extra>' + tier + '</extra>',
        marker: {
          size: tier === 'Null' ? 6 : 10,
          color: TIER_COLOR[tier] || '#B0BEC5',
          line: { width: tier === 'Null' ? 0 : 1, color: '#fff' },
          opacity: tier === 'Null' ? 0.55 : 1,
        },
      }));
  }, [mrRows]);

  const obsTrace = useMemo(() => ([{
    // scatter, not scattergl: only the SVG renderer draws error bars.
    type: 'scatter',
    mode: 'markers',
    name: 'Cox',
    x: obsRows.map((r) => r.obs_x),
    y: obsRows.map((r) => r.obs_y),
    text: obsRows.map((r) => r.label),
    customdata: obsRows.map((r) => [
      r.n_cases ?? '—',
      r.obs_lo == null ? '—' : r.obs_lo.toFixed(2),
      r.obs_hi == null ? '—' : r.obs_hi.toFixed(2),
    ]),
    error_x: {
      type: 'data',
      symmetric: false,
      array: obsRows.map((r) => (r.obs_hi != null ? r.obs_hi - r.obs_x : 0)),
      arrayminus: obsRows.map((r) => (r.obs_lo != null ? r.obs_x - r.obs_lo : 0)),
      thickness: 1,
      width: 0,
      color: 'rgba(120,120,120,0.45)',
    },
    hovertemplate: '<b>%{text}</b><br>HR %{x:.2f} '
      + '(95% CI %{customdata[1]}–%{customdata[2]})<br>−log10 p %{y:.2f}'
      + '<br>%{customdata[0]} cases<extra></extra>',
    marker: {
      size: 7,
      color: obsRows.map((r) => (obsThresh != null && r.obs_y >= obsThresh ? '#B0653C' : '#C9B8A8')),
      line: { width: 0 },
      opacity: 0.9,
    },
  }]), [obsRows, obsThresh]);

  const tableData = useMemo(() => {
    if (!data?.disease) return null;
    const keep = ['disease_label', 'icd10', `mr_b_${inst}`, `mr_se_${inst}`,
      `mr_padj_${inst}`, `mr_tier_${inst}`, `mr_nsnp_${inst}`,
      'coloc_pph4_cis', 'obs_HR', 'obs_HR_l95', 'obs_HR_u95', 'obs_p', 'n_cases'];
    const out = {};
    keep.forEach((k) => { if (data[k]) out[k] = data[k]; });
    return Object.keys(out).length ? out : null;
  }, [data, inst]);

  if (kLoading) return <Typography variant="body2">Loading…</Typography>;
  if (kError) return <Typography variant="body2" color="error">{String(kError)}</Typography>;

  return (
    <SectionCard
      title={<>Protein &rarr; disease: causal estimate beside observational association</>}
      subtitle={
        'The same diseases, plotted twice. Left: the Mendelian randomization estimate, '
        + 'graded by evidence tier. Right: the observational Cox hazard ratio with its '
        + '95% confidence interval. A disease can sit far from 1 on the right and flat on the left — '
        + 'that is a protein that tracks the disease without evidence of causing it.'
      }
    >
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <Box sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 420 }}>
          <Select
            options={options}
            value={{ value: protein, label: protein }}
            onChange={(o) => setProtein(o.value)}
            isSearchable
            placeholder="Search a protein…"
          />
        </Box>
        <ToggleButtonGroup size="small" exclusive value={inst}
          onChange={(_, v) => v && setInst(v)}>
          <ToggleButton value="cis" sx={{ textTransform: 'none', px: 1.5 }}>cis-pQTL</ToggleButton>
          <ToggleButton value="trans" sx={{ textTransform: 'none', px: 1.5 }}>trans-pQTL</ToggleButton>
        </ToggleButtonGroup>
        <Chip size="small" label={`${mrRows.length} MR-tested`} />
        <Chip size="small" color={nMrHit ? 'success' : 'default'}
              label={`${nMrHit} above Null`} />
        <Chip size="small" variant="outlined" label={`${obsRows.length} with Cox estimate`} />
      </Box>

      {loading && <Typography variant="body2">Loading {protein}…</Typography>}
      {error && <Typography variant="body2" color="error">{String(error)}</Typography>}

      {!loading && !mrRows.length && !obsRows.length && (
        <Alert severity="info">
          No protein&rarr;disease estimate for <b>{protein}</b> with{' '}
          {inst}-pQTL instruments.
        </Alert>
      )}

      {(mrRows.length > 0 || obsRows.length > 0) && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 340px', minWidth: 0 }}>
            <PlotPanel
              data={mrTrace}
              height={420}
              layout={{
                xaxis: { title: 'MR β (per SD protein)', zeroline: true, zerolinecolor: '#bbb' },
                yaxis: { title: '−log10 p<sub>adj</sub>' },
                title: { text: `Causal — ${protein} (${inst}-pQTL)`, font: { size: 13 } },
                legend: { orientation: 'h', y: -0.22, font: { size: 10 } },
                showlegend: true,
              }}
            />
          </Box>
          <Box sx={{ flex: '1 1 340px', minWidth: 0 }}>
            <PlotPanel
              data={obsTrace}
              height={420}
              layout={{
                xaxis: { title: 'hazard ratio (95% CI)', zeroline: false },
                yaxis: { title: '−log10 p' },
                title: { text: `Observational — ${protein} (Cox)`, font: { size: 13 } },
                showlegend: false,
                shapes: [
                  // HR = 1 is the null, the way 0 is for a beta.
                  { type: 'line', xref: 'x', yref: 'paper', x0: 1, x1: 1, y0: 0, y1: 1,
                    line: { dash: 'dash', width: 1, color: '#999' } },
                  ...(obsThresh != null ? [{
                    type: 'line', xref: 'paper', x0: 0, x1: 1, y0: obsThresh, y1: obsThresh,
                    line: { dash: 'dot', width: 1, color: '#B0653C' },
                  }] : []),
                ],
                annotations: obsThresh != null ? [{
                  xref: 'paper', x: 1, y: obsThresh, xanchor: 'right', yanchor: 'bottom',
                  text: 'Bonferroni', showarrow: false, font: { size: 9, color: '#B0653C' },
                }] : [],
              }}
            />
          </Box>
        </Box>
      )}

      {mrRows.length > 0 && !nMrHit && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Every {inst}-pQTL edge for <b>{protein}</b> is graded <b>Null</b>. The
          observational panel may still show strong associations — that pattern is
          a reporter, not an intermediate.
        </Alert>
      )}

      {tableData && <Box sx={{ mt: 2 }}><ColumnarTable data={tableData} /></Box>}
    </SectionCard>
  );
}
