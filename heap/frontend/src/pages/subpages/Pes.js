import React, { useMemo } from 'react';
import {
  Box, Divider, Typography,
} from '@mui/material';
import SectionCard from '../../components/SectionCard';
import PesReads from '../../components/pes/PesReads';
import PesTracks from '../../components/pes/PesTracks';
import PesReadVsTrack from '../../components/pes/PesReadVsTrack';
import PesDisease from '../../components/pes/PesDisease';
import TableSection from '../../components/TableSection';
import ColumnarTable from '../../components/ColumnarTable';
import PlotPanel from '../../components/PlotPanel';
import { useSection } from '../../lib/useSection';
import { ecatColor } from '../../lib/palette';

// ---------------------------------------------------------------------------
// This page mirrors printed main Figure 6, which asks three questions in order:
//   Q1 (panel b) does the proteome READ the exposure?
//   Q2 (panel c) does the score TRACK within-person change?
//   Q3 (panel d) is the exposure signal DISEASE-RELEVANT?
// The panel scripts are the specification:
//   HEAP/scripts/visualizations/figures/fig_m6_panel_{b,c,d}.R
//
// Those three plotters carry website_export = no, so nothing here reads their
// caches. Each panel is RECONSTRUCTED from the sibling sections that are
// published, and every place where the reconstruction is thinner than the print
// is stated on the panel rather than papered over (S7):
//   Q1 <- pes_predictive_accuracy  (cross-validated point estimates; the print
//         uses held-out accuracy with a bootstrap CI from module6_holdout_ci.R)
//   Q2 <- pes_within_person        (delta_cor only; no bootstrap CI, no grey
//         covariate benchmark -- both live in module6_within_ci.R, unexported)
//   Q3 <- pes_incremental_value x pes_within_person x pes_cox_delta_cindex
// ---------------------------------------------------------------------------

// NB no isTrue() guard here (cf. Associations.js): none of the four sections this
// page plots carries a boolean column -- pes_predictive_accuracy, pes_within_person,
// pes_incremental_value and pes_cox_delta_cindex are all numeric/string. Add the
// `v === true || String(v).toUpperCase() === 'TRUE'` guard at the point of use if a
// packed TSV "TRUE" ever appears in one of them.

const pretty = (s) => String(s).replace(/_/g, ' ');

// Category display names, from the PRETTY maps in fig_m6_panel_b.R / _c.R.
// The recurring cast of exposures the printed figure threads through b -> c -> d,
// copied from the CAST / PREFER vectors in the two panel scripts so the labelled
// exemplar of a category is the same one the manuscript labels.
const MODELS = [
  { col: 'cindex_base', name: 'Covariates only', color: '#c6c6c6' },
  { col: 'cindex_multi', name: '+ multi-exposure', color: '#7fa8c9' },
  { col: 'cindex_proteome', name: '+ proteome', color: '#1f4e79' },
];

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
      hovertemplate: `<b>%{x}</b><br>C-index %{y:.4f}<extra>${m.name}</extra>`,
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
      marker: { color: idx.map((i) => ecatColor(data.category[i])) },
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

// The full accuracy table, kept browsable underneath its own panel.
function AccuracyTable() {
  const { data, loading, error } = useSection('pes_predictive_accuracy');
  return (
    <SectionCard
      title="Predictive accuracy, every exposure"
      subtitle="The table behind question 1."
      loading={loading}
      error={error}
    >
      {data && <ColumnarTable data={data} initialRowsPerPage={10} />}
    </SectionCard>
  );
}

export default function Pes() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 1, maxWidth: 940 }}>
        Proteomic exposure scores (PES) are trained to predict each lifestyle exposure from
        plasma protein levels alone. Main Figure 6 asks three questions of them in sequence,
        and the three panels below are that sequence, made interactive: can the proteome
        <b> read</b> the exposure, does the score <b>track</b> change inside the same person
        over time, and is the signal <b>disease-relevant</b>? Hover any point for the exposure,
        its category, its sample size and its metric values.
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3, maxWidth: 940 }}>
        The printed panels are not exported, so each is rebuilt from the sibling sections that
        are published. Where the rebuild is thinner than the print — most importantly the
        bootstrap confidence intervals in question 2 — the panel says so rather than implying
        the difference is not there.
      </Typography>

      <PesReads />
      <PesTracks />
      <PesReadVsTrack />
      <PesDisease />

      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
        Supporting results
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 940 }}>
        Everything else the module exports, in full: the disease-prediction results the third
        question summarises, and the per-exposure tables behind all three.
      </Typography>

      <Biomonitoring />
      <TopGains />
      <AccuracyTable />
      <TableSection
        section="pes_cox_delta_cindex"
        title="Δ C-index across every exposure–disease pair"
        subtitle="The source of the point sizes in question 3."
        rowsPerPage={25}
      />
      <TableSection
        section="pes_disease_specificity"
        title="Disease specificity"
        subtitle="Whether a score's predictive gain is concentrated in one disease or spread broadly."
      />
      <TableSection
        section="pes_incremental_value"
        title="Incremental value over covariates"
        subtitle="The x axis of question 3."
      />
      <TableSection section="pes_predictive_breadth" title="Predictive breadth" />
      <TableSection section="pes_exposure_signatures" title="Exposure protein signatures" />
      <TableSection
        section="pes_within_person"
        title="Within-person tracking"
        subtitle="The full table behind question 2, including the exposures held out of that plot."
      />
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
