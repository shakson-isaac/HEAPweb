import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import SectionCard from '../../components/SectionCard';
import TableSection from '../../components/TableSection';
import PlotPanel from '../../components/PlotPanel';
import { useSection } from '../../lib/useSection';

const MODELS = [
  { col: 'cindex_base', name: 'Covariates only', color: '#c6c6c6' },
  { col: 'cindex_multi', name: '+ multi-exposure', color: '#7fa8c9' },
  { col: 'cindex_proteome', name: '+ proteome', color: '#1f4e79' },
];

const pretty = (s) => String(s).replace(/_/g, ' ');

function Biomonitoring() {
  const { data, loading, error } = useSection('pes_disease_biomonitoring');
  const traces = useMemo(() => {
    if (!data) return [];
    return MODELS.map((m) => ({
      type: 'bar',
      name: m.name,
      x: data.disease.map(pretty),
      y: data[m.col],
      marker: { color: m.color },
      hovertemplate: '<b>%{x}</b><br>C-index %{y:.4f}<extra>' + m.name + '</extra>',
    }));
  }, [data]);

  return (
    <SectionCard
      title="Disease biomonitoring"
      subtitle="Discrimination gained by adding the proteome on top of covariates and self-reported exposures."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={420}
        layout={{
          barmode: 'group',
          yaxis: { title: 'C-index', range: [0.5, 0.95] },
          legend: { orientation: 'h', y: -0.2 },
          margin: { b: 90 },
        }}
      />
      {data && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Proportion of the multi-exposure gain recovered by the proteome:{' '}
          {data.disease
            .map((d, i) => `${pretty(d)} ${data.recovered[i].toFixed(1)}%`)
            .join(' · ')}
        </Typography>
      )}
    </SectionCard>
  );
}

function TopGains() {
  const { data, loading, error } = useSection('pes_cox_top_gains');
  const traces = useMemo(() => {
    if (!data) return [];
    // Horizontal bars, largest gain at the top.
    const idx = data.delta.map((_, i) => i).sort((a, b) => data.delta[a] - data.delta[b]);
    return [{
      type: 'bar',
      orientation: 'h',
      x: idx.map((i) => data.delta[i]),
      y: idx.map((i) => `${data.exposure_label[i]} → ${data.disease_label[i]}`),
      customdata: idx.map((i) => [
        data.cindex_M2_covars_exposure[i],
        data.cindex_M3_covars_exposure_PES[i],
        data.category[i],
      ]),
      hovertemplate:
        '<b>%{y}</b><br>ΔC %{x:.4f}<br>'
        + 'without PES %{customdata[0]:.4f} → with PES %{customdata[1]:.4f}'
        + '<br>%{customdata[2]}<extra></extra>',
      marker: { color: idx.map((i) => data.delta[i]), colorscale: 'Blues', showscale: false },
    }];
  }, [data]);

  return (
    <SectionCard
      title="Largest predictive gains from a PES"
      subtitle="Change in Cox C-index when the proteomic exposure score is added to covariates plus the exposure itself."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={640}
        layout={{ xaxis: { title: 'Δ C-index' }, margin: { l: 340 } }}
      />
    </SectionCard>
  );
}

function PredictiveAccuracy() {
  const { data, loading, error } = useSection('pes_predictive_accuracy');
  const traces = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.metric)].map((m) => {
      const idx = data.metric.reduce((a, v, i) => (v === m ? (a.push(i), a) : a), []);
      return {
        type: 'scatter',
        mode: 'markers',
        name: m,
        x: idx.map((i) => data.n[i]),
        y: idx.map((i) => data.perf[i]),
        text: idx.map((i) => `${data.exposure_label[i]} (${data.category[i]})`),
        hovertemplate: '<b>%{text}</b><br>n = %{x:,}<br>%{y:.3f}<extra>%{fullData.name}</extra>',
        marker: { size: 8, opacity: 0.75 },
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="How well a PES reproduces its exposure"
      subtitle="Cross-validated accuracy per exposure: AUC for binary exposures, R² for continuous ones."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={440}
        layout={{
          xaxis: { title: 'training n' },
          yaxis: { title: 'cross-validated performance' },
          legend: { orientation: 'h', y: -0.22 },
          margin: { b: 90 },
        }}
      />
    </SectionCard>
  );
}

export default function Pes() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 900 }}>
        Proteomic exposure scores (PES) trained to predict each lifestyle exposure from
        plasma protein levels, then evaluated as a broad molecular health monitor: how
        well they track exposure within a person over time, and what they add to disease
        prediction beyond covariates and self-report.
      </Typography>
      <Biomonitoring />
      <TopGains />
      <PredictiveAccuracy />
      <TableSection
        section="pes_cox_delta_cindex"
        title="Δ C-index across every exposure–disease pair"
        rowsPerPage={25}
      />
      <TableSection
        section="pes_disease_specificity"
        title="Disease specificity"
        subtitle="Whether a score's predictive gain is concentrated in one disease or spread broadly."
      />
      <TableSection section="pes_incremental_value" title="Incremental value over covariates" />
      <TableSection section="pes_predictive_breadth" title="Predictive breadth" />
      <TableSection section="pes_exposure_signatures" title="Exposure protein signatures" />
      <TableSection section="pes_within_person" title="Within-person tracking" />
      <TableSection section="pes_within_person_smoking" title="Within-person smoking transitions" />
      <TableSection section="pes_switch_vs_track" title="Switching versus tracking" />
      <TableSection section="pes_switching_frequency" title="Exposure switching frequency" />
      <TableSection section="pes_binary_transitions" title="Binary exposure transitions" />
      <TableSection section="pes_exposure_modifiability" title="Exposure modifiability" />
      <TableSection section="pes_imaging_tracking" title="Imaging-visit tracking" />
      <TableSection section="pes_dose_vs_status" title="Dose versus status response" />
      <TableSection section="pes_vs_selfreport" title="PES versus self-report" rowsPerPage={25} />
      <TableSection section="pes_dynamic_monitor" title="Dynamic monitoring panels" />
    </Box>
  );
}
