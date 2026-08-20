import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import LinkedScatterTable from '../LinkedScatterTable';
import { useSection } from '../../lib/useSection';
import { ecatColor, prettyCategory, prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// Reads x tracks -- the two things a proteomic exposure score has to do, on one
// pair of axes.
//
//   x  how well the proteome alone reads the exposure in held-out people
//   y  how well that same score follows a person's own change between visits
//
// The earlier version of this scatter colored points by whether the exposure
// also bought a disease C-index gain, so the first thing the eye read was a
// third, unrelated result, and every exposure without a disease evaluation was
// drawn as a hollow ring -- present, but visually demoted for a reason that has
// nothing to do with either axis. Color here is exposure category and nothing
// else, and no disease section is loaded.
//
// What replaces the highlight is the interval. Both exports ship 95% bootstrap
// CIs, and a point at 0.30 spanning 0.05-0.55 is not the claim that a point at
// 0.30 spanning 0.28-0.32 is; the old panel drew them identically and invited a
// rank order the data does not support.
//
// Continuous and binary exposures never share an axis: the reads export scores
// them with different metrics (R2 vs AUC), so they get a toggle instead of one
// axis that would quietly equate an AUC of 0.6 with an R2 of 0.6.
//
// Sections: pes_reads_ci and pes_tracking_ci, joined on exposure_id within one
// covariate specification -- both carry all five, and crossing them would
// compare a score to a benchmark it was never fit against.
// ---------------------------------------------------------------------------

const SPECS = [
  { id: 'base', label: 'base' },
  { id: 'base_bmi', label: '+ BMI' },
  { id: 'base_draw', label: '+ draw' },
  { id: 'base_clinical', label: '+ clinical' },
  { id: 'base_exclprev', label: 'excl. prevalent' },
];

const TYPES = [
  { id: 'continuous', label: 'Continuous' },
  { id: 'binary', label: 'Binary' },
];

// What the reads export means by `metric`, and where "no skill" sits on it --
// an R2 of 0 and an AUC of 0.5 are the same statement about a score.
const METRIC = {
  R2: { label: 'held-out R²', noSkill: 0 },
  AUC: { label: 'held-out AUC', noSkill: 0.5 },
};

// prettyExposure() cuts everything after the UKB field code, which is right for
// a plain field and wrong for a one-hot level: the three alcohol-drinker-status
// points all come back as "Alcohol drinker status", and a lookup table whose job
// is to tell one point from another cannot print the same name three times. Keep
// the level (`..._f20117_0_0_Current`, `..._f6179_0_0.multi_Calcium`); with it
// all 167 exposure ids in this export get a distinct label.
// prettyExposure keeps the one-hot level itself now, so the local wrapper
// that used to re-append it would print the level twice.

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const f3 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(3));
const ci = (v, lo, hi) => `${f3(v)} [${f3(lo)}, ${f3(hi)}]`;
const int = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString());

export default function PesReadVsTrack() {
  const reads = useSection('pes_reads_ci');
  const tracks = useSection('pes_tracking_ci');
  const [spec, setSpec] = useState('base');
  // Continuous opens the panel: the y axis is a correlation between two changes,
  // and for a binary exposure the change in the exposure is confined to {-1,0,1},
  // which is the harder version of the same plot to read first.
  const [etype, setEtype] = useState('continuous');

  const built = useMemo(() => {
    if (!reads.data?.exposure_id || !tracks.data?.exposure_id) return null;
    const R = reads.data;
    const T = tracks.data;

    const track = new Map();
    for (let i = 0; i < T.exposure_id.length; i += 1) {
      if (T.covariate_spec[i] !== spec) continue;
      track.set(T.exposure_id[i], {
        y: num(T.dcor_pes[i]),
        ylo: num(T.dcor_pes_lo[i]),
        yhi: num(T.dcor_pes_hi[i]),
        nPerson: num(T.n_person[i]),
        nPairs: num(T.n_pairs[i]),
        nChange: num(T.n_change[i]),
      });
    }

    const rows = [];
    const dropped = [];
    const inReads = new Set();
    for (let i = 0; i < R.exposure_id.length; i += 1) {
      if (R.covariate_spec[i] !== spec) continue;
      const id = R.exposure_id[i];
      inReads.add(id);
      const category = R.category[i] || 'Other';
      const t = track.get(id);
      const x = num(R.heldout_proteome_only[i]);
      if (!t || t.y === null || x === null) {
        dropped.push({ id, category, type: R.exposure_type[i] });
        continue;
      }
      rows.push({
        id,
        label: prettyExposure(id),
        type: R.exposure_type[i],
        metric: R.metric[i],
        category,
        color: ecatColor(category),
        x,
        xlo: num(R.heldout_proteome_only_lo[i]),
        xhi: num(R.heldout_proteome_only_hi[i]),
        y: t.y,
        ylo: t.ylo,
        yhi: t.yhi,
        meta: {
          exposure_id: id,
          category: prettyCategory(category),
          n_person: t.nPerson,
          n_pairs: t.nPairs,
          n_change: t.nChange,
        },
      });
    }

    // A tracking row with no reads row would vanish just as silently as the
    // reverse; count it rather than assume the export is one-directional.
    const orphanTracked = [...track.keys()].filter((id) => !inReads.has(id));

    const byCat = {};
    dropped.forEach((d) => { byCat[d.category] = (byCat[d.category] || 0) + 1; });

    return {
      rows,
      dropped,
      droppedByCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
      orphanTracked,
      nReads: inReads.size,
    };
  }, [reads.data, tracks.data, spec]);

  const view = useMemo(() => {
    if (!built) return null;
    const points = built.rows
      .filter((r) => r.type === etype)
      // Best tracker first, so the table opens on the scores that actually
      // follow a person rather than on whatever sorted alphabetically.
      .sort((a, b) => b.y - a.y);
    const metrics = [...new Set(points.map((p) => p.metric))];
    return { points, metrics };
  }, [built, etype]);

  const metricKey = view?.metrics.length === 1 ? view.metrics[0] : null;
  const metricLabel = metricKey && METRIC[metricKey] ? METRIC[metricKey].label : 'held-out score';
  const noSkill = metricKey && METRIC[metricKey] ? METRIC[metricKey].noSkill : null;

  const legend = useMemo(() => {
    if (!view?.points.length) return null;
    const counts = {};
    view.points.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
          <Chip
            key={c}
            size="small"
            label={`${prettyCategory(c)} · ${n}`}
            sx={{ backgroundColor: ecatColor(c), color: '#fff', fontWeight: 500, height: 20 }}
          />
        ))}
      </Box>
    );
  }, [view]);

  const columns = useMemo(() => ([
    { key: 'label', label: 'Exposure', wrap: true, from: (p) => p.label },
    {
      key: 'category',
      label: 'Category',
      from: (p) => p.meta.category,
      format: (v, p) => (
        <Chip size="small" label={v}
              sx={{ backgroundColor: p.color, color: '#fff', height: 20, fontWeight: 500 }} />
      ),
    },
    {
      key: 'reads',
      label: `Reads — ${metricLabel} (95% CI)`,
      align: 'right',
      from: (p) => p.x,
      format: (v, p) => ci(v, p.xlo, p.xhi),
    },
    {
      key: 'tracks',
      label: 'Tracks — Δ-correlation (95% CI)',
      align: 'right',
      from: (p) => p.y,
      format: (v, p) => ci(v, p.ylo, p.yhi),
    },
    { key: 'n_person', label: 'People', align: 'right', format: int },
    { key: 'n_pairs', label: 'Visit pairs', align: 'right', format: int },
    { key: 'n_change', label: 'Who changed', align: 'right', format: int },
  ]), [metricLabel]);

  // Chance on x and no-tracking on y: without them a cloud sitting entirely
  // above zero looks the same as one straddling it.
  const shapes = useMemo(() => {
    const out = [{
      type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 0,
      line: { dash: 'dot', width: 1, color: '#c8c8c8' },
    }];
    if (noSkill !== null) {
      out.push({
        type: 'line', xref: 'x', yref: 'paper', x0: noSkill, x1: noSkill, y0: 0, y1: 1,
        line: { dash: 'dot', width: 1, color: '#c8c8c8' },
      });
    }
    return out;
  }, [noSkill]);

  const annotations = useMemo(() => {
    const out = [{
      xref: 'paper', x: 0, yref: 'y', y: 0, xanchor: 'left', yanchor: 'bottom',
      text: 'no within-person tracking', showarrow: false, font: { size: 9, color: '#888' },
    }];
    if (noSkill !== null) {
      out.push({
        xref: 'x', x: noSkill, yref: 'paper', y: 1, xanchor: 'left', yanchor: 'top',
        text: metricKey === 'AUC' ? 'chance (AUC 0.5)' : 'no reading (R² 0)',
        showarrow: false, font: { size: 9, color: '#888' },
      });
    }
    return out;
  }, [noSkill, metricKey]);

  const typeLabel = TYPES.find((t) => t.id === etype)?.label.toLowerCase();

  return (
    <SectionCard
      title="How well the proteome reads an exposure, against how well the score tracks change"
      subtitle={
        'Each point is one exposure, colored by its category. The x axis is how well a '
        + 'proteome-only score reads that exposure in held-out people; the y axis is the '
        + 'within-person Δ-correlation — pair each person’s baseline visit with a repeat '
        + 'visit and correlate the change in the score with the change in the exposure. Bars '
        + 'are 95% bootstrap intervals on both axes. Reading the exposure well is the easier '
        + 'of the two: a score can sit far to the right and still fall on the y = 0 line.'
      }
      loading={reads.loading || tracks.loading}
      error={reads.error || tracks.error}
    >
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        <ToggleButtonGroup size="small" exclusive value={etype}
                           onChange={(_, v) => v && setEtype(v)}>
          {TYPES.map((t) => (
            <ToggleButton key={t.id} value={t.id} sx={{ textTransform: 'none', px: 1.5 }}>
              {t.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup size="small" exclusive value={spec}
                           onChange={(_, v) => v && setSpec(v)}>
          {SPECS.map((s) => (
            <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none', px: 1.5 }}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Chip size="small" variant="outlined"
              label={`x: ${metricLabel} · ${typeLabel} exposures`} />
      </Box>

      {view && view.metrics.length > 1 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The reads export scores these {typeLabel} exposures with more than one metric (
          {view.metrics.join(', ')}). They are not comparable on one axis and should not be
          read as a single scale.
        </Alert>
      )}

      {built && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {built.nReads} exposures have a reads estimate under <code>{spec}</code>;{' '}
          <b>{built.rows.length}</b> of them also have a within-person estimate and can be
          plotted. The other <b>{built.dropped.length}</b> are not on this plot
          {built.droppedByCat.length > 0 && (
            <> ({built.droppedByCat.map(([c, n]) => `${n} ${prettyCategory(c).toLowerCase()}`).join(', ')})</>
          )}
          : tracking pairs a baseline visit with a repeat visit and needs at least 30 such pairs
          and 15 people whose exposure actually changed, so exposures that are fixed at baseline
          or assigned from an address — residential pollution, deprivation indices — never
          produce one. They are measured, not discarded; they simply have no y value.
          {built.orphanTracked.length > 0 && (
            <> A further {built.orphanTracked.length} exposures have a tracking estimate but no
            reads estimate under this specification.</>
          )}
        </Typography>
      )}

      {view && (
        <LinkedScatterTable
          points={view.points}
          columns={columns}
          xTitle={`${metricLabel} — proteome-only score`}
          yTitle="within-person Δ-correlation (score vs exposure)"
          height={500}
          rowsVisible={12}
          legend={legend}
          searchPlaceholder="Filter exposures or categories…"
          emptyNote={`No ${typeLabel} exposure has both a reads and a tracking estimate under ${spec}.`}
          extraShapes={shapes}
          extraAnnotations={annotations}
        />
      )}
    </SectionCard>
  );
}
