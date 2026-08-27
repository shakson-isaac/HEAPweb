import React, { useMemo } from 'react';
import { Box, Divider, Typography } from '@mui/material';
import SectionCard from '../../components/SectionCard';
import EnrichTripartite from '../../components/enrichment/EnrichTripartite';
import TissueExplorer from '../../components/enrichment/TissueExplorer';
import ExposureBodyMap from '../../components/enrichment/ExposureBodyMap';
import TableSection from '../../components/TableSection';
import PlotPanel from '../../components/PlotPanel';
import { useSection } from '../../lib/useSection';
import { pivot } from '../../lib/heapdata';

// NES is signed, so the scale must be diverging and centred on zero --
// a sequential scale would make depletion look like weak enrichment.
const DIVERGING = [
  [0, '#2166ac'], [0.25, '#92c5de'], [0.5, '#f7f7f7'],
  [0.75, '#f4a582'], [1, '#b2182b'],
];

export function EnrichHeatmap({ section, title, subtitle, xCol, yCol, height }) {
  const { data, loading, error } = useSection(section);
  const traces = useMemo(() => {
    if (!data) return [];
    const { x, y, z } = pivot(data, { xCol, yCol, zCol: 'NES' });
    const lim = Math.max(...z.flat().filter((v) => v !== null).map(Math.abs));
    return [{
      type: 'heatmap',
      x, y, z,
      zmin: -lim,
      zmax: lim,
      colorscale: DIVERGING,
      hoverongaps: false,
      colorbar: { title: 'NES', thickness: 12, len: 0.7 },
      hovertemplate: '%{y}<br>%{x}<br>NES %{z:.2f}<extra></extra>',
    }];
  }, [data, xCol, yCol]);

  return (
    <SectionCard title={title} subtitle={subtitle} loading={loading} error={error}>
      <PlotPanel
        data={traces}
        height={height || 620}
        layout={{
          xaxis: { tickangle: -60, automargin: true, ticks: '' },
          yaxis: { automargin: true, ticks: '' },
          margin: { l: 200, b: 200, t: 20 },
        }}
      />
    </SectionCard>
  );
}

export function NesBar({ section, title, subtitle, labelCol, groupCol }) {
  const { data, loading, error } = useSection(section);
  const traces = useMemo(() => {
    if (!data) return [];
    const groups = groupCol ? [...new Set(data[groupCol])] : [null];
    return groups.map((g) => {
      const idx = data.NES
        .map((_, i) => i)
        .filter((i) => (g === null ? true : data[groupCol][i] === g))
        .sort((a, b) => data.NES[a] - data.NES[b]);
      return {
        type: 'bar',
        orientation: 'h',
        name: g === null ? 'NES' : String(g),
        x: idx.map((i) => data.NES[i]),
        y: idx.map((i) => data[labelCol][i]),
        customdata: idx.map((i) => data['p.adjust'][i]),
        hovertemplate: '<b>%{y}</b><br>NES %{x:.2f}<br>q %{customdata:.3g}<extra>%{fullData.name}</extra>',
      };
    });
  }, [data, labelCol, groupCol]);

  return (
    <SectionCard title={title} subtitle={subtitle} loading={loading} error={error}>
      <PlotPanel
        data={traces}
        height={560}
        layout={{
          barmode: 'group',
          xaxis: { title: 'normalized enrichment score', zeroline: true, zerolinecolor: '#bbb' },
          yaxis: { automargin: true },
          margin: { l: 300 },
          legend: { orientation: 'h', y: -0.15 },
        }}
      />
    </SectionCard>
  );
}

export default function Enrichment() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 900 }}>
        Gene-set enrichment of the exposure&ndash;protein associations, asking which
        tissues and pathways the exposure-responsive proteins come from. Positive NES
        means the set is enriched among proteins associated with that exposure;
        negative means depleted.
      </Typography>
      <ExposureBodyMap />
      <EnrichTripartite />
      <TissueExplorer />

      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
        Every enrichment, as heatmaps
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 940 }}>
        The full grids behind the views above: every exposure against every tissue and
        pathway, and the same enrichments grouped by exposure category and by variance
        component. Useful for scanning the whole space rather than following one thread
        through it.
      </Typography>

      <EnrichHeatmap
        section="tissue_enrichment"
        title="Tissue enrichment"
        subtitle="Exposures against GTEx tissue signatures. Blank cells were not significant."
        xCol="tissue"
        yCol="exposure"
        height={760}
      />
      <EnrichHeatmap
        section="pathway_enrichment"
        title="Pathway enrichment"
        subtitle="Exposures against Reactome pathways."
        xCol="pathway"
        yCol="exposure"
        height={700}
      />
      <EnrichHeatmap
        section="tissue_themes"
        title="Tissue themes by exposure category"
        subtitle="Tissues grouped into organ systems, shown per exposure category."
        xCol="tissue"
        yCol="category"
        height={420}
      />
      <EnrichHeatmap
        section="pathway_themes"
        title="Pathway themes by exposure category"
        subtitle="Pathways grouped into themes, shown per exposure category."
        xCol="pathway"
        yCol="category"
        height={420}
      />
      <NesBar
        section="exposure_tissue"
        title="Exposure&ndash;tissue enrichment"
        subtitle="Tissue signal aggregated across each exposure category."
        labelCol="tissue"
        groupCol="category"
      />
      <NesBar
        section="inflammation_convergence"
        title="Inflammatory convergence"
        subtitle="Where distinct exposure categories converge on shared inflammatory pathways."
        labelCol="pathway"
        groupCol="category"
      />
      <NesBar
        section="component_pathways"
        title="Pathways by variance component"
        subtitle="Which biology sits behind the exposomic component of protein variance."
        labelCol="Description"
        groupCol="ONTOLOGY"
      />
      <TableSection
        section="geno_expo_pathways"
        title="Genetic versus exposomic pathways"
        rowsPerPage={25}
      />
    </Box>
  );
}
