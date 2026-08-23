import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import LinkedScatterTable from '../LinkedScatterTable';
import PlotPanel from '../PlotPanel';
import { useSection } from '../../lib/useSection';
import { SPECS } from '../../lib/covariateSpecs';
import { ecatColor, prettyCategory, prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// Does the proteome READ the exposure?
//
// Two plots, in the order a reader needs them.
//
// The first is the score on its own -- the same quantity the printed panel b
// shows, one dot per exposure coloured by category, now with the 95% interval
// the printed version has no room for. The second is the contrast: what the
// score adds on top of the covariate benchmark.
//
// That order exists because of an awkward fact about the specification picker.
// `heldout_proteome_only` (and `aupr_proteome_only`) are byte-identical across
// base, base_bmi, base_clinical and base_draw: those specifications change what
// the COVARIATE BENCHMARK adjusts for, they do not refit the proteomic score.
// Showing the score first turns that from a trap into the demonstration --
// switch the picker and watch plot 1 sit perfectly still while plot 2 moves.
// Only base_exclprev restricts the sample, and it is the only one that shifts
// plot 1. The identity chip measures that from the data rather than asserting
// it, so it stays honest if the export is rebuilt.
// ---------------------------------------------------------------------------

// SPECS now lives in lib/covariateSpecs.js -- four panels each had a copy and
// they had drifted apart in both labels and order.

// A view fixes the exposure type AND the metric together, which is the point:
// continuous exposures are scored in held-out R² and binary ones in AUC, and no
// axis on this panel is ever allowed to carry both. AUPR is offered as a second
// reading of the same binary exposures because AUC is close to uninformative
// for the rare ones (prevalence runs down to 0.06%), where a model can look
// excellent while retrieving almost nobody.
const VIEWS = [
  {
    id: 'cont_r2',
    label: 'Continuous — R²',
    type: 'continuous',
    prefix: 'heldout',
    unit: 'held-out R²',
    soloAxis: 'proteome-only held-out R²',
    deltaAxis: 'Δ held-out R² — (covariates + PES) − covariates',
    // No-information point for an out-of-sample R²: a model no better than the
    // outcome mean. Held-out R² can and does go negative, so this is a real
    // line, not a plot boundary.
    refX: 0,
    // A display floor, not a filter. Held-out R2 runs down to -1.015 (length of
    // mobile phone use) and the negative tail compresses the informative range
    // into the right of the plot. Cutting at -0.05 spends 4 of 81 exposures to
    // give the other 77 the width they need; all four remain in the table under
    // plot 2, and the chip above says how many are off scale.
    //
    // Deliberately NOT floored at 0. Eighteen exposures are genuinely negative,
    // and "worse than predicting the mean" is a real answer about an exposure
    // the proteome cannot read -- cutting there would hide a finding rather
    // than an artifact.
    xFloor: -0.05,
    refLabel: 'no better than the mean',
  },
  {
    id: 'bin_auc',
    label: 'Binary — AUC',
    type: 'binary',
    prefix: 'heldout',
    unit: 'held-out AUC',
    soloAxis: 'proteome-only held-out AUC',
    deltaAxis: 'Δ held-out AUC — (covariates + PES) − covariates',
    refX: 0.5,
    // No floor: held-out AUC bottoms out at 0.528, so there is nothing below
    // chance to cut and a floor would only add empty space.
    xFloor: null,
    refLabel: 'chance',
  },
  {
    id: 'bin_aupr',
    label: 'Binary — AUPR',
    type: 'binary',
    prefix: 'aupr',
    unit: 'held-out AUPR',
    soloAxis: 'proteome-only held-out AUPR',
    deltaAxis: 'Δ held-out AUPR — (covariates + PES) − covariates',
    // No fixed reference line: the no-skill AUPR is the exposure's own
    // prevalence, so it differs per point and one line would be a lie. The
    // per-row prevalence column carries that comparison instead.
    refX: null,
    // No floor, and the distribution is why: AUPR runs 0.007 to 0.994 with no
    // detached tail to trim -- it is bounded by each exposure's own prevalence,
    // so a low value is informative rather than pathological. A cut anywhere
    // near the R2 or AUC cuts would delete most of the panel (48 of 84 sit
    // below 0.4). The prevalence column is what makes a low value readable.
    xFloor: null,
    refLabel: null,
  },
];

// The exemplars the printed panel labels, copied from fig_m6_panel_b.R:24,62-64.
// PREFER overrides, then CAST, then the category's best-read exposure -- and the
// shared-category picks are deliberately the same ones panel c labels, so the
// cast threads across b -> c. A pure "highest value" rule would drift away from
// the figure the reader has in hand.
const CAST = new Set([
  'alcohol_intake_frequency_f1558_0_0',
  'pack_years_of_smoking_f20161_0_0',
  'oily_fish_intake_f1329_0_0',
  'number_of_days_week_of_vigorous_physical_activity_10_plus_minutes_f904_0_0',
]);
const PREFER = {
  Diet_Weekly: 'processed_meat_intake_f1349_0_0',
  Sleep: 'sleep_duration_f1160_0_0',
};

// Deterministic jitter keyed to the exposure id. A fresh Math.random() per render
// would make the cloud twitch whenever a toggle flips, and motion reads as data.
const jitter01 = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    /* eslint-disable no-bitwise */
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
    /* eslint-enable no-bitwise */
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5;
};

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt3 = (v) => (v == null ? '—' : v.toFixed(3));
const ci = (v, lo, hi) => (v == null ? '—' : `${fmt3(v)} [${fmt3(lo)}, ${fmt3(hi)}]`);
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`);
const pctCi = (v, lo, hi) => `${pct(v)} [${pct(lo)}, ${pct(hi)}]`;

// Category color at reduced alpha. Plot 2 fades an exposure whose INCREMENT
// interval includes zero, so the emphasis on screen is driven by the test that
// actually decides the question rather than by where the two endpoints sit.
const fade = (hex, a) => {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  /* eslint-disable no-bitwise */
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  /* eslint-enable no-bitwise */
};

// Sub-heading for each of the two plots. They ask different questions of the
// same numbers, and a reader who scrolls into the second one cold will read it
// as the first.
function PlotHeading({ index, title, note }) {
  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {index}. {title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {note}
      </Typography>
    </Box>
  );
}

export default function PesReads() {
  const { data, loading, error } = useSection('pes_reads_ci');
  const [specId, setSpecId] = useState('base');
  const [viewId, setViewId] = useState('cont_r2');
  const [labelExemplars, setLabelExemplars] = useState(true);

  const spec = SPECS.find((s) => s.id === specId) || SPECS[0];
  const view = VIEWS.find((v) => v.id === viewId) || VIEWS[0];

  // Read the columnar blob once into records; the pickers then only filter, so
  // switching specification or view never re-walks 814 rows of arrays.
  const rows = useMemo(() => {
    if (!data?.exposure_id) return [];
    const col = (name, i) => num(data[name]?.[i]);
    const out = [];
    for (let i = 0; i < data.exposure_id.length; i += 1) {
      const rec = {
        exposure_id: data.exposure_id[i],
        spec: data.covariate_spec[i],
        category: data.category[i],
        exposure_type: data.exposure_type[i],
        metric: data.metric[i],
        prevalence: col('prevalence', i),
        prevalence_lo: col('prevalence_lo', i),
        prevalence_hi: col('prevalence_hi', i),
        lift: col('aupr_covariates_plus_pes_over_prevalence', i),
      };
      // Both metric families are carried on every record under a common set of
      // names, so a view is a prefix lookup rather than a second code path.
      ['heldout', 'aupr'].forEach((p) => {
        ['covariates_only', 'proteome_only', 'covariates_plus_pes', 'increment'].forEach((k) => {
          rec[`${p}_${k}`] = col(`${p}_${k}`, i);
          rec[`${p}_${k}_lo`] = col(`${p}_${k}_lo`, i);
          rec[`${p}_${k}_hi`] = col(`${p}_${k}_hi`, i);
        });
      });
      out.push(rec);
    }
    return out;
  }, [data]);

  const viewRows = useMemo(() => rows.filter(
    (r) => r.spec === specId
      && r.exposure_type === view.type
      && r[`${view.prefix}_proteome_only`] != null,
  ), [rows, specId, view]);

  // Measured, not asserted: how many exposures carry exactly the Primary
  // proteome-only accuracy under this specification. All of them means the
  // picker moved the benchmark and nothing else -- which is precisely what
  // plot 1 is there to let the reader see.
  const identity = useMemo(() => {
    if (specId === 'base') return null;
    const key = `${view.prefix}_proteome_only`;
    const base = new Map(
      rows.filter((r) => r.spec === 'base' && r.exposure_type === view.type)
        .map((r) => [r.exposure_id, r[key]]),
    );
    let shared = 0;
    let same = 0;
    viewRows.forEach((r) => {
      if (!base.has(r.exposure_id)) return;
      shared += 1;
      if (base.get(r.exposure_id) === r[key]) same += 1;
    });
    return { shared, same };
  }, [rows, viewRows, specId, view]);

  // ---- plot 1: the score on its own ----------------------------------------
  // Printed panel b's layout (fig_m6_panel_b.R:105-119): y is the exposure
  // CATEGORY, one row each, every exposure a jittered dot with its 95% interval,
  // a dashed no-skill line, and one ringed + labelled exemplar per category.
  // Not a ranked list -- the question the row answers is "how well does the
  // proteome read this KIND of exposure", and the spread within a row is part
  // of the answer.

  // Row order and x range are computed over the WHOLE export, never per
  // specification. Ranking each spec's own medians slides categories sideways
  // between Primary and + BMI (the specs carry slightly different exposure
  // sets), which would contradict the exact claim this plot exists to make:
  // that the three adjustment-only specs do not move the score. Fix the frame,
  // let only the points move.
  const catOrder = useMemo(() => {
    const med = new Map();
    const byCat = new Map();
    rows.forEach((r) => {
      const v = r[`${view.prefix}_proteome_only`];
      if (v == null) return;
      if (!byCat.has(r.category)) byCat.set(r.category, []);
      byCat.get(r.category).push(v);
    });
    byCat.forEach((vals, c) => {
      const sorted = [...vals].sort((a, b) => a - b);
      med.set(c, sorted[Math.floor(sorted.length / 2)]);
    });
    // Weakest category at the bottom so the eye climbs from "no signal" upward.
    return [...med.keys()].sort((a, b) => med.get(a) - med.get(b));
  }, [rows, view]);

  const xRange = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    rows.forEach((r) => {
      [`${view.prefix}_proteome_only`, `${view.prefix}_proteome_only_lo`,
       `${view.prefix}_proteome_only_hi`].forEach((k) => {
        const v = r[k];
        if (v == null) return;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      });
    });
    if (!Number.isFinite(lo)) return undefined;
    if (view.xRangeFixed) return view.xRangeFixed;
    if (view.xFloor != null) lo = Math.max(lo, view.xFloor);
    // The no-skill line has to stay inside the frame; deriving the range purely
    // from the data would push 0.5 off the left edge of the AUC view, since the
    // weakest exposure sits at 0.528.
    if (view.refX != null) {
      lo = Math.min(lo, view.refX);
      hi = Math.max(hi, view.refX);
    }
    const pad = (hi - lo) * 0.06 || 0.02;
    return [lo - pad, hi + pad];
  }, [rows, view]);

  // Points the floor pushes off-scale. Reported, never silently dropped.
  const nOffScale = useMemo(() => (view.xFloor == null ? 0 : viewRows.filter(
    (r) => r[`${view.prefix}_proteome_only`] < view.xFloor,
  ).length), [viewRows, view]);

  // Both plots share one builder: same category rows, same exemplar rule, same
  // jitter. Only the measure differs. That is the point of the redesign -- the
  // reader learns the layout once and then reads plot 2 as "the same picture,
  // now showing what the score ADDS".
  const buildStrip = (measure, srcRows) => {
    const p = view.prefix;
    const present = new Set(srcRows.map((r) => r.category));
    const cats = catOrder.filter((c) => present.has(c));
    const rowOf = new Map(cats.map((c, i) => [c, i]));

    // PREFER, then CAST, then the category's best-read exposure.
    const exMap = new Map();
    cats.forEach((c) => {
      const inCat = srcRows.filter((r) => r.category === c);
      if (!inCat.length) return;
      const preferred = inCat.find((r) => r.exposure_id === PREFER[c]);
      const cast = inCat.find((r) => CAST.has(r.exposure_id));
      const best = inCat.reduce((a, b) => (b[`${p}_${measure}`] > a[`${p}_${measure}`] ? b : a));
      exMap.set(c, preferred || cast || best);
    });
    const exIds = new Set([...exMap.values()].map((r) => r.exposure_id));

    const toPoint = (r, centred) => ({
      id: r.exposure_id,
      category: r.category,
      x: r[`${p}_${measure}`],
      xlo: r[`${p}_${measure}_lo`],
      xhi: r[`${p}_${measure}_hi`],
      // Exemplars sit centred on their row so the label points at the row it
      // belongs to; everything else is jittered within the row.
      y: rowOf.get(r.category) + (centred ? 0 : jitter01(r.exposure_id) * 0.34),
      label: prettyExposure(r.exposure_id),
      row: r,
    });

    return {
      cats,
      cloud: srcRows.filter((r) => !exIds.has(r.exposure_id)).map((r) => toPoint(r, false)),
      exemplars: [...exMap.values()].map((r) => toPoint(r, true)),
    };
  };

  const strip = useMemo(
    () => buildStrip('proteome_only', viewRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewRows, catOrder, view],
  );

  const tracesFor = (st) => {
    if (!st.cats.length) return [];
    const bar = (arr, color, width) => ({
      type: 'data',
      symmetric: false,
      array: arr.map((q) => (q.xhi != null ? q.xhi - q.x : 0)),
      arrayminus: arr.map((q) => (q.xlo != null ? q.x - q.xlo : 0)),
      thickness: width,
      width: 0,
      color,
    });
    const hover = '<b>%{text}</b><br>' + view.unit
      + ' %{x:.3f}<br>%{customdata}<extra></extra>';
    const custom = (arr) => arr.map((q) => `95% CI ${fmt3(q.xlo)} to ${fmt3(q.xhi)}`);

    return [
      {
        type: 'scatter',
        mode: 'markers',
        x: st.cloud.map((q) => q.x),
        y: st.cloud.map((q) => q.y),
        text: st.cloud.map((q) => q.label),
        customdata: custom(st.cloud),
        error_x: bar(st.cloud, 'rgba(120,120,120,0.30)', 1),
        hovertemplate: hover,
        marker: { size: 7, color: st.cloud.map((q) => ecatColor(q.category)), opacity: 0.85 },
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: st.exemplars.map((q) => q.x),
        y: st.exemplars.map((q) => q.y),
        text: st.exemplars.map((q) => q.label),
        customdata: custom(st.exemplars),
        error_x: bar(st.exemplars, 'rgba(60,60,60,0.60)', 2),
        hovertemplate: hover,
        marker: {
          size: 13,
          color: st.exemplars.map((q) => ecatColor(q.category)),
          line: { width: 1.2, color: '#333' },   // the printed panel's outline ring
        },
        showlegend: false,
      },
    ];
  };

  const stripTraces = useMemo(
    () => tracesFor(strip),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strip, view],
  );


  const stripAnnotations = useMemo(() => {
    if (!labelExemplars || !strip.exemplars.length) return [];
    const [lo, hi] = xRange || [0, 1];
    const right = lo + 0.7 * (hi - lo);
    return strip.exemplars.map((q) => {
      const flip = q.x > right;
      return {
        x: q.x,
        y: q.y,
        text: q.label.length > 34 ? `${q.label.slice(0, 32)}\u2026` : q.label,
        showarrow: true,
        arrowhead: 0,
        arrowsize: 1,
        arrowwidth: 0.8,
        arrowcolor: '#999',
        ax: flip ? -26 : 26,
        ay: -16,
        xanchor: flip ? 'right' : 'left',
        font: { size: 9, color: '#333' },
      };
    });
  }, [strip, labelExemplars, xRange]);

  // The count that survives the intervals. For AUPR the no-skill point is the
  // exposure's own prevalence, so the bar differs per row.
  const nRead = useMemo(() => viewRows.filter((r) => {
    const lo = r[`${view.prefix}_proteome_only_lo`];
    const floor = view.refX != null ? view.refX : r.prevalence;
    return lo != null && floor != null && lo > floor;
  }).length, [viewRows, view]);


  // ---- plot 2: covariates vs covariates + the score -----------------------
  // The two nested models on the two axes, with y = x drawn: the covariate
  // benchmark alone on x, the same benchmark with the proteomic score added on
  // y. What adding the score buys is the rise above the diagonal, read off the
  // plot rather than computed into a derived axis.
  //
  // A ranked dumbbell would show that gain as a segment length, but the
  // connectors would have to be layout shapes, and this component filters its
  // points and its table without touching the shapes -- typing in the search
  // box would leave the segments of every hidden exposure painted across the
  // plot. Routing the connector through the error-bar channel instead would be
  // worse: it would draw a model-to-model span in exactly the grey bar that
  // means "95% interval" in plot 1, in a panel whose whole point is that a
  // reader must not misread an interval. Both axes here are real values, so
  // every mark filters, highlights and hovers with its point.
  const incRows = useMemo(() => viewRows.filter(
    (r) => r[`${view.prefix}_covariates_only`] != null
      && r[`${view.prefix}_covariates_plus_pes`] != null
      && r[`${view.prefix}_increment`] != null,
  ), [viewRows, view]);

  // The only test of "the score adds something": the interval on the DIFFERENCE
  // between two models fitted in the same people, which the export gives us
  // directly. Never inferred from whether the endpoint intervals overlap.
  const adds = (r) => (r[`${view.prefix}_increment_lo`] ?? -1) > 0;
  const nClear = incRows.filter(adds).length;

  // Measured from these same rows, and the reason the sentence below is not
  // pedantry: on the order of twenty exposures per view have endpoint intervals
  // that overlap and a gain that is nonetheless reliably above zero.
  const nOverlapReal = incRows.filter((r) => {
    const p = view.prefix;
    const aLo = r[`${p}_covariates_only_lo`];
    const aHi = r[`${p}_covariates_only_hi`];
    const bLo = r[`${p}_covariates_plus_pes_lo`];
    const bHi = r[`${p}_covariates_plus_pes_hi`];
    if ([aLo, aHi, bLo, bHi].some((v) => v == null)) return false;
    return !(aHi < bLo || bHi < aLo) && adds(r);
  }).length;

  const incPoints = useMemo(() => incRows.map((r) => {
    const p = view.prefix;
    const established = (r[`${p}_increment_lo`] ?? -1) > 0;
    return {
      id: r.exposure_id,
      x: r[`${p}_covariates_only`],
      xlo: r[`${p}_covariates_only_lo`],
      xhi: r[`${p}_covariates_only_hi`],
      y: r[`${p}_covariates_plus_pes`],
      ylo: r[`${p}_covariates_plus_pes_lo`],
      yhi: r[`${p}_covariates_plus_pes_hi`],
      label: prettyExposure(r.exposure_id),
      color: established ? ecatColor(r.category) : fade(ecatColor(r.category), 0.3),
      meta: {
        category: prettyCategory(r.category),
        exposure_type: r.exposure_type,
        increment_ci: ci(r[`${p}_increment`], r[`${p}_increment_lo`], r[`${p}_increment_hi`]),
        cov_ci: ci(r[`${p}_covariates_only`], r[`${p}_covariates_only_lo`], r[`${p}_covariates_only_hi`]),
        prot_ci: ci(r[`${p}_proteome_only`], r[`${p}_proteome_only_lo`], r[`${p}_proteome_only_hi`]),
        both_ci: ci(r[`${p}_covariates_plus_pes`], r[`${p}_covariates_plus_pes_lo`], r[`${p}_covariates_plus_pes_hi`]),
        prevalence: r.prevalence == null ? null : pctCi(r.prevalence, r.prevalence_lo, r.prevalence_hi),
        lift: r.lift,
      },
    };
  }), [incRows, view]);

  // ---- plot 2: what the score ADDS, in plot 1's layout ----------------------
  // Same category rows, same exemplars, same jitter -- x is now the increment
  // over covariates. The increment has its OWN interval in the export
  // (heldout_increment_lo/hi), which is the correct interval for a difference;
  // it is not recoverable from the two endpoint intervals, and reading overlap
  // between those endpoints is a stricter and wrong test.
  const deltaStrip = useMemo(
    () => buildStrip('increment', incRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incRows, catOrder, view],
  );
  const deltaTraces = useMemo(
    () => tracesFor(deltaStrip),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deltaStrip, view],
  );
  const deltaRange = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    rows.forEach((r) => {
      [`${view.prefix}_increment`, `${view.prefix}_increment_lo`,
       `${view.prefix}_increment_hi`].forEach((k) => {
        const v = r[k];
        if (v == null) return;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      });
    });
    if (!Number.isFinite(lo)) return undefined;
    // Zero always in frame: it is the whole reference for "adds nothing".
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
    const pad = (hi - lo) * 0.06 || 0.02;
    return [lo - pad, hi + pad];
  }, [rows, view]);

  const deltaAnnotations = useMemo(() => {
    if (!labelExemplars || !deltaStrip.exemplars.length) return [];
    const [lo, hi] = deltaRange || [0, 1];
    const right = lo + 0.7 * (hi - lo);
    return deltaStrip.exemplars.map((q) => {
      const flip = q.x > right;
      return {
        x: q.x,
        y: q.y,
        text: q.label.length > 34 ? `${q.label.slice(0, 32)}\u2026` : q.label,
        showarrow: true,
        arrowhead: 0,
        arrowsize: 1,
        arrowwidth: 0.8,
        arrowcolor: '#999',
        ax: flip ? -26 : 26,
        ay: -16,
        xanchor: flip ? 'right' : 'left',
        font: { size: 9, color: '#333' },
      };
    });
  }, [deltaStrip, labelExemplars, deltaRange]);

  const incColumns = useMemo(() => {
    const cols = [
      { key: 'label', label: 'Exposure', wrap: true, from: (p) => p.label },
      { key: 'category', label: 'Category' },
      // The column that decides the question the plot only sizes.
      { key: 'increment_ci', label: `Δ ${view.unit} over covariates [95% CI]`, align: 'right' },
      { key: 'cov_ci', label: 'Covariates only [95% CI]', align: 'right' },
      { key: 'both_ci', label: 'Covariates + PES [95% CI]', align: 'right' },
      { key: 'prot_ci', label: 'Proteome only [95% CI]', align: 'right' },
    ];
    if (view.type === 'binary') {
      cols.push({ key: 'prevalence', label: 'Prevalence [95% CI]', align: 'right' });
    }
    if (view.prefix === 'aupr') {
      cols.push({
        key: 'lift',
        label: 'AUPR ÷ prevalence',
        align: 'right',
        format: (v) => (v == null ? '—' : v.toFixed(2)),
      });
    }
    return cols;
  }, [view]);

  const catLegend = useMemo(() => {
    const seen = new Map();
    viewRows.forEach((r) => { if (!seen.has(r.category)) seen.set(r.category, ecatColor(r.category)); });
    return (
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        {[...seen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([c, col]) => (
          <Box key={c} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: col }} />
            <Typography variant="caption" color="text.secondary">{prettyCategory(c)}</Typography>
          </Box>
        ))}
      </Box>
    );
  }, [viewRows]);

  // One diagonal spanning everything actually drawn, intervals included, so the
  // reference line never stops short of the points it is meant to judge.
  const noSkillShape = view.refX == null ? [] : [{
    type: 'line', xref: 'x', yref: 'paper',
    x0: view.refX, x1: view.refX, y0: 0, y1: 1,
    line: { width: 1, dash: 'dot', color: '#bbb' },
  }];

  return (
    <SectionCard
      title="Does the proteome read the exposure?"
      subtitle={
        'Two readings of the same models. First the proteomic exposure score on its own, one '
        + 'exposure per dot with its 95% interval; then what that score adds on top of the '
        + 'covariate benchmark. Switching the specification below moves the second plot and '
        + 'leaves the first one standing still — that is the point, not an artefact.'
      }
      loading={loading}
      error={error}
      empty={!loading && !error && !rows.length}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 1 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Covariate specification
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={specId}
            onChange={(e, v) => v && setSpecId(v)}
          >
            {SPECS.map((s) => (
              <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none' }}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Exposure type and metric
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={viewId}
            onChange={(e, v) => v && setViewId(v)}
          >
            {VIEWS.map((v) => (
              <ToggleButton key={v.id} value={v.id} sx={{ textTransform: 'none' }}>
                {v.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        {spec.note}
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        <b>What this picker does and does not change.</b> Changing the covariate set does{' '}
        <b>not</b> retrain the proteomic score. Under <b>Primary</b>, <b>+ BMI</b>,{' '}
        <b>+ clinical</b> and <b>+ blood draw</b> the score is one fixed model and only the
        covariate benchmark it is measured against moves, so the question the picker answers is
        “does this one fixed score still add beyond a richer covariate block?”. You can watch
        that happen: plot 1 is identical under all four, plot 2 is not.{' '}
        <b>Healthy at baseline</b> is the only specification that restricts the sample and
        genuinely refits the score, and it is the only one that moves plot 1.
      </Alert>

      <PlotHeading
        index={1}
        title="The score on its own"
        note={
            'This is the score itself; only Healthy at baseline changes it. Laid out like the '
            + 'printed panel: one row per exposure category, every exposure a dot with its 95% '
            + 'interval, and no covariate contrast anywhere on the plot. The spread inside a row is part of the answer.'
        }
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Chip size="small" label={`${viewRows.length} ${view.type} exposures`} />
        {nOffScale > 0 && (
          <Chip
            size="small"
            variant="outlined"
            color="warning"
            label={`${nOffScale} below ${view.xFloor} \u2014 off scale`}
            title={'The axis is floored so one extreme value does not compress the rest. '
              + 'These exposures are still in the table under plot 2.'}
          />
        )}
        <Chip
          size="small"
          color={nRead ? 'success' : 'default'}
          label={
            view.refX != null
              ? `${nRead} read above ${view.refX === 0 ? 'zero' : 'chance'} with the interval clear of it`
              : `${nRead} with the interval clear of the exposure’s own prevalence`
          }
        />
        {identity && (
          <Chip
            size="small"
            color={identity.same === identity.shared ? 'warning' : 'success'}
            variant={identity.same === identity.shared ? 'filled' : 'outlined'}
            label={
              identity.same === identity.shared
                ? `score not refitted: all ${identity.same}/${identity.shared} values identical to Primary`
                : `score refitted: ${identity.shared - identity.same}/${identity.shared} values differ from Primary`
            }
          />
        )}
        <Chip
          size="small"
          variant="outlined"
          onClick={() => setLabelExemplars((v) => !v)}
          label={labelExemplars
            ? 'category exemplars labelled — click to hide'
            : 'category exemplars hidden — click to label'}
        />
      </Box>

      <PlotPanel
        data={stripTraces}
        height={540}
        layout={{
          xaxis: {
            title: view.soloAxis,
            range: xRange,
            zeroline: false,
          },
          yaxis: {
            // Category rows, printed-panel style. The range is pinned to the row
            // count so the strip does not rescale when a category drops out.
            tickmode: 'array',
            tickvals: strip.cats.map((c, i) => i),
            ticktext: strip.cats.map((c) => prettyCategory(c)),
            range: [-0.7, strip.cats.length - 0.3],
            zeroline: false,
            gridcolor: 'rgba(0,0,0,0.05)',
          },
          title: { text: `${spec.label} \u2014 ${view.label} \u2014 score alone`, font: { size: 13 } },
          shapes: noSkillShape,
          annotations: [
            ...(view.refLabel ? [{
              xref: 'x', x: view.refX, yref: 'paper', y: 1, xanchor: 'left', yanchor: 'top',
              text: view.refLabel, showarrow: false, font: { size: 10, color: '#999' },
            }] : []),
            ...stripAnnotations,
          ],
          showlegend: false,
          margin: { l: 155, r: 24, t: 34, b: 46 },
        }}
      />
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
        {catLegend}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 3 }}>
        Each dot is one exposure, jittered within its category row; the bar is its 95%
        bootstrap interval. The larger ringed point in each row is that category&rsquo;s
        labelled exemplar, matching the printed figure. Every exposure drawn here also
        appears in the table under plot 2, which carries the score-alone column.
      </Typography>

      <PlotHeading
        index={2}
        title="What the score adds beyond the covariates"
        note={
          'This is what the score adds, which every specification changes. Same layout as '
          + 'plot 1 \u2014 the same category rows, the same exposures \u2014 but x is now the '
          + 'gap between the two nested models: covariates alone, versus those covariates '
          + 'with the proteomic score added. A point on the zero line is an exposure the '
          + 'proteome cannot read beyond what the covariates already knew.'
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        <b>The bar on each point is the interval on the difference itself.</b> That is
        the reason this plot shows the gap rather than the two models side by side:
        the covariates-only and covariates + score models are fitted in the same
        people, so their errors move together and their two intervals can overlap
        while the difference is reliably above zero. In this view{' '}
        <b>{nOverlapReal}</b> exposures do exactly that. Reading overlap between the
        two model intervals is a stricter and wrong test; the interval drawn here is
        the right one, and it is also what the &Delta; column of the table reports.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Chip size="small" label={`${incPoints.length} ${view.type} exposures`} />
        <Chip
          size="small"
          color={nClear ? 'success' : 'default'}
          label={`${nClear} where the increment interval clears zero`}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`${incPoints.length - nClear} faded — increment interval includes zero`}
        />
      </Box>

      <PlotPanel
        data={deltaTraces}
        height={540}
        layout={{
          xaxis: {
            title: view.deltaAxis,
            range: deltaRange,
            zeroline: false,
          },
          yaxis: {
            tickmode: 'array',
            tickvals: deltaStrip.cats.map((c, i2) => i2),
            ticktext: deltaStrip.cats.map((c) => prettyCategory(c)),
            range: [-0.7, deltaStrip.cats.length - 0.3],
            zeroline: false,
            gridcolor: 'rgba(0,0,0,0.05)',
          },
          title: {
            text: `${spec.label} \u2014 ${view.label} \u2014 what the score adds`,
            font: { size: 13 },
          },
          shapes: [{
            // Zero is the whole reference here: the score bought nothing.
            type: 'line', xref: 'x', yref: 'paper',
            x0: 0, x1: 0, y0: 0, y1: 1,
            line: { dash: 'dash', width: 1, color: '#999' },
          }],
          annotations: [
            {
              xref: 'x', x: 0, yref: 'paper', y: 1, xanchor: 'left', yanchor: 'top',
              text: 'the score adds nothing', showarrow: false,
              font: { size: 10, color: '#999' },
            },
            ...deltaAnnotations,
          ],
          showlegend: false,
          margin: { l: 155, r: 24, t: 34, b: 46 },
        }}
      />

      <LinkedScatterTable
        points={incPoints}
        columns={incColumns}
        xTitle={`covariates alone \u2014 ${view.unit}`}
        yTitle={`covariates + the proteomic score \u2014 ${view.unit}`}
        title="The same exposures as a paired lookup"
        height={340}
        searchPlaceholder="Filter exposures or categories\u2026"
        rowsVisible={10}
        emptyNote="No exposures of this type at this specification."
        legend={catLegend}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Faded points in plot 2 are exposures whose increment interval includes zero — the gain is
        drawn at its estimated size, but it is not established. Continuous and binary exposures
        are scored on different metrics and are never plotted on the same axis: continuous
        exposures use held-out R², binary ones held-out AUC, and the AUPR view re-reads the same
        binary exposures on a metric that does not flatter a rare outcome. The export carries no
        per-exposure sample size, so prevalence stands in for it on the binary views. Every value
        is out of sample; a negative R² means the model predicted worse than the outcome mean.
      </Typography>
    </SectionCard>
  );
}
