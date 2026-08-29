import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import SectionCard from '../../components/SectionCard';
import TableSection from '../../components/TableSection';
import PlotPanel from '../../components/PlotPanel';
import { useSection } from '../../lib/useSection';
import { pivotSymmetric } from '../../lib/heapdata';

function Heritability() {
  const { data, loading, error } = useSection('instrument_diagnostics');
  const traces = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.category)].sort().map((cat) => {
      const idx = data.category.reduce((a, v, i) => (v === cat ? (a.push(i), a) : a), []);
      return {
        type: 'scatter',
        mode: 'markers',
        name: cat,
        x: idx.map((i) => data.h2[i]),
        y: idx.map((i) => data.n_lead[i]),
        error_x: {
          type: 'data',
          array: idx.map((i) => data.h2_se[i]),
          thickness: 0.8,
          width: 0,
          color: 'rgba(0,0,0,0.25)',
        },
        text: idx.map((i) => data.label[i]),
        customdata: idx.map((i) => [data.lambda_gc[i], data.intercept[i], data.n_gwsig[i]]),
        hovertemplate:
          '<b>%{text}</b><br>h² %{x:.4f}<br>%{y} lead loci<br>'
          + '%{customdata[2]:,} genome-wide significant SNPs<br>'
          + 'λGC %{customdata[0]:.3f} · LDSC intercept %{customdata[1]:.3f}<extra>%{fullData.name}</extra>',
        marker: { size: 8, opacity: 0.8 },
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="Exposure heritability versus discovered loci"
      subtitle="LDSC SNP heritability against the number of independent genome-wide significant loci, per exposure GWAS. Bars are h² standard errors."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={500}
        layout={{
          xaxis: { title: 'LDSC SNP h²' },
          yaxis: { title: 'independent lead loci' },
          legend: { orientation: 'h', y: -0.22, font: { size: 10 } },
          margin: { b: 110 },
        }}
      />
    </SectionCard>
  );
}

function Inflation() {
  const { data, loading, error } = useSection('instrument_diagnostics');
  const traces = useMemo(() => {
    if (!data) return [];
    return [{
      type: 'scatter',
      mode: 'markers',
      x: data.lambda_gc,
      y: data.intercept,
      text: data.label,
      customdata: data.mean_chi2.map((c, i) => [c, data.ratio[i]]),
      hovertemplate:
        '<b>%{text}</b><br>λGC %{x:.3f}<br>LDSC intercept %{y:.3f}'
        + '<br>mean χ² %{customdata[0]:.3f} · ratio %{customdata[1]:.3f}<extra></extra>',
      marker: {
        size: 8,
        color: data.h2,
        colorscale: 'Viridis',
        colorbar: { title: 'h²', thickness: 12, len: 0.7 },
        line: { width: 0.4, color: '#fff' },
      },
    }];
  }, [data]);

  return (
    <SectionCard
      title="Polygenicity versus confounding"
      subtitle="An LDSC intercept near 1 with λGC above 1 means the inflation is polygenic signal rather than population stratification."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={440}
        layout={{
          xaxis: { title: 'λ genomic control' },
          yaxis: { title: 'LDSC intercept' },
          shapes: [{
            type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 1, y1: 1,
            line: { dash: 'dot', width: 1, color: '#b2182b' },
          }],
          annotations: [{
            xref: 'paper', x: 0.01, y: 1, text: 'intercept = 1 (no confounding)',
            showarrow: false, xanchor: 'left', yanchor: 'bottom',
            font: { size: 10, color: '#b2182b' },
          }],
        }}
      />
    </SectionCard>
  );
}

function GeneticCorrelation() {
  const { data, loading, error } = useSection('ldsc_rg');
  const traces = useMemo(() => {
    if (!data) return [];
    // rg is symmetric and LDSC reports each pair once, so mirror to a full
    // matrix; the diagonal is a trait against itself, which is 1 by definition.
    const { x, y, z } = pivotSymmetric(data, {
      aCol: 'p1', bCol: 'p2', zCol: 'rg', labels: ['label1', 'label2'], diagonal: 1,
    });
    return [{
      type: 'heatmap',
      x, y, z,
      zmin: -1,
      zmax: 1,
      colorscale: [
        [0, '#2166ac'], [0.25, '#92c5de'], [0.5, '#f7f7f7'],
        [0.75, '#f4a582'], [1, '#b2182b'],
      ],
      hoverongaps: false,
      colorbar: { title: 'rg', thickness: 12, len: 0.7 },
      hovertemplate: '%{y}<br>%{x}<br>rg %{z:.3f}<extra></extra>',
    }];
  }, [data]);

  return (
    <SectionCard
      title="Genetic correlation between exposures"
      subtitle="LDSC rg across the exposure GWAS, mirrored about the diagonal. Shared genetic architecture is why exposure effects on the proteome are correlated rather than independent."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={780}
        layout={{
          xaxis: { tickangle: -60, automargin: true, ticks: '' },
          yaxis: { automargin: true, ticks: '' },
          margin: { l: 220, b: 220, t: 20 },
        }}
      />
    </SectionCard>
  );
}

export default function Gwas() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 900 }}>
        Genome-wide association analyses of the lifestyle exposures themselves, run in
        REGENIE and post-processed with LDSC. These GWAS supply the instruments used by
        the Mendelian randomization arm, so their heritability and confounding
        diagnostics set the ceiling on what MR can resolve.
      </Typography>
      <Heritability />
      <Inflation />
      <GeneticCorrelation />
      <TableSection
        section="instrument_diagnostics"
        title="Per-exposure instrument diagnostics"
        subtitle="Heritability, inflation, lead loci and top locus for every exposure GWAS."
        rowsPerPage={25}
      />
      <TableSection
        section="gwas_exemplars"
        title="Exemplar exposure GWAS"
      />
    </Box>
  );
}
