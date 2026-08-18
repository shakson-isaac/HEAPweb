import React, { useMemo, useState } from 'react';
import Select from 'react-select';
import { Box, Typography } from '@mui/material';
import SectionCard from '../../components/SectionCard';
import ColumnarTable from '../../components/ColumnarTable';
import PlotPanel from '../../components/PlotPanel';
import TableSection from '../../components/TableSection';
import { useSection, useKeys, useShard } from '../../lib/useSection';

const STATUS_COLOR = {
  'Colocalized (shared variant)': '#1b7837',
  'LD-confounded (distinct variants)': '#b2182b',
  Inconclusive: '#999999',
};

const idxWhere = (arr, val) =>
  arr.reduce((acc, v, i) => (v === val ? (acc.push(i), acc) : acc), []);

function PriorityVolcano() {
  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('mr_priority');
  const [protein, setProtein] = useState('ABO');
  const { data, loading, error } = useShard('mr_priority', protein);

  const options = useMemo(
    () => (keyIndex ? Object.keys(keyIndex.keys).map((k) => ({ value: k, label: k })) : []),
    [keyIndex]
  );

  const traces = useMemo(() => {
    if (!data) return [];
    // Effect on a log scale so protective and risk effects sit symmetrically
    // about zero; significance on y.
    return [{
      type: 'scattergl',
      mode: 'markers',
      x: data.protein_HR.map((h) => Math.log2(h)),
      y: data.neglog10p,
      text: data.Disease_label,
      customdata: data.protein_HR.map((h, i) => [h, data.n_cases[i]]),
      hovertemplate:
        '<b>%{text}</b><br>HR %{customdata[0]:.3f}<br>'
        + '−log10 p %{y:.2f}<br>%{customdata[1]:,} cases<extra></extra>',
      marker: {
        size: 7,
        color: data.neglog10p,
        colorscale: 'Viridis',
        showscale: false,
        line: { width: 0.5, color: '#fff' },
      },
    }];
  }, [data]);

  return (
    <SectionCard
      title="Protein &rarr; disease MR priority"
      subtitle="Each point is one disease tested against the selected protein. Positive log2 HR means higher protein, higher hazard."
      loading={kLoading || loading}
      error={kError || error}
    >
      <Box sx={{ maxWidth: 420, mb: 2 }}>
        <Select
          options={options}
          value={{ value: protein, label: protein }}
          onChange={(o) => setProtein(o.value)}
          isSearchable
          placeholder="Search a protein&hellip;"
        />
      </Box>
      {data && (
        <>
          <PlotPanel
            data={traces}
            height={460}
            layout={{
              xaxis: { title: 'log2 hazard ratio', zeroline: true, zerolinecolor: '#bbb' },
              yaxis: { title: '−log10 p' },
              title: { text: `${protein} — ${data.DZ_ID.length} diseases`, font: { size: 13 } },
            }}
          />
          <ColumnarTable data={data} />
        </>
      )}
    </SectionCard>
  );
}

function MotifOverview() {
  const { data, loading, error } = useSection('mr_motif_overview');
  const traces = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.bar)].map((b) => {
      const idx = idxWhere(data.bar, b);
      return {
        type: 'bar',
        name: b,
        x: idx.map((i) => data.motif[i]),
        y: idx.map((i) => data.n[i]),
        text: idx.map((i) => `${data.prot[i]} proteins`),
        hovertemplate: '<b>%{x}</b><br>%{y:,} edges<br>%{text}<extra>%{fullData.name}</extra>',
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="MR motif overview"
      subtitle="Edge counts per motif, at any significant edge versus the canonical Tier 1 gate."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={430}
        layout={{
          barmode: 'group',
          yaxis: { title: 'edges (log scale)', type: 'log' },
          margin: { b: 120 },
          legend: { orientation: 'h', y: -0.35 },
        }}
      />
    </SectionCard>
  );
}

function Coloc() {
  const { data, loading, error } = useSection('mr_coloc');
  const traces = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.status)].map((s) => {
      const idx = idxWhere(data.status, s);
      return {
        type: 'scatter',
        mode: 'markers',
        name: s,
        x: idx.map((i) => data['PP.H3'][i]),
        y: idx.map((i) => data['PP.H4'][i]),
        text: idx.map(
          (i) => `${data.protID[i]} — ${data.target[i]} (${data.arm[i]}, ${data.lead_snp[i]})`
        ),
        hovertemplate: '%{text}<br>PP.H3 %{x:.2f} · PP.H4 %{y:.2f}<extra>%{fullData.name}</extra>',
        marker: { size: 10, opacity: 0.85, color: STATUS_COLOR[s] || '#666' },
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="Colocalization of cis-pQTL and outcome signals"
      subtitle="PP.H4 &ge; 0.8 is the hard tier gate: one shared causal variant rather than two distinct variants in LD."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={450}
        layout={{
          xaxis: { title: 'PP.H3 (distinct variants)', range: [-0.03, 1.03] },
          yaxis: { title: 'PP.H4 (shared variant)', range: [-0.03, 1.03] },
          shapes: [{
            type: 'line', x0: -0.03, x1: 1.03, y0: 0.8, y1: 0.8,
            line: { dash: 'dot', width: 1, color: '#1b7837' },
          }],
          annotations: [{
            x: 0.02, y: 0.83, text: 'PP.H4 = 0.8', showarrow: false,
            font: { size: 10, color: '#1b7837' }, xanchor: 'left',
          }],
          legend: { orientation: 'h', y: -0.25 },
          margin: { b: 100 },
        }}
      />
      {data && <ColumnarTable data={data} />}
    </SectionCard>
  );
}

export default function Causal() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 900 }}>
        Mendelian randomization across the exposure &rarr; protein &rarr; disease triad, using
        split-sample UK Biobank and deCODE pQTL instruments over a shared edge set.
        Tier 1 requires a Steiger test that is both significant and forward-oriented.
      </Typography>
      <PriorityVolcano />
      <MotifOverview />
      <Coloc />
      <TableSection
        section="mr_triad_spotlight"
        title="Exposure &rarr; protein &rarr; disease triads"
        subtitle="Effect sizes and adjusted p-values along every edge of each highlighted triad."
      />
      <TableSection
        section="mr_shared_unique"
        title="Shared versus arm-specific motifs"
        subtitle="How motif assignments split between UK Biobank pQTLs, deCODE pQTLs, and their intersection."
      />
      <TableSection section="mr_protein_hits_table" title="Prioritized protein hits" />
      <TableSection section="mr_edges" title="Exposure&ndash;protein&ndash;disease edges" />
      <TableSection
        section="mr_network"
        title="Network edge list"
        subtitle="Every node pair in the exposure&ndash;protein&ndash;disease network, with node and edge types."
        rowsPerPage={25}
      />
      <TableSection section="mr_attrition" title="Edge attrition through the MR tiers" />
      <TableSection section="mr_rigor" title="MR rigor diagnostics" />
      <TableSection section="mr_refines_mediation" title="How MR refines the mediation set" />
    </Box>
  );
}
