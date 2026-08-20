import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import LinkedScatterTable from '../LinkedScatterTable';
import { useSection } from '../../lib/useSection';
import { ecatColor, prettyCategory, prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// Does the proteome READ the exposure?
//
// Two things went wrong in the version this replaces. The accuracy was plotted
// bare, so a score at R² = 0.02 and a score at R² = 0.02 ± 0.06 looked like the
// same claim; every point here carries its 95% interval on both axes.
//
// The second is subtler and constrains the whole design. `heldout_proteome_only`
// is byte-identical across base, base_bmi, base_clinical and base_draw -- those
// specifications change what the COVARIATE BENCHMARK adjusts for, they do not
// refit the proteomic score. Plotting proteome-only against the specification
// picker would print one number under four different labels and invite the
// reader to conclude the score survived an adjustment it never faced.
//
// So the plotted quantity is the INCREMENT over covariates, which is the only
// thing the picker legitimately moves, drawn against the covariate benchmark on
// x so the movement is visible rather than asserted. base_exclprev is the one
// specification that restricts the sample and genuinely refits the score; the
// identity chip below measures that from the data rather than claiming it, so
// it stays honest if the export is rebuilt.
// ---------------------------------------------------------------------------

// From HEAP/config/covariates/covariate_sets.yml. `base` is PRIMARY and is what
// the printed figures use; the rest are sensitivity layers on top of it.
const SPECS = [
  { id: 'base', label: 'Primary (base)',
    note: 'base: age, age², sex, their interactions, assessment centre, 20 genetic PCs' },
  { id: 'base_bmi', label: '+ BMI',
    note: 'base + BMI in the covariate benchmark. A sensitivity layer, not a mediation test — attenuation here cannot separate mediation from confounding' },
  { id: 'base_clinical', label: '+ clinical',
    note: 'base + BMI, fasting time, season and medication classes (maximal explicit adjustment)' },
  { id: 'base_draw', label: '+ blood draw',
    note: 'base + fasting time and assessment season' },
  { id: 'base_exclprev', label: 'Healthy at baseline',
    note: 'base, restricted to participants without prevalent major disease — the sample changes, so the score is refitted' },
];

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
    // No-information point for an out-of-sample R²: a model no better than the
    // outcome mean. Held-out R² can and does go negative, so this is a real
    // line, not a plot boundary.
    refX: 0,
    refLabel: 'covariates no better than the mean',
  },
  {
    id: 'bin_auc',
    label: 'Binary — AUC',
    type: 'binary',
    prefix: 'heldout',
    unit: 'held-out AUC',
    refX: 0.5,
    refLabel: 'covariates at chance',
  },
  {
    id: 'bin_aupr',
    label: 'Binary — AUPR',
    type: 'binary',
    prefix: 'aupr',
    unit: 'held-out AUPR',
    // No vertical reference: the no-skill AUPR is the exposure's own
    // prevalence, so it differs per point and a single line would be a lie.
    // The lift-over-prevalence column carries that comparison instead.
    refX: null,
  },
];

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt3 = (v) => (v == null ? '—' : v.toFixed(3));
const ci = (v, lo, hi) => (v == null ? '—' : `${fmt3(v)} [${fmt3(lo)}, ${fmt3(hi)}]`);
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`);
const pctCi = (v, lo, hi) => `${pct(v)} [${pct(lo)}, ${pct(hi)}]`;

export default function PesReads() {
  const { data, loading, error } = useSection('pes_reads_ci');
  const [specId, setSpecId] = useState('base');
  const [viewId, setViewId] = useState('cont_r2');

  const spec = SPECS.find((s) => s.id === specId) || SPECS[0];
  const view = VIEWS.find((v) => v.id === viewId) || VIEWS[0];

  // Read the columnar blob once into records; the picker then only filters,
  // so switching specification or view never re-walks 814 rows of arrays.
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
      && r[`${view.prefix}_covariates_only`] != null
      && r[`${view.prefix}_increment`] != null,
  ), [rows, specId, view]);

  // Measured, not asserted: how many exposures carry exactly the Primary
  // proteome-only accuracy under this specification. All of them means the
  // picker moved the benchmark and nothing else.
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

  // The count that survives the intervals: an exposure the proteome reads
  // beyond covariates is one whose increment interval clears zero.
  const nClear = viewRows.filter((r) => (r[`${view.prefix}_increment_lo`] ?? -1) > 0).length;

  const points = useMemo(() => viewRows.map((r) => {
    const p = view.prefix;
    return {
      id: r.exposure_id,
      x: r[`${p}_covariates_only`],
      xlo: r[`${p}_covariates_only_lo`],
      xhi: r[`${p}_covariates_only_hi`],
      y: r[`${p}_increment`],
      ylo: r[`${p}_increment_lo`],
      yhi: r[`${p}_increment_hi`],
      label: prettyExposure(r.exposure_id),
      color: ecatColor(r.category),
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
  }), [viewRows, view]);

  const columns = useMemo(() => {
    const base = [
      { key: 'label', label: 'Exposure', wrap: true, from: (p) => p.label },
      { key: 'category', label: 'Category' },
      { key: 'increment_ci', label: `Δ ${view.unit} over covariates [95% CI]`, align: 'right' },
      { key: 'cov_ci', label: 'Covariates only [95% CI]', align: 'right' },
      { key: 'both_ci', label: 'Covariates + PES [95% CI]', align: 'right' },
      { key: 'prot_ci', label: 'Proteome only [95% CI]', align: 'right' },
    ];
    // Binary exposures only: prevalence is the denominator that decides whether
    // a high AUC means anything, and it stands in for the per-exposure sample
    // size, which this export does not carry.
    if (view.type === 'binary') {
      base.push({ key: 'prevalence', label: 'Prevalence [95% CI]', align: 'right' });
    }
    if (view.prefix === 'aupr') {
      base.push({
        key: 'lift', label: 'AUPR ÷ prevalence', align: 'right', format: (v) => (v == null ? '—' : v.toFixed(2)),
      });
    }
    return base;
  }, [view]);

  const cats = useMemo(() => {
    const seen = new Map();
    viewRows.forEach((r) => { if (!seen.has(r.category)) seen.set(r.category, ecatColor(r.category)); });
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [viewRows]);

  return (
    <SectionCard
      title="Does the proteome read the exposure?"
      subtitle={
        'One point per exposure, with its 95% interval on both axes. The x axis is what the '
        + 'covariate block alone achieves out of sample; the y axis is what the proteomic '
        + 'exposure score adds on top of it. A point on the zero line is an exposure the '
        + 'proteome cannot read beyond age, sex and assessment centre.'
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

      <Alert severity="warning" sx={{ mb: 2 }}>
        <b>What this picker asks.</b> Changing the covariate set does <b>not</b> retrain the
        proteomic score. Under <b>Primary</b>, <b>+ BMI</b>, <b>+ clinical</b> and{' '}
        <b>+ blood draw</b> the score is one fixed model and only the covariate benchmark it is
        measured against moves, so the question the picker answers is “does this one fixed score
        still add beyond a richer covariate block?” — which is why this panel plots the{' '}
        <b>increment over covariates</b> rather than the proteome-only accuracy. Plotting the
        latter would print the identical number under four different labels.{' '}
        <b>Healthy at baseline</b> is the only specification here that restricts the sample and
        genuinely refits the score.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Chip size="small" label={`${viewRows.length} ${view.type} exposures`} />
        <Chip
          size="small"
          color={nClear ? 'success' : 'default'}
          label={`${nClear} with an increment interval clear of zero`}
        />
        {identity && (
          <Chip
            size="small"
            color={identity.same === identity.shared ? 'warning' : 'success'}
            variant={identity.same === identity.shared ? 'filled' : 'outlined'}
            label={
              identity.same === identity.shared
                ? `score not refitted: ${identity.same}/${identity.shared} proteome-only values identical to Primary`
                : `score refitted: ${identity.shared - identity.same}/${identity.shared} proteome-only values differ from Primary`
            }
          />
        )}
      </Box>

      <LinkedScatterTable
        points={points}
        columns={columns}
        xTitle={`covariates alone — ${view.unit}`}
        yTitle={`gain from the proteomic score — Δ ${view.unit}`}
        title={`${spec.label} — ${view.label}`}
        height={500}
        searchPlaceholder="Filter exposures or categories…"
        rowsVisible={12}
        emptyNote="No exposures of this type at this specification."
        extraShapes={[
          // Zero increment: the proteome adds nothing the covariates did not
          // already have. This is the line the whole panel is read against.
          {
            type: 'line', xref: 'paper', yref: 'y',
            x0: 0, x1: 1, y0: 0, y1: 0,
            line: { dash: 'dash', width: 1, color: '#999' },
          },
          ...(view.refX == null ? [] : [{
            type: 'line', xref: 'x', yref: 'paper',
            x0: view.refX, x1: view.refX, y0: 0, y1: 1,
            line: { width: 1, color: '#e0e0e0' },
          }]),
        ]}
        extraAnnotations={[
          {
            xref: 'paper', x: 0, yref: 'y', y: 0, xanchor: 'left', yanchor: 'bottom',
            text: 'proteome adds nothing', showarrow: false, font: { size: 10, color: '#777' },
          },
          ...(view.refX == null ? [] : [{
            xref: 'x', x: view.refX, yref: 'paper', y: 1, xanchor: 'left', yanchor: 'top',
            text: view.refLabel, showarrow: false, font: { size: 10, color: '#999' },
          }]),
        ]}
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
        Continuous and binary exposures are scored on different metrics and are never plotted on
        the same axis: continuous exposures use held-out R², binary ones held-out AUC, and the
        AUPR view re-reads the same binary exposures on a metric that does not flatter a rare
        outcome. The export carries no per-exposure sample size, so prevalence stands in for it
        on the binary views. Every value is out of sample; a negative R² means the model
        predicted worse than the outcome mean.
      </Typography>
    </SectionCard>
  );
}
