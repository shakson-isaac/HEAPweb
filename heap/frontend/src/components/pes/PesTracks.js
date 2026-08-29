import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import LinkedScatterTable from '../LinkedScatterTable';
import { useSection } from '../../lib/useSection';
import { SPECS } from '../../lib/covariateSpecs';
import { ecatColor, prettyCategory, prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// Does the score track within-person change?
//
// Two plots, deliberately in this order.
//
// 1. The score itself, laid out like printed Fig. 6c (fig_m6_panel_c.R): the
//    within-person Δ-correlation per exposure with its bootstrap interval,
//    colored by category, the gray covariate benchmark alongside, read against
//    a dashed zero.
// 2. The same exposures as the two NESTED models -- covariates alone on x,
//    covariates plus the score on y -- with y = x drawn.
//
// The order is doing the work. `dcor_pes` is byte-identical across base,
// base_bmi, base_clinical and base_draw -- those specifications re-adjust the
// benchmark model, they do not refit the proteome score. Showing the score
// first makes that visible instead of hazardous: flip the picker and plot 1
// does not move a pixel while plot 2 does, which is the honest description of
// what the picker changes. base_exclprev restricts the sample and refits, so it
// is the one specification that moves plot 1 -- and the identity count under
// each plot is MEASURED from the loaded data, not asserted here, so it stays
// true if the export is rebuilt.
//
// Earlier versions of this panel plotted the Δ-correlation with no interval at
// all, so a point at 0 read as a demonstrated null when it was usually just an
// untested one. Plot 1 carries every interval.
//
// Plot 2 puts the two nested models on the two axes rather than plotting
// (both - covariates), because a difference of two correlations measured on the
// same people has no interval recoverable from the marginal intervals in this
// export: an axis of gains would be an axis of points with no error bars, in a
// panel whose premise is that every point has one. Here the gain is the rise
// above the diagonal and both models keep their real intervals.
//
// A ranked dumbbell was the other candidate and was rejected twice over.
// Drawing the connector as a layout shape breaks the component's search box --
// it filters its own trace and table but passes extraShapes through untouched,
// and axis-referenced shapes also pin the autorange, so a filtered plot would
// keep every connector painted. Drawing it in the error-bar channel (xlo =
// covariates, x = covariates + score) does filter correctly but renders the gain
// in the component's hardcoded gray interval bar -- the exact mark that means
// "95% interval" in plot 1, directly above on the same page. In a panel whose
// entire caveat is about misreading intervals, that collision is the worst
// available trade.
// ---------------------------------------------------------------------------

// SPECS now lives in lib/covariateSpecs.js -- four panels each had a copy and
// they had drifted apart in both labels and order.

// A Δ-correlation from a few dozen changed pairs is noise with an interval
// attached. Nothing is dropped for it -- low-n points are drawn faded and the
// count is on screen -- but the reader needs the cut-off named.
const MIN_CHANGE = 100;

// Always labeled in plot 1, as in the printed panel: pack-years reads almost
// perfectly cross-sectionally yet sits at zero here, because it is cumulative
// and cannot fall within a person. It is the cautionary case the plot exists
// to make, and it is never the category's top point, so it needs forcing.
const FORCE_LABEL = new Set(['pack_years_of_smoking_f20161_0_0']);

const GRAY = 'rgba(140,140,140,0.75)';

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt3 = (v) => (v == null ? '—' : v.toFixed(3));
const fmtN = (v) => (v == null ? '—' : v.toLocaleString());
const ci = (v, lo, hi) => (v == null ? '—' : `${fmt3(v)} [${fmt3(lo)}, ${fmt3(hi)}]`);

// Category color at reduced alpha, so a low-n point keeps its category
// identity while reading as provisional.
const fade = (hex, a) => {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  /* eslint-disable no-bitwise */
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  /* eslint-enable no-bitwise */
};

// Jitter keyed to the exposure id, not Math.random(): a fresh draw on every
// render would make the cloud twitch each time a toggle is flipped, and the
// reader would read motion as data.
const jitter01 = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    /* eslint-disable no-bitwise */
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
    /* eslint-enable no-bitwise */
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5;
};

const isLow = (r) => (r.n_change ?? 0) < MIN_CHANGE;
const colorOf = (r) => (isLow(r) ? fade(ecatColor(r.category), 0.35) : ecatColor(r.category));

const short = (s, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export default function PesTracks() {
  const { data, loading, error } = useSection('pes_tracking_ci');
  const [specId, setSpecId] = useState('base');
  const [hideLowN, setHideLowN] = useState(false);

  const spec = SPECS.find((s) => s.id === specId) || SPECS[0];

  const rows = useMemo(() => {
    if (!data?.exposure_id) return [];
    const out = [];
    for (let i = 0; i < data.exposure_id.length; i += 1) {
      out.push({
        exposure_id: data.exposure_id[i],
        spec: data.covariate_spec[i],
        category: data.category[i],
        exposure_type: data.exposure_type[i],
        n_person: num(data.n_person?.[i]),
        n_pairs: num(data.n_pairs?.[i]),
        n_change: num(data.n_change?.[i]),
        cov: num(data.dcor_covariates?.[i]),
        cov_lo: num(data.dcor_covariates_lo?.[i]),
        cov_hi: num(data.dcor_covariates_hi?.[i]),
        pes: num(data.dcor_pes?.[i]),
        pes_lo: num(data.dcor_pes_lo?.[i]),
        pes_hi: num(data.dcor_pes_hi?.[i]),
        both: num(data.dcor_covariates_plus_pes?.[i]),
        both_lo: num(data.dcor_covariates_plus_pes_lo?.[i]),
        both_hi: num(data.dcor_covariates_plus_pes_hi?.[i]),
      });
    }
    return out;
  }, [data]);

  const specRows = useMemo(
    () => rows.filter((r) => r.spec === specId && r.cov != null && r.pes != null),
    [rows, specId],
  );

  // Measured, not asserted: how many exposures carry exactly the Primary score
  // tracking under this specification. 129/129 means the picker moved nothing
  // about the score itself, which is what the plot-1 note says out loud.
  const identity = useMemo(() => {
    if (specId === 'base') return null;
    const base = new Map(rows.filter((r) => r.spec === 'base').map((r) => [r.exposure_id, r.pes]));
    let shared = 0;
    let same = 0;
    specRows.forEach((r) => {
      if (!base.has(r.exposure_id)) return;
      shared += 1;
      if (base.get(r.exposure_id) === r.pes) same += 1;
    });
    return { shared, same, differ: shared - same };
  }, [rows, specRows, specId]);

  const nLow = specRows.filter(isLow).length;

  // Row order is computed once over the WHOLE export, not per specification.
  // Ranking each specification's own medians reshuffled the rows whenever the
  // picker moved -- Smoking slid three rows between Primary and + BMI purely
  // because the two specifications carry slightly different exposure sets --
  // and a moving frame would have contradicted the very thing plot 1 is here to
  // show. Fixed rows mean the only thing that can move is the points.
  // Same reasoning for the x range: autoscaling it per specification would nudge
  // identical points a few pixels sideways as the benchmark's extremes changed,
  // and "identical" has to look identical. Computed over every specification.
  const xSpan = useMemo(() => {
    let lo = 0;
    let hi = 0.1;
    rows.forEach((r) => {
      [r.pes_lo, r.pes_hi, r.cov_lo, r.cov_hi].forEach((v) => {
        if (v == null) return;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      });
    });
    const pad = (hi - lo) * 0.05;
    return [lo - pad, hi + pad];
  }, [rows]);

  const catOrder = useMemo(() => {
    const byCat = new Map();
    rows.forEach((r) => {
      if (r.pes == null) return;
      if (!byCat.has(r.category)) byCat.set(r.category, []);
      byCat.get(r.category).push(r.pes);
    });
    return [...byCat.keys()].sort((a, b) => median(byCat.get(a)) - median(byCat.get(b)));
  }, [rows]);

  const shownRows = useMemo(
    () => (hideLowN ? specRows.filter((r) => !isLow(r)) : specRows),
    [specRows, hideLowN],
  );

  // --- plot 1: the score itself, one row per category ----------------------
  const strip = useMemo(() => {
    if (!shownRows.length) return null;
    const byCat = new Map();
    shownRows.forEach((r) => {
      if (!byCat.has(r.category)) byCat.set(r.category, []);
      byCat.get(r.category).push(r);
    });
    // Weakest-tracking category at the bottom, so the reader's eye climbs from
    // "no signal" to "moves with the exposure". Rows come from the whole
    // specification, not from what survives the low-n filter, so toggling that
    // filter empties a row rather than removing it.
    const present = new Set(specRows.map((r) => r.category));
    const cats = catOrder.filter((c) => present.has(c));
    const rowOf = new Map(cats.map((c, i) => [c, i]));

    // One exemplar per category (its strongest tracker) plus the forced
    // cautionary cases; exemplars sit centered on their row rather than
    // jittered, so the label always points at the row it belongs to.
    const exMap = new Map();
    cats.forEach((c) => {
      const inCat = byCat.get(c);
      if (!inCat || !inCat.length) return;
      const top = inCat.reduce((a, b) => (b.pes > a.pes ? b : a));
      exMap.set(top.exposure_id, top);
    });
    // Keyed by id, so a forced label that is also its category's top point is
    // labeled once rather than drawn twice at the same coordinates.
    shownRows.filter((r) => FORCE_LABEL.has(r.exposure_id)).forEach((r) => exMap.set(r.exposure_id, r));
    const exemplars = [...exMap.values()];
    const exIds = new Set(exMap.keys());
    const cloud = shownRows.filter((r) => !exIds.has(r.exposure_id));

    return { cats, rowOf, cloud, exemplars };
  }, [shownRows, specRows, catOrder]);

  // ---- plot 2: what the score ADDS, in plot 1's layout ---------------------
  // Same category rows, same exemplars, same jitter as plot 1; x is the gap
  // between the two nested models, cov+score minus cov.
  //
  // Drawn WITHOUT error bars on purpose. This export carries an interval for
  // each model but none for their difference, and a difference of two
  // correlations measured on the same people cannot be recovered from the
  // marginal intervals -- their errors move together. The reads panel does put
  // bars on its equivalent plot because its export ships heldout_increment_lo
  // and _hi; this one genuinely has no such column, and a borrowed bar would
  // assert a precision nobody computed.
  const deltaTraces = useMemo(() => {
    if (!strip) return [];
    const y = (r, centered) => strip.rowOf.get(r.category) + (centered ? 0 : jitter01(r.exposure_id) * 0.34);
    const gap = (r) => ((r.both == null || r.cov == null) ? null : r.both - r.cov);
    const custom = (arr) => arr.map((r) => [
      prettyExposure(r.exposure_id), prettyCategory(r.category),
      fmt3(r.cov), fmt3(r.both), fmtN(r.n_change),
    ]);
    const hov = '<b>%{customdata[0]}</b><br>gain %{x:+.3f} Δr'
      + '<br>covariates %{customdata[2]} → with score %{customdata[3]}'
      + '<br>%{customdata[4]} changed pairs<extra>%{customdata[1]}</extra>';
    const mk = (arr, centered, size, ring) => ({
      type: 'scatter',
      mode: 'markers',
      x: arr.map(gap),
      y: arr.map((r) => y(r, centered)),
      customdata: custom(arr),
      hovertemplate: hov,
      marker: {
        size,
        color: arr.map(colorOf),
        line: ring ? { width: 1.2, color: '#333' } : { width: 0 },
      },
      showlegend: false,
    });
    return [mk(strip.cloud, false, 7, false), mk(strip.exemplars, true, 11, true)];
  }, [strip]);

  const deltaSpan = useMemo(() => {
    if (!strip) return undefined;
    const all = [...strip.cloud, ...strip.exemplars]
      .map((r) => ((r.both == null || r.cov == null) ? null : r.both - r.cov))
      .filter((v) => v != null);
    if (!all.length) return undefined;
    // Zero always in frame -- it is the reference for "adds nothing".
    const lo = Math.min(0, ...all);
    const hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.08 || 0.02;
    return [lo - pad, hi + pad];
  }, [strip]);

  const stripTraces = useMemo(() => {
    if (!strip) return [];
    const y = (r, centered) => strip.rowOf.get(r.category) + (centered ? 0 : jitter01(r.exposure_id) * 0.34);
    const errBar = (arr, val, lo, hi, color) => ({
      type: 'data',
      symmetric: false,
      array: arr.map((r) => ((r[hi] ?? r[val]) - r[val])),
      arrayminus: arr.map((r) => (r[val] - (r[lo] ?? r[val]))),
      thickness: 1,
      width: 0,
      color,
    });
    const custom = (arr, lo, hi) => arr.map((r) => [
      prettyExposure(r.exposure_id), prettyCategory(r.category),
      fmt3(r[lo]), fmt3(r[hi]), fmtN(r.n_change), fmtN(r.n_pairs),
    ]);
    const hov = (what) => `<b>%{customdata[0]}</b><br>${what} Δr %{x:.3f} `
      + '[%{customdata[2]}, %{customdata[3]}]<br>%{customdata[4]} changed pairs '
      + 'of %{customdata[5]}<extra>%{customdata[1]}</extra>';

    // The benchmark is drawn first so the colored score sits on top of it,
    // matching the printed panel's reading order.
    return [
      {
        type: 'scatter',
        mode: 'markers',
        x: shownRows.map((r) => r.cov),
        y: shownRows.map((r) => y(r, false)),
        error_x: errBar(shownRows, 'cov', 'cov_lo', 'cov_hi', 'rgba(140,140,140,0.30)'),
        customdata: custom(shownRows, 'cov_lo', 'cov_hi'),
        hovertemplate: hov('covariate benchmark'),
        marker: { size: 5, color: GRAY, line: { width: 0 } },
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: strip.cloud.map((r) => r.pes),
        y: strip.cloud.map((r) => y(r, false)),
        error_x: errBar(strip.cloud, 'pes', 'pes_lo', 'pes_hi', 'rgba(120,120,120,0.35)'),
        customdata: custom(strip.cloud, 'pes_lo', 'pes_hi'),
        hovertemplate: hov('proteome score'),
        marker: {
          size: 7,
          color: strip.cloud.map(colorOf),
          line: { width: 0 },
        },
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: strip.exemplars.map((r) => r.pes),
        y: strip.exemplars.map((r) => y(r, true)),
        error_x: errBar(strip.exemplars, 'pes', 'pes_lo', 'pes_hi', 'rgba(60,60,60,0.55)'),
        customdata: custom(strip.exemplars, 'pes_lo', 'pes_hi'),
        hovertemplate: hov('proteome score'),
        marker: {
          size: 11,
          color: strip.exemplars.map(colorOf),
          line: { width: 1.2, color: '#333' },
        },
        showlegend: false,
      },
    ];
  }, [strip, shownRows]);

  const stripAnnotations = useMemo(() => {
    if (!strip) return [];
    const [lo, hi] = xSpan;
    const gap = (hi - lo) * 0.02;
    return strip.exemplars.map((r) => {
      const right = r.pes < lo + (hi - lo) * 0.6;
      return {
        x: r.pes + (right ? gap : -gap),
        y: strip.rowOf.get(r.category),
        xanchor: right ? 'left' : 'right',
        yanchor: 'middle',
        text: short(prettyExposure(r.exposure_id)),
        showarrow: false,
        font: { size: 10, color: '#222' },
        bgcolor: 'rgba(255,255,255,0.82)',
        borderpad: 2,
      };
    });
  }, [strip, xSpan]);

  // --- plot 2: the two nested models, covariates -> covariates + score -----
  // x and y are the two nested models, so the gain the score adds is the rise
  // above the diagonal -- visible as a distance without ever being committed to
  // an axis that this export cannot give an interval for.
  const points = useMemo(() => shownRows
    .filter((r) => r.both != null && r.cov != null)
    .map((r) => ({
      id: r.exposure_id,
      x: r.cov,
      xlo: r.cov_lo,
      xhi: r.cov_hi,
      y: r.both,
      ylo: r.both_lo,
      yhi: r.both_hi,
      label: prettyExposure(r.exposure_id),
      color: colorOf(r),
      meta: {
        category: prettyCategory(r.category),
        exposure_type: r.exposure_type,
        cov_ci: ci(r.cov, r.cov_lo, r.cov_hi),
        both_ci: ci(r.both, r.both_lo, r.both_hi),
        gain: r.both - r.cov,
        pes_ci: ci(r.pes, r.pes_lo, r.pes_hi),
        n_person: r.n_person,
        n_pairs: r.n_pairs,
        n_change: r.n_change,
      },
    })), [shownRows]);

  // One diagonal spanning everything actually drawn, intervals included, so the
  // reference line never stops short of the points it is meant to judge.
  const columns = [
    { key: 'label', label: 'Exposure', wrap: true, from: (p) => p.label },
    { key: 'category', label: 'Category' },
    { key: 'exposure_type', label: 'Type' },
    { key: 'cov_ci', label: 'Δr covariates [95% CI]', align: 'right' },
    { key: 'both_ci', label: 'Δr covariates + score [95% CI]', align: 'right' },
    // The rise above the diagonal, written out. Labeled as having no interval
    // because it has none: the export gives none for a difference of
    // correlations, which is the whole reason it is not an axis.
    { key: 'gain', label: 'Gain (no interval)', align: 'right', format: fmt3 },
    { key: 'pes_ci', label: 'Δr score [95% CI]', align: 'right' },
    { key: 'n_person', label: 'People', align: 'right', format: fmtN },
    { key: 'n_pairs', label: 'Visit pairs', align: 'right', format: fmtN },
    {
      key: 'n_change',
      label: 'Changed pairs',
      align: 'right',
      // The column that decides whether any of the others mean anything.
      format: (v) => (v == null ? '—' : `${v.toLocaleString()}${v < MIN_CHANGE ? ' ⚠' : ''}`),
    },
  ];

  // The plot-1 note reads the identity count off the data, so the specification
  // caveat is demonstrated by the number rather than claimed by the prose.
  const plotOneNote = () => {
    if (!identity) {
      return 'This is the score’s own tracking, read against zero rather than against the '
        + 'covariates. Switching to + BMI, + clinical or + blood draw will not move a single '
        + 'point here — those specifications re-adjust the gray benchmark and do not refit '
        + 'the score. Healthy at baseline is the only one that changes this plot.';
    }
    if (spec.refits) {
      return 'This is the one specification that moves this plot: restricting to participants '
        + 'without prevalent major disease changes the sample, so the score is refitted and '
        + `${identity.differ} of the ${identity.shared} exposures it shares with Primary carry a `
        + 'different Δ-correlation. Compare it against Primary to see how much of the tracking '
        + 'survives in people who were healthy at baseline.';
    }
    return `Nothing in this plot moved. Measured against Primary, ${identity.same} of the `
      + `${identity.shared} exposures it shares with Primary carry a byte-identical `
      + `Δ-correlation: “${spec.label}” re-adjusts the gray covariate benchmark and does not `
      + 'refit the proteome score, so the colored points are the same numbers under a different '
      + 'label. Healthy at baseline is the only specification that refits the score.';
  };

  const plotTwoNote = 'The two nested models as the two axes: x is how well the covariates '
    + 'alone track within-person change, y is how well they track it once the proteome score is '
    + 'added. A point on the diagonal means the score added nothing; the distance above the '
    + 'diagonal is the gain. Unlike the plot above, every specification moves both coordinates — '
    + 're-adjusting the covariates is exactly what + BMI, + clinical and + blood draw do.';

  return (
    <SectionCard
      title="Does the score track within-person change?"
      subtitle={
        'Δ-correlation per exposure: how strongly the change in a person’s proteome score '
        + 'between visits moves with the change in their actual exposure, with a 95% bootstrap '
        + 'interval on every point. First the score on its own, against zero, as in the printed '
        + 'panel; then the two nested models side by side — what the covariates track within a '
        + 'person, and what they track once the score is added.'
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
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        {spec.note}
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        <b>Two plots, and the picker moves only one of them.</b> Plot 1 is the score itself:
        under <b>Primary</b>, <b>+ BMI</b>, <b>+ clinical</b> and <b>+ blood draw</b> the
        proteome score is never refitted, so its Δ-correlation is identical by construction and
        plot 1 does not change. Only <b>Healthy at baseline</b> restricts the sample, refits the
        score and moves it. Plot 2 compares the two nested models — covariates alone against
        covariates plus the score — and every specification moves both of its axes, because
        re-adjusting the covariates is all these specifications do. Flip the picker and watch
        which plot responds.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Chip size="small" label={`${specRows.length} exposures at this specification`} />
        {identity && (
          <Chip
            size="small"
            color={identity.same === identity.shared ? 'warning' : 'success'}
            variant={identity.same === identity.shared ? 'filled' : 'outlined'}
            label={
              identity.same === identity.shared
                ? `score unchanged vs Primary: ${identity.same}/${identity.shared} exposures identical`
                : `score refitted: ${identity.differ}/${identity.shared} exposures differ from Primary`
            }
          />
        )}
        <Chip
          size="small"
          variant="outlined"
          onClick={() => setHideLowN((v) => !v)}
          label={
            hideLowN
              ? `${nLow} exposures with <${MIN_CHANGE} changed pairs are HIDDEN — click to show`
              : `${nLow} exposures have <${MIN_CHANGE} changed pairs (faded) — click to hide`
          }
        />
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>
        1. The score itself — {spec.label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        Colored = proteome score, gray = covariate benchmark, bars = 95% bootstrap interval,
        dashed line at 0 = no tracking. One exemplar is labeled per category.
      </Typography>
      {strip && (
        <PlotPanel
          data={stripTraces}
          height={Math.max(360, strip.cats.length * 44 + 110)}
          layout={{
            xaxis: {
              title: 'within-person Δ-correlation (Δ score vs Δ exposure)',
              range: xSpan,
            },
            yaxis: {
              tickmode: 'array',
              tickvals: strip.cats.map((c, i) => i),
              ticktext: strip.cats.map(prettyCategory),
              range: [-0.7, strip.cats.length - 0.3],
            },
            shapes: [{
              type: 'line', xref: 'x', yref: 'paper',
              x0: 0, x1: 0, y0: 0, y1: 1,
              line: { dash: 'dash', width: 1, color: '#bdbdbd' },
            }],
            annotations: stripAnnotations,
            margin: { l: 140, r: 24, t: 24, b: 60 },
            showlegend: false,
          }}
        />
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
        {plotOneNote()} Every exposure drawn here is listed, with its interval, in the table
        under plot 2 — one table serves both plots rather than printing the same 130 rows twice.
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        2. Covariates alone vs covariates + the score — {spec.label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
        {plotTwoNote}
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
          <b>These points carry no interval, and that is deliberate.</b> Each model
          has one &mdash; the covariate benchmark and the benchmark plus the score
          both do, and plot 1 shows them &mdash; but this export carries no interval
          for the <i>gap</i> between them, and a difference of two correlations
          measured on the same people cannot be recovered from the two marginal
          intervals, because their errors move together. So read the distance from
          zero as how much the score adds, and do not read this plot as telling you
          whether that gain is distinguishable from zero. It cannot.
        </Alert>

        {strip && (
          <PlotPanel
            data={deltaTraces}
            height={Math.max(360, strip.cats.length * 44 + 110)}
            layout={{
              xaxis: {
                title: 'gain in within-person Δ-correlation — (covariates + PES) − covariates',
                range: deltaSpan,
                zeroline: false,
              },
              yaxis: {
                tickmode: 'array',
                tickvals: strip.cats.map((c, i2) => i2),
                ticktext: strip.cats.map(prettyCategory),
                range: [-0.7, strip.cats.length - 0.3],
                zeroline: false,
              },
              shapes: [{
                type: 'line', xref: 'x', yref: 'paper',
                x0: 0, x1: 0, y0: 0, y1: 1,
                line: { dash: 'dash', width: 1, color: '#bdbdbd' },
              }],
              annotations: [{
                xref: 'x', x: 0, yref: 'paper', y: 1, xanchor: 'left', yanchor: 'top',
                text: 'the score adds nothing', showarrow: false,
                font: { size: 10, color: '#999' },
              }],
              showlegend: false,
              margin: { l: 155, r: 24, t: 24, b: 46 },
            }}
          />
        )}

        <LinkedScatterTable
          points={points}
          columns={columns}
          xTitle="Δ-correlation — covariates alone"
          yTitle="Δ-correlation — covariates + proteome score"
          title="The same exposures as a paired lookup"
          height={340}
          searchPlaceholder="Filter exposures or categories…"
          rowsVisible={12}
          emptyNote="No exposures at this specification."
        />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        One table for both plots: it carries all three Δ-correlations with their intervals, and
        the Gain column is the rise above the diagonal written out — it has no interval, for the
        reason above. Faded points and the ⚠ in the last column mark exposures measured on fewer
        than {MIN_CHANGE} visit pairs in which the exposure actually changed — their intervals
        are wide and their point estimates should not be ranked. None are dropped unless you hide
        them above.
      </Typography>
    </SectionCard>
  );
}
