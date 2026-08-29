import React, { useMemo, useState } from 'react';
import {
  Alert, AlertTitle, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import Select from 'react-select';
import SectionCard from '../SectionCard';
import LinkedScatterTable from '../LinkedScatterTable';
import { useKeys, useShard } from '../../lib/useSection';
import { SPECS } from '../../lib/covariateSpecs';
import { ecatColor, prettyCategory, prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// Does an exposure's proteomic score predict incident disease?
//
// The page used to answer this with 14 diseases lifted off a figure export. The
// deposit behind it holds the whole grid -- 165 exposures x 170 diseases, with
// confidence intervals, under five covariate specifications -- and the shape of
// that grid IS the result: hundreds of significant hazard ratios per exposure
// sitting on top of a discrimination gain that is very close to zero. Fourteen
// hand-picked rows cannot show that; 170 with their intervals can.
//
// Data: pes_disease (tier K, sharded by exposure_id), built by
// tools/build_pes_disease.py.
//
// THE ONE THING THIS PANEL MUST NOT DO is put a held-out delta-C and an
// apparent delta-C on the same axis. Only `base` was scored out-of-sample and
// bootstrapped; the other specs report the in-sample number, which is biased
// toward zero for reasons that have nothing to do with the covariates. Flipping
// the spec picker would then look like "adjustment destroyed the signal" when
// what actually changed was the estimator. The guard is structural rather than
// editorial: `view` below is DERIVED from the spec, so the delta-C axes are
// unreachable unless spec === 'base', and the word "apparent" never appears on
// an axis title at all -- only in a table header, where it is spelled out.
// ---------------------------------------------------------------------------

const DEFAULT_EXPOSURE = 'pack_years_of_smoking_f20161_0_0';

// SPECS now lives in lib/covariateSpecs.js -- four panels each had a copy and
// they had drifted apart in both labels and order.
const SPEC_LABEL = Object.fromEntries(SPECS.map((s) => [s.id, s.label]));

// Color carries direction and significance of the hazard ratio, and keeps that
// meaning in every view so switching the axes does not re-key the palette.
const COL_RISK = '#B0653C';
const COL_PROT = '#2C7FB8';
const COL_NULL = '#C9B8A8';
const Q_SIG = 0.05;

// q underflows to exactly 0 for a few hundred of the ~28k pairs, and -log10(0)
// is not plottable. Floor it rather than dropping those points: they are the
// strongest associations in the panel and silently deleting them would invert
// the reading of the plot.
const Q_FLOOR = 1e-300;

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';
const int = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString());
const dec = (v, d) => (v === null || v === undefined ? '—' : v.toFixed(d));
const ci = (v, lo, hi, d) => (v === null || v === undefined
  ? '—' : `${v.toFixed(d)} [${dec(lo, d)}, ${dec(hi, d)}]`);
const fmtQ = (q) => {
  if (q === null || q === undefined) return '—';
  if (q === 0) return '<1e-308';
  return q < 1e-3 ? q.toExponential(1) : q.toFixed(3);
};
const negLog10 = (q) => (q === null ? null : -Math.log10(Math.max(q, Q_FLOOR)));

// prettyExposure() in the shared palette strips everything after the UK Biobank
// field id, which collapses the five `milk_type_used_f1418_0_0_*` keys onto one
// label. A picker over 167 keys cannot afford five entries reading "Milk type
// used", so keep the level suffix here.
// Exposure keys are labelled by the shared prettyExposure, which keeps the
// one-hot level and so gives 167 distinct labels.

function Swatch({ color, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{children}</Typography>
    </Box>
  );
}

export default function PesDisease() {
  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('pes_disease');
  const [exposure, setExposure] = useState(DEFAULT_EXPOSURE);
  const [spec, setSpec] = useState('base');
  // What the reader last ASKED for. What they get is `view`, below.
  const [wanted, setWanted] = useState('volcano');
  const { data, loading, error } = useShard('pes_disease', exposure);

  // The delta-C views exist only where held-out delta-C exists. Deriving the
  // view instead of syncing it in an effect means there is no window, however
  // brief, in which an apparent-only shard is drawn on a "held-out" axis.
  //
  // Gate on the DATA, not on spec === 'base'. base_exclprev is also scored
  // held-out -- it is the spec that actually retrains the score -- so a
  // spec-name rule hid the one non-base estimate that is comparable to base.
  const specIsHeldout = useMemo(() => {
    if (!data?.spec) return false;
    for (let i = 0; i < data.spec.length; i += 1) {
      if (data.spec[i] === spec) return isTrue(data.dc_is_heldout?.[i]);
    }
    return false;
  }, [data, spec]);
  const view = specIsHeldout ? wanted : (wanted === 'dc' ? 'volcano' : wanted);
  const blockedDc = wanted === 'dc' && !specIsHeldout;

  const options = useMemo(
    () => (keyIndex ? Object.keys(keyIndex.keys).map((k) => ({ value: k, label: prettyExposure(k) })) : []),
    [keyIndex],
  );

  const rows = useMemo(() => {
    if (!data?.spec) return [];
    const out = [];
    for (let i = 0; i < data.spec.length; i += 1) {
      if (data.spec[i] !== spec) continue;
      const q = num(data.q_pes?.[i]);
      out.push({
        id: data.disease_id[i],
        label: data.disease_label[i],
        category: data.category?.[i] || '',
        whatVaries: data.what_varies?.[i] || '',
        main: isTrue(data.in_main_figure?.[i]),
        n: num(data.n?.[i]),
        events: num(data.events?.[i]),
        q,
        hr: num(data.hr_pes?.[i]),
        hrLo: num(data.hr_pes_lo?.[i]),
        hrHi: num(data.hr_pes_hi?.[i]),
        hrE: num(data.hr_beyond_selfreport?.[i]),
        hrELo: num(data.hr_beyond_selfreport_lo?.[i]),
        hrEHi: num(data.hr_beyond_selfreport_hi?.[i]),
        // Held-out and apparent are read into separate fields and never
        // coalesced -- a `dc ?? dcApparent` here is exactly the bug the column
        // naming in the payload exists to prevent.
        dc: num(data.dC_over_cov?.[i]),
        dcLo: num(data.dC_over_cov_lo?.[i]),
        dcHi: num(data.dC_over_cov_hi?.[i]),
        dcE: num(data.dC_beyond_selfreport?.[i]),
        dcELo: num(data.dC_beyond_selfreport_lo?.[i]),
        dcEHi: num(data.dC_beyond_selfreport_hi?.[i]),
        dcApp: num(data.dC_over_cov_apparent?.[i]),
        dcIsHeldout: isTrue(data.dc_is_heldout?.[i]),
        dcEApp: num(data.dC_beyond_selfreport_apparent?.[i]),
      });
    }
    // Main-figure pairs to the top so requirement 4 is met by the sort itself,
    // then most significant first: with 170 diseases the reader wants the top of
    // the table to be the answer, not an alphabet.
    out.sort((a, b) => (Number(b.main) - Number(a.main))
      || ((a.q === null ? 2 : a.q) - (b.q === null ? 2 : b.q)));
    return out;
  }, [data, spec]);

  const category = rows[0]?.category || '';
  const whatVaries = rows[0]?.whatVaries || '';
  // Read the meaning of the spec off the deposit's own manifest text rather than
  // hardcoding which spec retrains: if the manifest changes, this follows.
  const retrained = /retrain/i.test(whatVaries);
  const nSig = rows.filter((r) => r.q !== null && r.q < Q_SIG).length;
  const nMain = rows.filter((r) => r.main).length;
  // Held-out for base and base_exclprev; bootstrap intervals only for base.
  const heldOut = specIsHeldout;
  const heldOutHasCI = rows.some((r) => r.dcLo !== null && r.dcLo !== undefined);
  const hasApparent = rows.some((r) => r.dcApp !== null);

  const points = useMemo(() => rows.map((r) => {
    const p = {
      id: r.id,
      label: r.label,
      color: r.q === null ? COL_NULL
        : (r.q < Q_SIG ? ((r.hr !== null && r.hr >= 1) ? COL_RISK : COL_PROT) : COL_NULL),
      meta: {
        main: r.main ? 'main-figure' : '',
        n: r.n,
        events: r.events,
        hr: r.hr,
        hrLo: r.hrLo,
        hrHi: r.hrHi,
        q: r.q,
        hrE: r.hrE,
        hrELo: r.hrELo,
        hrEHi: r.hrEHi,
        dc: r.dc,
        dcLo: r.dcLo,
        dcHi: r.dcHi,
        dcApp: r.dcApp,
      },
    };
    if (view === 'dc') {
      return {
        ...p, x: r.dc, xlo: r.dcLo, xhi: r.dcHi, y: r.dcE, ylo: r.dcELo, yhi: r.dcEHi,
      };
    }
    if (view === 'hr2') {
      return {
        ...p, x: r.hr, xlo: r.hrLo, xhi: r.hrHi, y: r.hrE, ylo: r.hrELo, yhi: r.hrEHi,
      };
    }
    return {
      ...p, x: r.hr, xlo: r.hrLo, xhi: r.hrHi, y: negLog10(r.q),
    };
  }).filter((p) => p.x !== null && p.y !== null), [rows, view]);

  // Preselect a main-figure pair so the printed result is already highlighted in
  // both halves on load, rather than being one of 170 anonymous dots.
  const initialSelected = useMemo(
    () => points.find((p) => p.meta.main)?.id || null,
    [points],
  );

  const axes = useMemo(() => {
    if (view === 'dc') {
      return {
        x: 'held-out ΔC-index over covariates (95% bootstrap CI)',
        y: 'held-out ΔC-index beyond self-report (95% bootstrap CI)',
      };
    }
    if (view === 'hr2') {
      return {
        x: 'HR per SD of PES (95% CI)',
        y: 'HR per SD of PES, self-report also adjusted (95% CI)',
      };
    }
    return { x: 'HR per SD of PES (95% CI)', y: '−log10 q (FDR)' };
  }, [view]);

  const extraShapes = useMemo(() => {
    const dash = (o) => ({ type: 'line', line: { dash: 'dash', width: 1, color: '#999' }, ...o });
    if (view === 'dc') {
      return [
        dash({ xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0, y1: 1 }),
        dash({ xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 0 }),
      ];
    }
    const nullHr = dash({ xref: 'x', yref: 'paper', x0: 1, x1: 1, y0: 0, y1: 1 });
    if (view !== 'hr2') return [nullHr];
    // The identity line is the whole point of this view: a disease sitting on it
    // is one the score predicts just as well after the questionnaire answer is
    // already in the model.
    const vals = [];
    points.forEach((p) => [p.xlo, p.x, p.xhi, p.ylo, p.y, p.yhi]
      .forEach((v) => { if (v !== null && v !== undefined) vals.push(v); }));
    const diag = vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
    return [
      nullHr,
      dash({ xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 1, y1: 1 }),
      ...(diag ? [{
        type: 'line', xref: 'x', yref: 'y', x0: diag[0], y0: diag[0], x1: diag[1], y1: diag[1],
        line: { dash: 'dot', width: 1, color: '#bbb' },
      }] : []),
    ];
  }, [view, points]);

  const extraAnnotations = useMemo(() => points
    .filter((p) => p.meta.main)
    .map((p) => ({
      x: p.x,
      y: p.y,
      xref: 'x',
      yref: 'y',
      text: '★ main figure',
      showarrow: true,
      arrowhead: 0,
      arrowwidth: 1,
      arrowcolor: '#333',
      ax: 34,
      ay: -30,
      font: { size: 10, color: '#333' },
      bgcolor: 'rgba(255,255,255,0.88)',
      bordercolor: '#333',
      borderwidth: 0.5,
      borderpad: 2,
    })), [points]);

  const columns = useMemo(() => {
    const cols = [
      { key: 'fig', label: '', align: 'center', from: (p) => (p.meta.main ? '★' : ''), format: (v) => v },
      { key: 'disease_label', label: 'Disease', wrap: true, from: (p) => p.label },
      { key: 'n', label: 'At risk', align: 'right', from: (p) => int(p.meta.n) },
      { key: 'events', label: 'Events', align: 'right', from: (p) => int(p.meta.events) },
      {
        key: 'hr',
        label: 'HR per SD of PES (95% CI)',
        align: 'right',
        from: (p) => ci(p.meta.hr, p.meta.hrLo, p.meta.hrHi, 2),
      },
      { key: 'q', label: 'q', align: 'right', from: (p) => fmtQ(p.meta.q) },
      {
        key: 'hrE',
        label: 'HR beyond self-report (95% CI)',
        align: 'right',
        from: (p) => ci(p.meta.hrE, p.meta.hrELo, p.meta.hrEHi, 2),
      },
    ];
    // One ΔC column, never two, and its header names the estimator. The key
    // differs as well as the label so nothing downstream can treat the held-out
    // and apparent columns as the same field.
    if (heldOut) {
      cols.push({
        key: 'dc_heldout',
        label: 'ΔC over covariates — held-out (95% CI)',
        align: 'right',
        from: (p) => ci(p.meta.dc, p.meta.dcLo, p.meta.dcHi, 4),
      });
    } else if (hasApparent) {
      cols.push({
        key: 'dc_apparent',
        label: 'ΔC over covariates — apparent, in-sample',
        align: 'right',
        from: (p) => dec(p.meta.dcApp, 4),
      });
    }
    return cols;
  }, [heldOut, hasApparent]);

  const legend = (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Swatch color={COL_RISK}>q&lt;0.05, HR&gt;1</Swatch>
      <Swatch color={COL_PROT}>q&lt;0.05, HR&lt;1</Swatch>
      <Swatch color={COL_NULL}>q&ge;0.05</Swatch>
      <Typography variant="caption" color="text.secondary">
        ★ printed main figure — filter on <b>main-figure</b>
      </Typography>
    </Box>
  );

  return (
    <SectionCard
      title={<>Does the exposure&apos;s proteomic score predict incident disease?</>}
      subtitle={
        'One proteomic exposure score (PES) against all 170 incident diseases, with '
        + 'confidence intervals, under five covariate specifications. The hazard ratio is '
        + 'the metric that means the same thing in all five; the held-out gain in '
        + 'discrimination is richer but exists only under the primary specification.'
      }
      loading={kLoading}
      error={kError}
    >
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ minWidth: 280, flex: '1 1 320px', maxWidth: 520 }}>
          <Select
            options={options}
            value={{ value: exposure, label: prettyExposure(exposure) }}
            onChange={(o) => setExposure(o.value)}
            isSearchable
            placeholder="Search an exposure…"
            // Match the raw field id too: people arrive here with "f20161" in
            // hand from a supplementary table, not with the prose label.
            filterOption={(opt, raw) => {
              const q = String(raw || '').trim().toLowerCase();
              if (!q) return true;
              const hay = `${opt.label} ${opt.value}`.toLowerCase();
              return q.split(/\s+/).every((t) => hay.includes(t));
            }}
          />
        </Box>
        {category && (
          <Chip
            size="small"
            variant="outlined"
            label={prettyCategory(category)}
            icon={(
              <Box sx={{
                width: 10, height: 10, borderRadius: '50%', bgcolor: ecatColor(category), ml: 1,
              }}
              />
            )}
          />
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={spec}
          onChange={(_, v) => v && setSpec(v)}
        >
          {SPECS.map((s) => (
            <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none', px: 1.25 }}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setWanted(v)}
        >
          <ToggleButton value="volcano" sx={{ textTransform: 'none', px: 1.5 }}>
            HR vs significance
          </ToggleButton>
          <ToggleButton value="hr2" sx={{ textTransform: 'none', px: 1.5 }}>
            HR beyond self-report
          </ToggleButton>
          <ToggleButton value="dc" disabled={!heldOut} sx={{ textTransform: 'none', px: 1.5 }}>
            Held-out ΔC
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 460 }}>
          The two HR views are comparable across all five specifications. Held-out ΔC was only
          ever computed under the primary specification, so it is offered there and nowhere else.
        </Typography>
        <Chip size="small" variant="outlined" label={`${rows.length} diseases`} />
        <Chip size="small" color={nSig ? 'primary' : 'default'} label={`${nSig} with q<0.05`} />
        {nMain > 0 && <Chip size="small" label={`★ ${nMain} in printed main figure`} />}
      </Box>

      {whatVaries && (
        <Alert severity={retrained ? 'warning' : 'info'} sx={{ mb: 2 }}>
          <AlertTitle>{SPEC_LABEL[spec] || spec}</AlertTitle>
          {heldOut ? (
            <>
              Reference specification, and the only one scored out of sample: hazard ratios,
              held-out C-indices and bootstrap intervals all come from here.
            </>
          ) : (
            <>
              What varies: <b>{whatVaries}</b>.{' '}
              {retrained
                ? 'The score is rebuilt on the restricted sample, so a change here is a '
                  + 'question about whether the PES survives retraining — a different and '
                  + 'harder question than whether it survives a richer adjustment.'
                : 'The PES itself is not retrained; only the Cox adjustment changes. A change '
                  + 'here says something about confounding control, not about the score.'}
            </>
          )}
        </Alert>
      )}

      {view === 'dc' && !heldOutHasCI && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This specification reports held-out &Delta;C but no bootstrap interval,
          so these points carry no error bars. Only the primary specification was
          bootstrapped. Read the ordering here as indicative rather than
          separating one pair from the next.
        </Alert>
      )}
      {blockedDc && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing the hazard ratio instead of ΔC. Only the primary specification has
          <b> held-out</b> ΔC with bootstrap intervals; {SPEC_LABEL[spec] || spec} carries the
          <b> apparent</b> (in-sample) value, which is biased toward zero for reasons unrelated
          to the covariates. Plotting the two on one axis would read as an effect of adjustment
          when it is an effect of the estimator, so the apparent value is confined to its own
          table column below.
        </Alert>
      )}

      {loading && <Typography variant="body2">Loading {prettyExposure(exposure)}…</Typography>}
      {error && <Typography variant="body2" color="error">{String(error)}</Typography>}

      {!loading && !rows.length && (
        <Alert severity="info">
          No disease models for <b>{prettyExposure(exposure)}</b> under{' '}
          {SPEC_LABEL[spec] || spec}. Not every exposure survives every specification —
          the healthy-at-baseline sample drops one exposure outright.
        </Alert>
      )}

      {!heldOut && !hasApparent && rows.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          The deposit for {SPEC_LABEL[spec] || spec} carries hazard ratios but no ΔC of either
          kind, so no ΔC column is shown. The HR views are unaffected.
        </Alert>
      )}

      {rows.length > 0 && (
        <LinkedScatterTable
          points={points}
          columns={columns}
          xTitle={axes.x}
          yTitle={axes.y}
          title={`${prettyExposure(exposure)} — ${SPEC_LABEL[spec] || spec}`}
          height={480}
          rowsVisible={14}
          searchPlaceholder="Filter diseases…"
          legend={legend}
          initialSelected={initialSelected}
          extraShapes={extraShapes}
          extraAnnotations={extraAnnotations}
          emptyNote="No disease matches that filter."
        />
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Color marks the direction and FDR significance of the hazard ratio and keeps that meaning
        in every view. &ldquo;Beyond self-report&rdquo; means the participant&apos;s own answer to
        the exposure question is already in the Cox model, so what is left is what the proteins
        add on top of asking.
      </Typography>
    </SectionCard>
  );
}
