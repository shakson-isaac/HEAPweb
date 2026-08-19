import React, { useMemo, useState } from 'react';
import {
  Alert, AlertTitle, Box, Chip, Divider, FormControlLabel, Switch, Typography,
} from '@mui/material';
import SectionCard from '../../components/SectionCard';
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

const int = (v) => Number(v).toLocaleString();
const pretty = (s) => String(s).replace(/_/g, ' ');

// Category display names, from the PRETTY maps in fig_m6_panel_b.R / _c.R.
const PRETTY_CAT = {
  Deprivation_Indices: 'Deprivation / income',
  Exercise_MET: 'Exercise (MET)',
  Exercise_Freq: 'Exercise (frequency)',
  Sun_Exposure: 'Sun exposure',
  Diet_Weekly: 'Diet',
  Internet_Usage: 'Internet use',
  Sexual_Factors: 'Sexual factors',
  Residential_Air_Pollution: 'Air pollution',
  Residential_Noise_Pollution: 'Noise pollution',
};
const pcat = (c) => PRETTY_CAT[c] || pretty(c);

// The recurring cast of exposures the printed figure threads through b -> c -> d,
// copied from the CAST / PREFER vectors in the two panel scripts so the labelled
// exemplar of a category is the same one the manuscript labels.
const CAST_B = new Set([
  'alcohol_intake_frequency_f1558_0_0',
  'pack_years_of_smoking_f20161_0_0',
  'oily_fish_intake_f1329_0_0',
  'number_of_days_week_of_vigorous_physical_activity_10_plus_minutes_f904_0_0',
]);
const PREFER_B = {
  Diet_Weekly: 'processed_meat_intake_f1349_0_0',
  Sleep: 'sleep_duration_f1160_0_0',
};
// Survey-completion proxies are never a category's headline exposure.
const EXCLUDE_EXEMPLAR = new Set(['answered_sexual_history_questions_f2129_0_0']);

const CAST_C = new Set([...CAST_B, 'processed_meat_intake_f1349_0_0']);
const PREFER_C = {
  Diet_Weekly: 'processed_meat_intake_f1349_0_0',
  Exercise_Freq: 'number_of_days_week_of_vigorous_physical_activity_10_plus_minutes_f904_0_0',
  Smoking: 'current_tobacco_smoking_f1239_0_0_Yes._on_most_or_all_days',
  Sleep: 'sleep_duration_f1160_0_0',
  Alcohol: 'alcohol_intake_frequency_f1558_0_0',
};
// Always labelled in Q2 even though it is not its category's best: it is the
// cautionary case the printed panel exists to show.
const PACK_YEARS = 'pack_years_of_smoking_f20161_0_0';

// Excluded from Q2 by fig_m6_panel_c.R -- these cannot change within a person.
const IMMUTABLE_CATS = new Set(['Sexual_Factors']);

// Dropped before taking the best disease gain in fig_m6_panel_d.R.
const DISEASE_EXCLUDE = new Set(['obesity', 'alcoholic liver disease']);

// Deterministic jitter: a fresh Math.random() would reshuffle the cloud on
// every re-render, so points would appear to move when a toggle is flipped.
function jitter(i, amp) {
  const x = Math.sin((i + 1) * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amp;
}

// A reference line drawn as a two-point DATA trace, never as layout.shapes.
// A shape anchored to a log axis is read as a data value by this Plotly build
// and destroys the autorange; keeping every reference line a trace means the
// rule holds no matter what an axis is later switched to.
const refLine = (name, x, y, color = '#9e9e9e') => ({
  type: 'scatter',
  mode: 'lines',
  name,
  x,
  y,
  line: { color, width: 1, dash: 'dash' },
  hoverinfo: 'skip',
  showlegend: false,
});

// Exemplar labels are layout annotations rather than a `markers+text` trace so
// they can be pushed clear of their own marker by a fixed pixel offset; Plotly's
// textposition puts the string flush against the point, where a 12 px dot sits
// underneath the first characters.
const labelAnn = (text, x, y, side) => ({
  x,
  y,
  text,
  showarrow: false,
  xanchor: side === 'left' ? 'right' : 'left',
  xshift: side === 'left' ? -11 : 11,
  font: { size: 10, color: '#222' },
});

/**
 * Shared builder for the two category-strip panels (Q1 and Q2): one dot per
 * exposure on its category's row, colored by category (S6), with one
 * representative exposure per category drawn bigger and labelled.
 */
function stripPanel({
  rows, valueOf, cats, cast, prefer, force = [], amp = 0.17,
}) {
  const order = new Map(cats.map((c, i) => [c, i]));
  const idx = rows.filter((r) => Number.isFinite(valueOf(r)) && order.has(r.category));

  // Exemplar per category: the forced cast pick if the category has one,
  // otherwise any cast member, otherwise the highest value on the row.
  const byCat = new Map();
  idx.forEach((r) => {
    if (EXCLUDE_EXEMPLAR.has(r.exposure_id)) return;
    const cur = byCat.get(r.category);
    const rank = (x) => (prefer[x.category] === x.exposure_id ? 2 : cast.has(x.exposure_id) ? 1 : 0);
    if (!cur
      || rank(r) > rank(cur)
      || (rank(r) === rank(cur) && valueOf(r) > valueOf(cur))) byCat.set(r.category, r);
  });
  const exemplarIds = new Set([...byCat.values()].map((r) => r.exposure_id));
  force.forEach((id) => { if (idx.some((r) => r.exposure_id === id)) exemplarIds.add(id); });

  const cloud = idx.filter((r) => !exemplarIds.has(r.exposure_id));
  const exemplars = idx.filter((r) => exemplarIds.has(r.exposure_id));

  const yOf = (r, k) => order.get(r.category) + jitter(k, amp);
  return { idx, cloud, exemplars, order, yOf };
}

const CUSTOM = (r, extra = []) => [
  r.exposure_label || pretty(r.exposure_id),
  pcat(r.category),
  r.n === null || r.n === undefined ? 'not reported' : int(r.n),
  ...extra,
];

// ---------------------------------------------------------------------------
// Q1 -- does the proteome READ the exposure?   (printed panel b)
// ---------------------------------------------------------------------------
function ReadsTheExposure() {
  const { data, loading, error } = useSection('pes_predictive_accuracy');

  const built = useMemo(() => {
    if (!data) return null;
    const rows = data.exposure_id.map((id, i) => ({
      exposure_id: id,
      exposure_label: data.exposure_label[i],
      exposure_type: data.exposure_type[i],
      category: data.category[i],
      n: data.n[i],
      metric: data.metric[i],
      r2: data.r2[i],
      auc: data.auc[i],
      perf: data.perf[i],
    }));
    const cont = rows.filter((r) => r.exposure_type === 'continuous');
    const bin = rows.filter((r) => r.exposure_type === 'binary');

    // Shared category order so the two sub-panels never reshuffle relative to
    // one another: rank by median continuous R², then append the categories
    // that exist only among the binary exposures.
    const med = (vals) => {
      const s = [...vals].sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : -Infinity;
    };
    const catMed = (subset, val) => {
      const m = new Map();
      subset.forEach((r) => {
        if (!m.has(r.category)) m.set(r.category, []);
        m.get(r.category).push(val(r));
      });
      return [...m.entries()].sort((a, b) => med(a[1]) - med(b[1])).map((e) => e[0]);
    };
    const ordC = catMed(cont, (r) => r.r2);
    const ordB = catMed(bin, (r) => r.auc);
    const shared = [...ordB.filter((c) => !ordC.includes(c)), ...ordC];

    const mk = (subset, val) => stripPanel({
      rows: subset,
      valueOf: val,
      cats: shared.filter((c) => subset.some((r) => r.category === c)),
      cast: CAST_B,
      prefer: PREFER_B,
    });
    return {
      cont: { ...mk(cont, (r) => r.r2), val: (r) => r.r2, label: 'cross-validated R²' },
      bin: { ...mk(bin, (r) => r.auc), val: (r) => r.auc, label: 'cross-validated AUC' },
      nCont: cont.length,
      nBin: bin.length,
    };
  }, [data]);

  const sub = (p, refX, xr, title, unit) => {
    if (!p) return null;
    const cats = [...p.order.keys()];
    const ymax = cats.length - 0.4;
    const hov = '<b>%{customdata[0]}</b>'
      + '<br>category: %{customdata[1]}'
      + '<br>training n = %{customdata[2]}'
      + `<br>${p.label} = %{x:.3f}<extra></extra>`;
    const traces = [
      refLine('no skill', [refX, refX], [-0.6, ymax], '#bdbdbd'),
      {
        type: 'scatter',
        mode: 'markers',
        x: p.cloud.map(p.val),
        y: p.cloud.map((r, k) => p.yOf(r, k)),
        customdata: p.cloud.map((r) => CUSTOM(r)),
        hovertemplate: hov,
        marker: {
          size: 7,
          color: p.cloud.map((r) => ecatColor(r.category)),
          opacity: 0.8,
          line: { width: 0 },
        },
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: p.exemplars.map(p.val),
        y: p.exemplars.map((r) => p.order.get(r.category)),
        customdata: p.exemplars.map((r) => CUSTOM(r)),
        hovertemplate: hov,
        marker: {
          size: 12,
          color: p.exemplars.map((r) => ecatColor(r.category)),
          line: { width: 1.2, color: '#333' },
        },
        showlegend: false,
      },
    ];
    const annotations = p.exemplars.map((r) => labelAnn(
      r.exposure_label || pretty(r.exposure_id),
      p.val(r),
      p.order.get(r.category),
      p.val(r) > xr[0] + 0.78 * (xr[1] - xr[0]) ? 'left' : 'right'
    ));
    return (
      <Box sx={{ flex: '1 1 420px', minWidth: 340 }}>
        <PlotPanel
          data={traces}
          height={470}
          layout={{
            title: { text: title, font: { size: 13 } },
            xaxis: { title: unit, range: xr, type: 'linear', zeroline: false },
            annotations,
            yaxis: {
              type: 'linear',
              range: [-0.7, ymax + 0.3],
              tickmode: 'array',
              tickvals: cats.map((c, i) => i),
              ticktext: cats.map(pcat),
              title: '',
            },
            margin: { l: 140, r: 20, t: 40, b: 60 },
          }}
        />
      </Box>
    );
  };

  return (
    <SectionCard
      title="1. Does the proteome read the exposure?"
      subtitle={
        'One dot per exposure, on its category row and in its category color. The two '
        + 'metrics are shown separately because they are not comparable: continuous '
        + 'exposures are scored by R² against a no-skill line at 0, binary exposures by '
        + 'AUC against a no-skill line at 0.5. The bolder ringed dot in each row is that '
        + 'category’s representative exposure, the one the printed figure labels.'
      }
      loading={loading}
      error={error}
    >
      {built && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${built.nCont} continuous exposures`} />
            <Chip size="small" label={`${built.nBin} binary exposures`} />
            <Chip size="small" variant="outlined" label={`${built.nCont + built.nBin} scores`} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {sub(built.cont, 0, [-0.06, 0.68], 'Continuous exposures', 'cross-validated R²')}
            {sub(built.bin, 0.5, [0.45, 1.28], 'Binary exposures', 'cross-validated AUC')}
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Printed Figure 6b plots <b>held-out</b> accuracy with a 95% bootstrap interval
            (<code>support/module6_holdout_ci.R</code>). Neither the held-out point nor its
            interval is in the published export, so this panel shows the
            {' '}<b>cross-validated point estimate</b> from <code>pes_predictive_accuracy</code>{' '}
            and draws no intervals. The two accuracies are close but not identical, and no
            uncertainty is displayed here.
          </Alert>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Q2 -- does the score TRACK within-person change?   (printed panel c)
// ---------------------------------------------------------------------------
function TracksChange() {
  const { data, loading, error } = useSection('pes_within_person');

  const built = useMemo(() => {
    if (!data) return null;
    const all = data.exposure_id.map((id, i) => ({
      exposure_id: id,
      exposure_label: data.exposure_label[i],
      exposure_type: data.exposure_type[i],
      category: data.category[i],
      n: data.n[i],
      delta_cor: data.delta_cor[i],
      metric: data.metric[i],
    }));
    const dropped = all.filter((r) => IMMUTABLE_CATS.has(r.category));
    const rows = all.filter((r) => !IMMUTABLE_CATS.has(r.category));

    const m = new Map();
    rows.forEach((r) => {
      if (!m.has(r.category)) m.set(r.category, []);
      m.get(r.category).push(r.delta_cor);
    });
    const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const cats = [...m.entries()].sort((a, b) => med(a[1]) - med(b[1])).map((e) => e[0]);

    const p = stripPanel({
      rows,
      valueOf: (r) => r.delta_cor,
      cats,
      cast: CAST_C,
      prefer: PREFER_C,
      force: [PACK_YEARS],
      amp: 0.16,
    });
    const py = rows.find((r) => r.exposure_id === PACK_YEARS);
    return { ...p, cats, rows, dropped, py, nAll: all.length };
  }, [data]);

  const traces = useMemo(() => {
    if (!built) return [];
    const hov = '<b>%{customdata[0]}</b>'
      + '<br>category: %{customdata[1]}'
      + '<br>n with a repeat measure = %{customdata[2]}'
      + '<br>Δ-correlation = %{x:.3f}'
      + '<br>%{customdata[3]}'
      + '<br><i>no confidence interval in the export</i><extra></extra>';
    const ymax = built.cats.length - 0.4;
    const metricNote = (r) => (r.exposure_type === 'binary'
      ? 'corr(Δ state, Δ score)'
      : 'corr(Δ observed, Δ predicted)');
    return [
      refLine('no tracking', [0, 0], [-0.6, ymax], '#bdbdbd'),
      {
        type: 'scatter',
        mode: 'markers',
        x: built.cloud.map((r) => r.delta_cor),
        y: built.cloud.map((r, k) => built.yOf(r, k)),
        customdata: built.cloud.map((r) => CUSTOM(r, [metricNote(r)])),
        hovertemplate: hov,
        marker: {
          size: 7,
          color: built.cloud.map((r) => ecatColor(r.category)),
          opacity: 0.85,
          line: { width: 0 },
        },
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: built.exemplars.map((r) => r.delta_cor),
        y: built.exemplars.map((r) => built.order.get(r.category)),
        customdata: built.exemplars.map((r) => CUSTOM(r, [metricNote(r)])),
        hovertemplate: hov,
        marker: {
          size: 12,
          color: built.exemplars.map((r) => ecatColor(r.category)),
          line: { width: 1.2, color: '#333' },
        },
        showlegend: false,
      },
    ];
  }, [built]);

  const annotations = useMemo(() => {
    if (!built) return [];
    // Every exemplar gets a plain label offset clear of its own marker, except
    // pack-years smoking: it is the cautionary case the printed panel exists to
    // make, so it gets a leader line out to empty space and says why it is at 0.
    const out = built.exemplars
      .filter((r) => r.exposure_id !== PACK_YEARS)
      .map((r) => labelAnn(
        r.exposure_label || pretty(r.exposure_id),
        r.delta_cor,
        built.order.get(r.category),
        r.delta_cor > 0.85 ? 'left' : 'right'
      ));
    if (built.py) {
      const row = built.order.get(built.py.category);
      out.push({
        x: built.py.delta_cor,
        y: row,
        // Data-coordinate tail, so the callout stays in the empty band above the
        // Smoking row whatever width the panel is rendered at.
        axref: 'x',
        ayref: 'y',
        ax: 0.42,
        ay: row - 0.62,
        text: 'Pack-years smoking — cumulative, so it cannot fall within a person',
        showarrow: true,
        arrowhead: 2,
        arrowsize: 0.8,
        arrowwidth: 1,
        arrowcolor: '#777',
        font: { size: 10, color: '#333' },
        bgcolor: 'rgba(255,255,255,0.9)',
        bordercolor: '#ccc',
        borderpad: 3,
      });
    }
    return out;
  }, [built]);

  return (
    <SectionCard
      title="2. Does the score track within-person change?"
      subtitle={
        'Δ-correlation per exposure: the correlation between the change in a person’s '
        + 'proteome score and the change in their actual exposure between visits. The dashed '
        + 'line at 0 marks no tracking. Confidence intervals are not drawn because they are '
        + 'not in the published export, so a point near 0 on this panel is untested, not a '
        + 'demonstrated null.'
      }
      loading={loading}
      error={error}
    >
      {built && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${built.rows.length} exposures plotted`} />
            <Chip size="small" variant="outlined" label={`${built.cats.length} categories`} />
            <Chip
              size="small"
              variant="outlined"
              label={`${built.dropped.length} sexual-factor exposures held out`}
            />
          </Box>
          <PlotPanel
            data={traces}
            height={480}
            layout={{
              xaxis: {
                title: 'within-person Δ-correlation  (Δ score vs Δ exposure)',
                range: [-0.14, 1.02],
                type: 'linear',
                zeroline: false,
              },
              yaxis: {
                type: 'linear',
                range: [-0.7, built.cats.length - 0.1],
                tickmode: 'array',
                tickvals: built.cats.map((c, i) => i),
                ticktext: built.cats.map(pcat),
                title: '',
              },
              annotations,
              margin: { l: 150, r: 30, t: 20, b: 60 },
            }}
          />
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>No confidence intervals are shown on this panel</AlertTitle>
            Printed Figure 6c draws a 95% bootstrap interval around every point, computed by
            {' '}<code>support/module6_within_ci.R</code> by resampling held-out people. Those
            intervals are <b>not in the published export</b> — <code>pes_within_person</code>{' '}
            carries the point estimate <code>delta_cor</code> and nothing else — so none are
            drawn here. <b>Read a point near zero as not tested on this page, not as a
            demonstrated null.</b>
            {built.py && (
              <>
                {' '}The worked example is the labelled one: pack-years smoking sits at
                {' '}Δr = {built.py.delta_cor.toFixed(3).replace('-', '\u2212')} even though the proteome reads it
                almost perfectly cross-sectionally (panel 1). That is deliberate and expected,
                not a failure of the score — pack-years is a cumulative quantity that cannot
                fall within a person, so there is no within-person change to track, and its
                printed interval straddles zero.
              </>
            )}
            {' '}The same export also omits the grey <b>covariate benchmark</b> series that the
            printed panel plots beside the proteome series, so only the proteome series appears
            above.
          </Alert>
          {built.dropped.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              Held out of the plot, following <code>fig_m6_panel_c.R</code>: the{' '}
              {built.dropped.length} sexual-factor exposures (
              {built.dropped.map((r) => r.exposure_label).join(', ')}), which are fixed or
              lifetime-cumulative and so cannot change within a person. They were measured and
              are in the table below, not silently dropped.
            </Typography>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Q3 -- is the exposure signal DISEASE-RELEVANT?   (printed panel d)
// ---------------------------------------------------------------------------
function DiseaseRelevance() {
  const inc = useSection('pes_incremental_value');
  const win = useSection('pes_within_person');
  const cox = useSection('pes_cox_delta_cindex');
  const [dropObesity, setDropObesity] = useState(true);

  const loading = inc.loading || win.loading || cox.loading;
  const error = inc.error || win.error || cox.error;

  const built = useMemo(() => {
    if (!inc.data || !win.data || !cox.data) return null;
    const I = inc.data;
    const W = win.data;
    const C = cox.data;

    // x -- incremental accuracy beyond covariates, floored at no skill exactly as
    // fig_m6_panel_d.R does (0 for R², 0.5 for AUC).
    const incr = new Map();
    I.exposure_id.forEach((id, i) => {
      const floor = I.exposure_type[i] === 'continuous' ? 0 : 0.5;
      incr.set(id, {
        x: I.prot_plus_cov[i] - Math.max(I.cov_only[i], floor),
        cov: I.cov_only[i],
        both: I.prot_plus_cov[i],
        type: I.exposure_type[i],
        metric: I.metric[i],
      });
    });

    // size -- best held-out C-index gain per exposure over the disease panel.
    const best = new Map();
    C.exposure_id.forEach((id, i) => {
      const dz = String(C.disease_label[i]).toLowerCase();
      if (dropObesity && DISEASE_EXCLUDE.has(dz)) return;
      const d = C.delta[i];
      if (d === null || d === undefined) return;
      const cur = best.get(id);
      if (!cur || d > cur.delta) best.set(id, { delta: d, disease: C.disease_label[i] });
    });

    const rows = W.exposure_id.map((id, i) => ({
      exposure_id: id,
      exposure_label: W.exposure_label[i],
      category: W.category[i],
      n: W.n[i],
      y: W.delta_cor[i],
      ...(incr.get(id) || {}),
      best: best.get(id) || null,
    })).filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y));

    const sized = rows.filter((r) => r.best);
    const unsized = rows.filter((r) => !r.best);
    return {
      rows,
      sized,
      unsized,
      nCoxExposures: new Set(C.exposure_id).size,
      nDiseases: new Set(C.disease_label).size,
    };
  }, [inc.data, win.data, cox.data, dropObesity]);

  const traces = useMemo(() => {
    if (!built) return [];
    const base = '<b>%{customdata[0]}</b>'
      + '<br>category: %{customdata[1]}'
      + '<br>n with a repeat measure = %{customdata[2]}'
      + '<br>reads (beyond covariates): %{x:.3f}  [%{customdata[3]} → %{customdata[4]}]'
      + '<br>tracks (Δ-correlation): %{y:.3f}';
    const cd = (r) => CUSTOM(r, [
      r.cov === undefined ? '–' : r.cov.toFixed(3),
      r.both === undefined ? '–' : r.both.toFixed(3),
      r.best ? r.best.disease : '',
      r.best ? r.best.delta.toFixed(4) : '',
    ]);
    // Area-proportional radius so a point twice the area reads as twice the gain.
    const sizeOf = (d) => 7 + 46 * Math.sqrt(Math.max(d, 0));
    const key = [0.01, 0.02, 0.04];
    // Greedy declutter: walk the sized points from the largest disease gain down
    // and keep a label only where it will not land on one already placed. Two
    // exposures can sit almost on top of each other (snoring yes/no), and two
    // labels there are a smear rather than two facts.
    const NX = 0.52;
    const NY = 0.98;
    const labelled = [];
    [...built.sized].sort((a, b) => b.best.delta - a.best.delta).forEach((r) => {
      if (labelled.length >= 6) return;
      const clash = labelled.some((q) => Math.hypot((q.x - r.x) / NX, (q.y - r.y) / NY) < 0.09);
      if (!clash) labelled.push(r);
    });
    return [
      refLine('no tracking', [-0.05, 0.47], [0, 0], '#d0d0d0'),
      {
        type: 'scatter',
        mode: 'markers',
        name: `no disease evaluation in the export (${built.unsized.length})`,
        x: built.unsized.map((r) => r.x),
        y: built.unsized.map((r) => r.y),
        customdata: built.unsized.map(cd),
        hovertemplate: `${base}<br><i>disease relevance: not evaluated in the published export</i><extra></extra>`,
        marker: {
          size: 6,
          color: 'rgba(0,0,0,0)',
          line: { width: 1, color: '#9e9e9e' },
        },
      },
      {
        type: 'scatter',
        mode: 'markers',
        name: `disease gain available (${built.sized.length})`,
        x: built.sized.map((r) => r.x),
        y: built.sized.map((r) => r.y),
        customdata: built.sized.map(cd),
        hovertemplate: `${base}<br>best disease gain: ΔC = %{customdata[6]} (%{customdata[5]})<extra></extra>`,
        marker: {
          size: built.sized.map((r) => sizeOf(r.best.delta)),
          color: built.sized.map((r) => ecatColor(r.category)),
          opacity: 0.85,
          line: { width: 0.8, color: '#444' },
        },
      },
      // Size key. A trace with empty data gets no legend entry in this Plotly
      // build, so the key traces carry one point parked far outside the fixed
      // axis range -- nothing is drawn, the legend swatch is.
      ...key.map((k) => ({
        type: 'scatter',
        mode: 'markers',
        name: `point size: ΔC = ${k.toFixed(2)}`,
        x: [-99],
        y: [-99],
        hoverinfo: 'skip',
        marker: { size: sizeOf(k), color: '#bdbdbd', line: { width: 0.8, color: '#444' } },
      })),
      {
        // Label only the largest few: the sized points crowd the low-gain corner,
        // and 19 labels there are a smear. Everything else is on hover.
        type: 'scatter',
        mode: 'text',
        x: labelled.map((r) => r.x),
        y: labelled.map((r) => r.y),
        text: labelled.map((r) => r.exposure_label || pretty(r.exposure_id)),
        textposition: 'top center',
        textfont: { size: 10, color: '#333' },
        hoverinfo: 'skip',
        showlegend: false,
      },
    ];
  }, [built]);

  return (
    <SectionCard
      title="3. Is the exposure signal disease-relevant?"
      subtitle={
        'The two axes are the first two questions: how well the proteome reads the exposure '
        + 'beyond covariates (x) against how well the score tracks within-person change (y). '
        + 'Point size is the third — the best held-out Cox C-index gain the score buys over a '
        + 'disease panel. Disease signal alone does not make a score trustworthy, which is why '
        + 'it is the size and not an axis.'
      }
      loading={loading}
      error={error}
    >
      {built && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" label={`${built.rows.length} exposures on both axes`} />
            <Chip size="small" color="primary" label={`${built.sized.length} with a disease gain`} />
            <FormControlLabel
              control={(
                <Switch
                  size="small"
                  checked={dropObesity}
                  onChange={(e) => setDropObesity(e.target.checked)}
                />
              )}
              label={<Typography variant="body2">exclude obesity from the best-gain search</Typography>}
            />
          </Box>
          <PlotPanel
            data={traces}
            height={600}
            layout={{
              xaxis: {
                title: 'reads the exposure  (incremental R²/AUC beyond covariates) →',
                range: [-0.05, 0.47],
                type: 'linear',
                zeroline: false,
              },
              yaxis: {
                title: 'tracks within-person change  (Δ-correlation) →',
                range: [-0.12, 0.86],
                type: 'linear',
                zeroline: false,
              },
              legend: { orientation: 'h', y: -0.16, font: { size: 10 } },
              margin: { l: 80, r: 30, t: 20, b: 120 },
            }}
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            <AlertTitle>What the size can and cannot say</AlertTitle>
            <b>{built.unsized.length} of the {built.rows.length}</b> exposures are drawn as small
            open circles because the disease export covers only{' '}
            {built.nCoxExposures} exposures × {built.nDiseases} diseases
            (<code>pes_cox_delta_cindex</code>). They sit at their true reads/tracks position and
            carry no size: their disease relevance is <b>not evaluated here</b>, which is not the
            same as evaluated and null.
            {' '}Obesity is excluded from the best-gain search by default because
            {' '}<code>fig_m6_panel_d.R</code> drops it (with alcoholic liver disease) before
            taking the maximum, and because in this export obesity is the top-gain disease for
            every one of the {built.nCoxExposures} exposures — leaving it in makes every point
            the same disease. Toggle it back on to see that.
            {' '}The printed panel also draws C-index ladders (covariates → + self-report → + PES)
            beside the scatter; those ladder tables are not exported and are not reproduced here.
          </Alert>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Supporting sections kept from the previous page, below the Figure 6 narrative.
// ---------------------------------------------------------------------------
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

      <ReadsTheExposure />
      <TracksChange />
      <DiseaseRelevance />

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
