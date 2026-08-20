import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import LinkedScatterTable from '../LinkedScatterTable';
import { useSection } from '../../lib/useSection';
import { ecatColor, prettyCategory, prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// Does the score track within-person change?
//
// The Δ-correlation asks whether a change in a person's proteome score between
// visits moves with the change in their actual exposure. The earlier version of
// this panel plotted that number bare, with no interval -- so a point at 0 read
// as a demonstrated null when it was usually just an untested one. Every point
// here carries its bootstrap interval on both axes.
//
// The harder problem is the covariate-specification picker. `dcor_pes` is
// byte-identical across base, base_bmi, base_clinical and base_draw: those
// specifications change what the *benchmark* model adjusts for, they do not
// refit the proteome score. Plotting dcor_pes against the spec picker would
// therefore show one number under four different labels and invite the reader
// to conclude the score survived an adjustment it was never subjected to.
//
// So both views plot a CONTRAST against the covariate benchmark, with y = x
// drawn: what moves when you change the specification is the x axis, visibly.
// base_exclprev is the one specification that restricts the sample and refits
// the score, and the identity chip below measures that from the data rather
// than asserting it, so it stays true if the export is rebuilt.
// ---------------------------------------------------------------------------

// From HEAP/config/covariates/covariate_sets.yml. `base` is PRIMARY; the rest
// are sensitivity layers on top of it.
const SPECS = [
  { id: 'base', label: 'Primary (base)', refits: false,
    note: 'base: age, age², sex, their interactions, assessment centre, 20 genetic PCs' },
  { id: 'base_bmi', label: '+ BMI', refits: false,
    note: 'base + BMI in the covariate benchmark. A sensitivity layer, not a mediation test' },
  { id: 'base_clinical', label: '+ clinical', refits: false,
    note: 'base + BMI, fasting time, season and medication classes (maximal explicit adjustment)' },
  { id: 'base_draw', label: '+ blood draw', refits: false,
    note: 'base + fasting time and assessment season' },
  { id: 'base_exclprev', label: 'Healthy at baseline', refits: true,
    note: 'base, restricted to participants without prevalent major disease — the sample changes, so the score is refitted' },
];

const VIEWS = [
  {
    id: 'score',
    label: 'Score vs covariates',
    yKey: 'dcor_pes',
    yTitle: 'Δ-correlation — proteome score alone',
    blurb: 'Above the diagonal: the proteome score tracks within-person change better than '
      + 'age, sex and the rest of the covariate benchmark do on their own.',
  },
  {
    id: 'joint',
    label: 'Covariates + score vs covariates',
    yKey: 'dcor_covariates_plus_pes',
    yTitle: 'Δ-correlation — covariates + proteome score',
    blurb: 'Vertical distance above the diagonal is the increment the score adds on top of '
      + 'the covariates. Plotted as two intervals rather than one difference: the interval '
      + 'on a difference of two correlations from the same people is not recoverable from '
      + 'the marginal intervals in the export.',
  },
];

// A Δ-correlation from a few dozen changed pairs is noise with an interval
// attached. Nothing is dropped for it -- low-n points are drawn faded and the
// count is on screen -- but the reader needs the cut-off named.
const MIN_CHANGE = 100;

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt3 = (v) => (v == null ? '—' : v.toFixed(3));
const fmtN = (v) => (v == null ? '—' : v.toLocaleString());
const ci = (v, lo, hi) => (v == null ? '—' : `${fmt3(v)} [${fmt3(lo)}, ${fmt3(hi)}]`);

// Category colour at reduced alpha, so a low-n point keeps its category
// identity while reading as provisional.
const fade = (hex, a) => {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  /* eslint-disable no-bitwise */
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  /* eslint-enable no-bitwise */
};

export default function PesTracks() {
  const { data, loading, error } = useSection('pes_tracking_ci');
  const [specId, setSpecId] = useState('base');
  const [viewId, setViewId] = useState('score');
  const [hideLowN, setHideLowN] = useState(false);

  const spec = SPECS.find((s) => s.id === specId) || SPECS[0];
  const view = VIEWS.find((v) => v.id === viewId) || VIEWS[0];

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
  // about the score itself.
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
    return { shared, same };
  }, [rows, specRows, specId]);

  const nLow = specRows.filter((r) => (r.n_change ?? 0) < MIN_CHANGE).length;

  const points = useMemo(() => {
    const keep = hideLowN
      ? specRows.filter((r) => (r.n_change ?? 0) >= MIN_CHANGE)
      : specRows;
    return keep.map((r) => {
      const low = (r.n_change ?? 0) < MIN_CHANGE;
      const y = view.id === 'score' ? r.pes : r.both;
      const ylo = view.id === 'score' ? r.pes_lo : r.both_lo;
      const yhi = view.id === 'score' ? r.pes_hi : r.both_hi;
      return {
        id: r.exposure_id,
        x: r.cov,
        xlo: r.cov_lo,
        xhi: r.cov_hi,
        y,
        ylo,
        yhi,
        label: prettyExposure(r.exposure_id),
        color: low ? fade(ecatColor(r.category), 0.35) : ecatColor(r.category),
        meta: {
          category: prettyCategory(r.category),
          exposure_type: r.exposure_type,
          pes_ci: ci(r.pes, r.pes_lo, r.pes_hi),
          cov_ci: ci(r.cov, r.cov_lo, r.cov_hi),
          both_ci: ci(r.both, r.both_lo, r.both_hi),
          n_person: r.n_person,
          n_pairs: r.n_pairs,
          n_change: r.n_change,
        },
      };
    });
  }, [specRows, view, hideLowN]);

  // One diagonal spanning everything actually drawn, intervals included, so the
  // reference line never stops short of the points it is meant to judge.
  const span = useMemo(() => {
    let lo = 0;
    let hi = 0.1;
    points.forEach((p) => {
      [p.x, p.xlo, p.xhi, p.y, p.ylo, p.yhi].forEach((v) => {
        if (v == null) return;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      });
    });
    const pad = (hi - lo) * 0.04;
    return [lo - pad, hi + pad];
  }, [points]);

  const columns = [
    { key: 'label', label: 'Exposure', wrap: true, from: (p) => p.label },
    { key: 'category', label: 'Category' },
    { key: 'exposure_type', label: 'Type' },
    { key: 'pes_ci', label: 'Δr score [95% CI]', align: 'right' },
    { key: 'cov_ci', label: 'Δr covariates [95% CI]', align: 'right' },
    { key: 'both_ci', label: 'Δr covariates + score [95% CI]', align: 'right' },
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

  const cats = useMemo(() => {
    const seen = new Map();
    specRows.forEach((r) => { if (!seen.has(r.category)) seen.set(r.category, ecatColor(r.category)); });
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [specRows]);

  return (
    <SectionCard
      title="Does the score track within-person change?"
      subtitle={
        'Δ-correlation per exposure: how strongly the change in a person’s proteome score '
        + 'between visits moves with the change in their actual exposure. Each point carries '
        + 'its 95% interval on both axes, and both axes are a contrast — the covariate '
        + 'benchmark on x, the proteome score on y, with y = x drawn. A point on the '
        + 'diagonal adds nothing to what age, sex and centre already track.'
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
            View
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

      <Alert severity="warning" sx={{ mb: 2 }}>
        <b>What this picker does and does not change.</b> Under <b>Primary</b>, <b>+ BMI</b>,{' '}
        <b>+ clinical</b> and <b>+ blood draw</b> the proteome score is not refitted — those
        specifications change only the covariate benchmark it is compared against, so the
        score’s own Δ-correlation is identical by construction across all four: the same number
        under four labels. Only the covariate axis moves. <b>Healthy at baseline</b> restricts
        the sample and refits the score, so it is the only specification here that is a genuine
        retraining check. That is why both views plot the score against the covariate benchmark
        rather than plotting the score’s tracking on its own.
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
                : `score refitted: ${identity.shared - identity.same}/${identity.shared} exposures differ from Primary`
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

      <LinkedScatterTable
        points={points}
        columns={columns}
        xTitle="Δ-correlation — covariates alone"
        yTitle={view.yTitle}
        title={`${spec.label} — ${view.label}`}
        height={500}
        searchPlaceholder="Filter exposures or categories…"
        rowsVisible={12}
        emptyNote="No exposures at this specification."
        extraShapes={[
          {
            type: 'line', xref: 'x', yref: 'y',
            x0: span[0], y0: span[0], x1: span[1], y1: span[1],
            line: { dash: 'dash', width: 1, color: '#999' },
          },
          // Zero on either axis is "does not track at all"; worth marking
          // separately from the diagonal because several exposures sit there.
          {
            type: 'line', xref: 'x', yref: 'paper',
            x0: 0, x1: 0, y0: 0, y1: 1,
            line: { width: 1, color: '#e0e0e0' },
          },
          {
            type: 'line', xref: 'paper', yref: 'y',
            x0: 0, x1: 1, y0: 0, y1: 0,
            line: { width: 1, color: '#e0e0e0' },
          },
        ]}
        extraAnnotations={[{
          x: span[1], y: span[1], xanchor: 'right', yanchor: 'top',
          text: 'y = x', showarrow: false, font: { size: 10, color: '#777' },
        }]}
        legend={
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {cats.map(([c, col]) => (
              <Box key={c} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: col }} />
                <Typography variant="caption" color="text.secondary">{prettyCategory(c)}</Typography>
              </Box>
            ))}
          </Box>
        }
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {view.blurb} Faded points and the ⚠ in the last table column mark exposures measured on
        fewer than {MIN_CHANGE} visit pairs in which the exposure actually changed — their
        intervals are wide and their point estimates should not be ranked. None are dropped
        unless you hide them above.
      </Typography>
    </SectionCard>
  );
}
