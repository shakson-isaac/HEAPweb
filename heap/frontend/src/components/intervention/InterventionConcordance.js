import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import Select from 'react-select';
import SectionCard from '../SectionCard';
import LinkedScatterTable from '../LinkedScatterTable';
import { useKeys, useSection, useShard } from '../../lib/useSection';
import {
  ecatColor, prettyCategory, prettyDisease, prettyExposure,
} from '../../lib/palette';

// ---------------------------------------------------------------------------
// ONE scatter for the whole intervention section.
//
// The page used to be a stack of thin panels -- one per trial, one per exemplar
// exposure, one per annotation -- and a reader had to hold four of them in their
// head to answer a single question. All of them plotted the same two
// quantities: the UK Biobank exposure->protein effect, and the effect a trial
// reported on that same protein. So there is one scatter here, and everything
// that used to be a separate panel is a CONTROL on it.
//
//   x  the held-out exposure->protein beta from HEAP, under the covariate
//      specification the reader picks
//   y  the published effect of HERITAGE, STEP 1 or STEP 2 on the same protein
//
// The two axes are deliberately NOT the same estimand, and that is the point
// rather than a defect: a between-person slope in ~50k people against a
// within-person change under randomized treatment, on two assay platforms, in
// three different populations. If they agreed by construction the panel would
// say nothing. The subtitle says so out loud so no reader has to infer it.
//
// DATA
//   intervention_concordance_full   tier K, sharded on exposure_id (185 keys).
//                                   One shard is five blocks over the same
//                                   protein set -- one per covariate spec.
//   intervention_spec_correlations  tier S, 2,775 rows: the correlation for
//                                   every (spec x exposure x trial), which is
//                                   what puts a NUMBER on the cloud.
// Both come from tools/build_intervention_concordance.py. Read its docstring
// before changing anything about what "reported" or "measured" mean here --
// the distinction is load-bearing and asymmetric across the three trials.
// ---------------------------------------------------------------------------

// The paper's own exemplar (results_m4_intervention.tex): strenuous sports
// tracks the GLP-1 shift. It is also the clearest demonstration of the
// specification control -- r falls 0.74 -> 0.66 once BMI is in the model -- so
// the reader meets that control doing something rather than sitting inert.
const DEFAULT_EXPOSURE =
  'types_of_physical_activity_in_last_4_weeks_f6164_0_0.multi_Strenuous_sports';

// The three trial series. `corr` is how intervention_spec_correlations spells
// the trial; the rest are column names on the shard. Column names have to be
// written down somewhere. What is NOT written down here is whether a trial's
// assay panel is knowable -- that is read off the data (see `panelKnown`).
const TRIALS = [
  {
    id: 'HERITAGE',
    corr: 'HERITAGE',
    label: 'HERITAGE',
    arm: '20 weeks of supervised endurance training (n = 654)',
    effect: 'HERITAGE_effect',
    se: 'HERITAGE_se',
    reported: 'heritage_reported',
    measured: 'heritage_measured',
    yTitle: 'HERITAGE effect on the protein (log10 fold change, post − pre)',
    reportedNote: 'its published table lists only the proteins that reached q < 0.01',
  },
  {
    id: 'GLP1_STEP1',
    corr: 'GLP1_STEP1',
    label: 'STEP 1',
    arm: 'semaglutide 2.4 mg vs placebo, 68 weeks, obesity (n = 1,133)',
    effect: 'GLP1_effect1',
    se: 'GLP1_se1',
    reported: 'glp1_reported1',
    measured: 'glp1_measured1',
    yTitle: 'STEP 1 effect on the protein (semaglutide − placebo at 68 weeks)',
    reportedNote: 'reported at the trial’s own q < 0.05',
  },
  {
    id: 'GLP1_STEP2',
    corr: 'GLP1_STEP2',
    label: 'STEP 2',
    arm: 'semaglutide 2.4 mg vs placebo, 68 weeks, type 2 diabetes (n = 595)',
    effect: 'GLP1_effect2',
    se: 'GLP1_se2',
    reported: 'glp1_reported2',
    measured: 'glp1_measured2',
    yTitle: 'STEP 2 effect on the protein (semaglutide − placebo at 68 weeks)',
    reportedNote: 'reported at the trial’s own q < 0.05',
  },
];

// The packer recovers a whole column's type, so a TSV "TRUE" arrives as a real
// JSON boolean and a blank arrives as null. Accept either spelling -- and treat
// a blank as UNKNOWN, never as false. That difference is the whole reason the
// HERITAGE panel below reads differently from the GLP-1 ones.
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';
const isBool = (v) => v === true || v === false
  || String(v).toUpperCase() === 'TRUE' || String(v).toUpperCase() === 'FALSE';

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const f2 = (v) => (v == null ? '—' : v.toFixed(2));
const f3 = (v) => (v == null ? '—' : v.toFixed(3));

const fp = (v) => {
  if (v == null) return '—';
  if (v < 1e-4) return v.toExponential(1);
  return v.toFixed(4);
};

const ci = (v, se) => {
  if (v == null) return '—';
  if (se == null) return f3(v);
  return `${f3(v)} [${f3(v - 1.96 * se)}, ${f3(v + 1.96 * se)}]`;
};

// prettyExposure() cuts everything after the UK Biobank field code, which glues
// the four processed-meat levels onto one name and would make four different
// exposures look like one entry in the picker. The level after the field code
// is part of the exposure's identity, so recover it before falling back. (The
// same repair lives in pages/subpages/Intervention.js; it is duplicated rather
// than shared because that file owns the page and this component owns itself.)
const ID_RE = /^(.*)_f(\d+)_(\d+)_(\d)(.*)$/;
function termLabel(id) {
  const s = String(id);
  const m = s.match(ID_RE);
  if (!m) return prettyExposure(s);
  const stem = m[1].replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const lvl = m[5].replace(/^[._]+/, '').replace(/^multi_/, '').replace(/[._]+/g, ' ').trim();
  if (!lvl) return stem;
  return /^\d+$/.test(lvl) ? `${stem} (level ${lvl})` : `${stem} (${lvl})`;
}

// A specification's display name, DERIVED from its id rather than looked up in
// a hardcoded table -- if the export ever gains a sixth specification it shows
// up here named correctly instead of silently missing. What the specification
// actually DOES comes from the data's own what_varies / spec_kind /
// covariate_set columns, which is the only description this page trusts.
const specLabel = (id) => String(id)
  .split('_plus_').join(' + ')
  .replace(/_/g, ' ')
  .replace(/\bbmi\b/g, 'BMI');

// ---------------------------------------------------------------------------
// Reliability-weighted Pearson: the same estimator the published correlation
// uses (run_intervention_compare.R -- wtd.cor with w = pmax(olink_soma_r, 0),
// n_eff = (sum w)^2 / sum w^2). Recomputed here ONLY to describe the subset the
// reader has filtered down to; the headline number always comes from the
// published table, so the paper's value is never quietly replaced by a
// browser-side one.
// ---------------------------------------------------------------------------
function weightedPearson(x, y, w) {
  if (x.length < 3) return null;
  const sw = w.reduce((a, b) => a + b, 0);
  if (!(sw > 0)) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < x.length; i += 1) { mx += w[i] * x[i]; my += w[i] * y[i]; }
  mx /= sw;
  my /= sw;
  let cxy = 0;
  let cxx = 0;
  let cyy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    cxy += w[i] * dx * dy;
    cxx += w[i] * dx * dx;
    cyy += w[i] * dy * dy;
  }
  if (cxx <= 0 || cyy <= 0) return null;
  const sw2 = w.reduce((a, b) => a + b * b, 0);
  return { r: cxy / Math.sqrt(cxx * cyy), neff: (sw * sw) / sw2, n: x.length };
}

// ---------------------------------------------------------------------------
// Colour schemes.
//
// A shard is ONE exposure, so every point shares a category and colouring by
// category would paint a solid block. The category colour goes on the exposure
// chip instead, where it still carries information. On the plot, colour is a
// control -- and what it means is printed above the legend every time, because
// a legend whose meaning changes silently is worse than no legend.
// ---------------------------------------------------------------------------
const NOT_TESTED = 'not tested';
const NO_ASSAY_PAIR = 'no Olink–SomaScan pair';

// Reliability bins. The ~22% of proteins with no value get a swatch of their
// own, OFF the ramp: a protein never measured on both platforms is UNKNOWN, not
// poorly agreeing, and must never be drawn at the weak end of a scale that
// would say the platforms disagreed about it.
const RELIABILITY_BINS = [
  { id: '≥ 0.7', test: (v) => v >= 0.7, color: '#08519C' },
  { id: '0.5 – 0.7', test: (v) => v >= 0.5, color: '#3182BD' },
  { id: '0.3 – 0.5', test: (v) => v >= 0.3, color: '#6BAED6' },
  { id: '< 0.3', test: () => true, color: '#BDD7E7' },
];

const SCHEMES = {
  mr_role: {
    button: 'MR role',
    label: 'MR role of the protein',
    note: 'A forward protein→disease edge makes an intermediate, a reverse '
      + 'disease→protein edge a reporter. The two are not exclusive.',
    of: (r) => (r.mrRole ? r.mrRole : NOT_TESTED),
    order: ['intermediate', 'both', 'reporter', 'none', NOT_TESTED],
    colors: {
      intermediate: '#1A6B30',
      both: '#7B3FA0',
      reporter: '#2C7FB8',
      none: '#BDBDBD',
      [NOT_TESTED]: '#E8E8E8',
    },
    names: {
      intermediate: 'intermediate (protein → disease)',
      both: 'both directions',
      reporter: 'reporter (disease → protein)',
      none: 'in an MR table, no qualifying edge',
      // A blank mr_role is NOT "none": that protein is in neither MR table, so
      // it was never tested. Collapsing the two would report an absence of
      // evidence as evidence of absence for 887 of the 1,488 proteins.
      [NOT_TESTED]: 'in neither MR table (never tested)',
    },
  },
  mr_support: {
    button: 'platform',
    label: 'which proteomic platform carried the MR edge',
    note: 'Olink is the UK Biobank arm, SomaScan the deCODE arm. "Both" is an '
      + 'edge that replicated across platforms.',
    of: (r) => r.mrSupport || NOT_TESTED,
    order: ['Both', 'UKB only', 'DECODE only', 'None', NOT_TESTED],
    // Mirrors MR_SUPPORT_COLOR in pages/subpages/Intervention.js so two views of
    // the same field agree on screen.
    colors: {
      Both: '#7B3FA0',
      'UKB only': '#1B6CA8',
      'DECODE only': '#E07B39',
      None: '#BDBDBD',
      [NOT_TESTED]: '#E8E8E8',
    },
    names: {
      Both: 'both platforms (Olink + SomaScan)',
      'UKB only': 'Olink / UK Biobank only',
      'DECODE only': 'SomaScan / deCODE only',
      None: 'no significant edge in either arm',
    },
  },
  mr_edge_sig: {
    button: 'edge type',
    label: 'strongest MR edge for this exposure',
    note: 'The edge type that reaches significance in this exposure’s triad — '
      + 'not the protein’s MR record overall.',
    of: (r) => r.mrEdge || NOT_TESTED,
    order: ['PDcis', 'PDtrans', 'DP', 'None', NOT_TESTED],
    colors: {
      PDcis: '#1B6CA8',
      PDtrans: '#E07B39',
      DP: '#7B3FA0',
      None: '#BDBDBD',
      [NOT_TESTED]: '#E8E8E8',
    },
    names: {
      PDcis: 'protein → disease, cis instrument',
      PDtrans: 'protein → disease, trans instrument',
      DP: 'disease → protein',
      None: 'no significant edge',
    },
  },
  significance: {
    button: 'significance',
    label: 'significance of the UK Biobank effect (the x axis)',
    note: '"Replicated" is the paper’s rule: Bonferroni-significant in the '
      + 'discovery split and again in the held-out split.',
    of: (r) => {
      if (r.replicated) return 'replicated';
      if (r.p != null && r.p < 0.05) return 'nominal';
      return 'not significant';
    },
    order: ['replicated', 'nominal', 'not significant'],
    colors: { replicated: '#1A6B30', nominal: '#B0A24A', 'not significant': '#BDBDBD' },
    names: {
      replicated: 'replicated in both splits',
      nominal: 'p < 0.05 in the held-out split only',
      'not significant': 'p ≥ 0.05',
    },
  },
  reliability: {
    button: 'assay reliability',
    label: 'Olink–SomaScan assay correlation (Eldjarn et al.)',
    note: 'The reliability that weights the published r. The shared scatter '
      + 'draws one marker size for every point, so reliability rides on colour '
      + 'here rather than on point area.',
    of: (r) => {
      if (r.rel == null) return NO_ASSAY_PAIR;
      const bin = RELIABILITY_BINS.find((b) => b.test(r.rel));
      return (bin || RELIABILITY_BINS[RELIABILITY_BINS.length - 1]).id;
    },
    order: [...RELIABILITY_BINS.map((b) => b.id), NO_ASSAY_PAIR],
    colors: {
      ...Object.fromEntries(RELIABILITY_BINS.map((b) => [b.id, b.color])),
      // Deliberately warm and off the blue ramp: "never measured on both
      // platforms" must not be readable as a low value on a reliability scale.
      [NO_ASSAY_PAIR]: '#C9A227',
    },
    names: { [NO_ASSAY_PAIR]: 'not measured on both platforms — unknown, not poor' },
  },
};

// ---------------------------------------------------------------------------
// Control primitives, so the eight pickers read as a list of questions rather
// than two hundred lines of JSX.
// ---------------------------------------------------------------------------
function Picker({ label, help, value, onChange, options }) {
  return (
    <Box sx={{ mr: 2.5, mb: 1.25 }}>
      <Typography
        variant="caption"
        sx={{ display: 'block', fontWeight: 700, color: 'text.secondary', letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, v) => v && onChange(v)}>
        {options.map((o) => (
          <ToggleButton key={o.id} value={o.id} sx={{ textTransform: 'none', px: 1.25, py: 0.4 }}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {help && (
        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', maxWidth: 380 }}
        >
          {help}
        </Typography>
      )}
    </Box>
  );
}

function Swatch({ color, children }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, mr: 1.25 }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          border: '1px solid rgba(0,0,0,0.25)',
          flex: '0 0 auto',
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{children}</Typography>
    </Box>
  );
}

// Table text for the protein's protein->disease record. pdt_* is the canonical
// tier table (the one Fig 4 is built from); the triad-table tiers are the
// fallback for a protein that table never saw.
function edgeText(r) {
  const tier = r.pdtTier || r.cisTier || r.transTier;
  if (!tier) return 'not tested';
  const cls = r.pdtClass ? ` (${r.pdtClass})` : '';
  const coloc = r.colocCleared && r.pph4 != null ? `, coloc PP.H4 ${f2(r.pph4)}` : '';
  return `${tier}${cls}${coloc}`;
}

function diseaseText(r) {
  const d = r.pdtDisease || r.bestDisease;
  return d ? prettyDisease(d) : '';
}

export default function InterventionConcordance() {
  const {
    data: keyIndex, loading: kLoading, error: kError,
  } = useKeys('intervention_concordance_full');
  const { data: corr } = useSection('intervention_spec_correlations');

  const [wanted, setWanted] = useState(DEFAULT_EXPOSURE);
  const [trialId, setTrialId] = useState('GLP1_STEP1');
  const [specId, setSpecId] = useState('base');
  const [xSig, setXSig] = useState('any');
  const [ySig, setYSig] = useState('this');
  const [mrFilter, setMrFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [instFilter, setInstFilter] = useState('all');
  const [support, setSupport] = useState('all');
  const [colorBy, setColorBy] = useState('mr_role');

  // Fall back to the first key rather than fetching a shard that does not
  // exist, in case the default exposure is ever dropped from the export.
  const exposure = useMemo(() => {
    if (!keyIndex?.keys) return wanted;
    return keyIndex.keys[wanted] ? wanted : Object.keys(keyIndex.keys).sort()[0];
  }, [keyIndex, wanted]);

  const { data, loading, error } = useShard('intervention_concordance_full', exposure);
  const trial = TRIALS.find((t) => t.id === trialId) || TRIALS[0];

  const options = useMemo(
    () => (keyIndex?.keys
      ? Object.keys(keyIndex.keys)
        .map((k) => ({ value: k, label: termLabel(k) }))
        .sort((a, b) => a.label.localeCompare(b.label))
      : []),
    [keyIndex],
  );

  // --- the specifications this shard actually carries ----------------------
  const specs = useMemo(() => {
    if (!data?.spec) return [];
    const seen = new Map();
    for (let i = 0; i < data.spec.length; i += 1) {
      if (!seen.has(data.spec[i])) {
        seen.set(data.spec[i], {
          id: data.spec[i],
          kind: data.spec_kind?.[i] || '',
          varies: data.what_varies?.[i] || '',
          covset: data.covariate_set?.[i] || '',
        });
      }
    }
    const rank = { primary: 0, covariate: 1, sample: 2 };
    return [...seen.values()].sort(
      (a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9) || a.id.localeCompare(b.id),
    );
  }, [data]);

  const spec = specs.find((s) => s.id === specId) || specs[0] || null;
  const specKey = spec ? spec.id : null;
  const specIsPrimary = spec ? spec.kind === 'primary' : true;

  // --- one record per protein, for the chosen specification ----------------
  const rows = useMemo(() => {
    if (!data?.protein || !specKey) return [];
    const out = [];
    for (let i = 0; i < data.protein.length; i += 1) {
      if (data.spec[i] !== specKey) continue;
      const trials = {};
      TRIALS.forEach((t) => {
        trials[t.id] = {
          e: num(data[t.effect]?.[i]),
          se: num(data[t.se]?.[i]),
          reported: isTrue(data[t.reported]?.[i]),
          // null means UNKNOWN and is the normal state for HERITAGE. Only ever
          // true/false where the trial's assay panel is recoverable.
          measured: isBool(data[t.measured]?.[i]) ? isTrue(data[t.measured][i]) : null,
        };
      });
      out.push({
        id: data.protein[i],
        protein: data.protein[i],
        // `in_spec` is FALSE for the handful of pairs a sample-restricted
        // specification drops. Their estimate is blank, not zero, so they are
        // withheld from the plot rather than drawn on the axis.
        inSpec: isTrue(data.in_spec?.[i]),
        beta: num(data.beta_HEAP?.[i]),
        se: num(data.se_HEAP?.[i]),
        p: num(data.p_HEAP?.[i]),
        replicated: isTrue(data.replicated?.[i]),
        betaBase: num(data.beta_base?.[i]),
        rel: num(data.olink_soma_r?.[i]),
        trials,
        mrEdge: data.mr_edge_sig?.[i] || '',
        mrSupport: data.mr_support?.[i] || '',
        mrRole: data.mr_role?.[i] || '',
        bestDisease: data.best_disease?.[i] || '',
        hasCis: isTrue(data.has_PD_cis?.[i]),
        hasTrans: isTrue(data.has_PD_trans?.[i]),
        hasDP: isTrue(data.has_DP?.[i]),
        cisTier: data.best_PD_cis_tier?.[i] || '',
        transTier: data.best_PD_trans_tier?.[i] || '',
        pdtTier: data.pdt_best_tier?.[i] || '',
        pdtClass: data.pdt_best_edge_class?.[i] || '',
        pdtCis1: isTrue(data.pdt_cis_tier1?.[i]),
        pdtDisease: data.pdt_top_disease?.[i] || '',
        pph4: num(data.coloc_PPH4_max?.[i]),
        colocCleared: isTrue(data.coloc_cleared?.[i]),
      });
    }
    return out;
  }, [data, specKey]);

  const category = data?.Category?.[0] || '';

  // Is this trial's assay panel knowable? READ FROM THE DATA, never asserted.
  // HERITAGE's published table contains only its q < 0.01 hits, so its panel is
  // not recoverable and heritage_measured is emitted empty on purpose rather
  // than back-filled from the hit list. If that ever changes upstream, this
  // flag flips on its own and the page starts telling the fuller story.
  const panelKnown = useMemo(
    () => rows.some((r) => r.trials[trial.id].measured !== null),
    [rows, trial],
  );

  // --- what this trial covers of the exposure's protein set ----------------
  const coverage = useMemo(() => {
    const inSpec = rows.filter((r) => r.inSpec);
    const t = (r) => r.trials[trial.id];
    return {
      tested: inSpec.length,
      dropped: rows.length - inSpec.length,
      reported: inSpec.filter((r) => t(r).reported).length,
      assayed: inSpec.filter((r) => t(r).measured === true).length,
      measuredNull: inSpec.filter((r) => t(r).measured === true && !t(r).reported).length,
      offPanel: inSpec.filter((r) => t(r).measured === false).length,
      unknown: inSpec.filter((r) => t(r).measured === null && !t(r).reported).length,
      withRel: inSpec.filter((r) => r.rel != null).length,
    };
  }, [rows, trial]);

  // Offer only the platform-support values this exposure actually has, and fall
  // back to "any" if the selected one vanishes when the exposure changes --
  // otherwise a stale selection silently empties the plot.
  const supportOptions = useMemo(() => {
    const seen = new Set(rows.filter((r) => r.mrSupport).map((r) => r.mrSupport));
    return ['all', ...['Both', 'UKB only', 'DECODE only', 'None'].filter((v) => seen.has(v))];
  }, [rows]);
  const supportValue = supportOptions.includes(support) ? support : 'all';

  // --- the filter stack ----------------------------------------------------
  // Applied in order and instrumented, so an empty plot can name the control
  // that emptied it instead of leaving the reader to bisect eight toggles.
  const { drawn, reported, culprit } = useMemo(() => {
    const t = (r) => r.trials[trial.id];
    // The base set is everything plottable: estimated under this spec, and
    // reported by this trial. A protein the trial did not report has no y and
    // cannot appear -- that is a fact about the published record, not a filter.
    const base = rows.filter((r) => r.inSpec && r.beta != null && t(r).e != null);

    const steps = [];
    if (ySig === 'multi') {
      steps.push({
        name: 'also moved in another trial',
        fn: (r) => TRIALS.filter((x) => r.trials[x.id].e != null).length >= 2,
      });
    }
    if (xSig === 'nominal') {
      steps.push({ name: 'UK Biobank p < 0.05', fn: (r) => r.p != null && r.p < 0.05 });
    }
    if (xSig === 'replicated') {
      steps.push({ name: 'replicated in both splits', fn: (r) => r.replicated });
    }
    if (mrFilter === 'edge') {
      steps.push({
        name: 'has a significant MR edge',
        fn: (r) => r.mrEdge !== '' && r.mrEdge !== 'None',
      });
    }
    if (mrFilter === 'causal') {
      steps.push({
        name: 'Tier-1 protein → disease evidence',
        fn: (r) => r.mrRole === 'intermediate' || r.mrRole === 'both',
      });
    }
    // Direction and instrument are NOT exclusive of each other: a protein can
    // carry a causal forward edge and a reverse edge at once, which is exactly
    // what mr_role = "both" records.
    if (dirFilter === 'forward') {
      steps.push({
        name: 'protein → disease direction',
        fn: (r) => r.hasCis || r.hasTrans || r.pdtCis1,
      });
    }
    if (dirFilter === 'reverse') {
      steps.push({ name: 'disease → protein direction', fn: (r) => r.hasDP });
    }
    if (dirFilter === 'bothdir') {
      steps.push({
        name: 'both directions on the same protein',
        fn: (r) => (r.hasCis || r.hasTrans || r.pdtCis1) && r.hasDP,
      });
    }
    if (instFilter === 'cis') {
      steps.push({
        name: 'cis instrument',
        fn: (r) => r.hasCis || r.pdtCis1 || r.pdtClass === 'cis',
      });
    }
    if (instFilter === 'trans') {
      steps.push({
        name: 'trans instrument',
        fn: (r) => r.hasTrans || r.pdtClass === 'trans',
      });
    }
    if (supportValue !== 'all') {
      steps.push({
        name: `platform support "${supportValue}"`,
        fn: (r) => r.mrSupport === supportValue,
      });
    }

    let cur = base;
    let blame = null;
    for (const s of steps) {
      const before = cur.length;
      cur = cur.filter(s.fn);
      if (before > 0 && cur.length === 0 && !blame) blame = s.name;
    }
    return { drawn: cur, reported: base, culprit: blame };
  }, [rows, trial, xSig, ySig, mrFilter, dirFilter, instFilter, supportValue]);

  // --- the published correlation for (spec, exposure, trial) ---------------
  const published = useMemo(() => {
    if (!corr?.exposure_id || !specKey) return null;
    for (let i = 0; i < corr.exposure_id.length; i += 1) {
      if (corr.spec[i] === specKey && corr.exposure_id[i] === exposure
        && corr.intervention[i] === trial.corr) {
        return {
          r: num(corr.r[i]),
          p: num(corr.pval[i]),
          q: num(corr.pval_BH[i]),
          neff: num(corr.n_eff[i]),
          nprot: num(corr.n_proteins[i]),
          npairs: num(corr.n_pairs_in_spec[i]),
          rPearson: num(corr.r_pearson_unweighted[i]),
          rSpearman: num(corr.r_spearman[i]),
        };
      }
    }
    return null;
  }, [corr, specKey, exposure, trial]);

  // Recomputed on the points currently drawn, with the published estimator, so
  // a reader who filters still gets a number that describes what they can see.
  // The headline stays the published one; this sits beside it, labelled.
  const onScreen = useMemo(() => {
    const withRel = rows.filter((r) => r.inSpec && r.rel != null);
    const meanRel = withRel.length
      ? withRel.reduce((a, r) => a + r.rel, 0) / withRel.length
      : 0;
    const x = [];
    const y = [];
    const w = [];
    drawn.forEach((r) => {
      const wt = Math.max(r.rel == null ? meanRel : r.rel, 0);
      if (wt <= 0) return;   // zero reliability contributes nothing, as upstream
      x.push(r.beta);
      y.push(r.trials[trial.id].e);
      w.push(wt);
    });
    return weightedPearson(x, y, w);
  }, [rows, drawn, trial]);

  const narrowed = drawn.length !== reported.length;
  const scheme = SCHEMES[colorBy];

  // --- points, legend, table ----------------------------------------------
  const points = useMemo(() => drawn.map((r) => {
    const t = r.trials[trial.id];
    return {
      id: r.id,
      label: r.protein,
      x: r.beta,
      y: t.e,
      // The error-bar channel carries an interval and nothing else -- the
      // shared component draws it grey on purpose, so it can never be mistaken
      // for a second encoding.
      xlo: r.se == null ? null : r.beta - 1.96 * r.se,
      xhi: r.se == null ? null : r.beta + 1.96 * r.se,
      ylo: t.se == null ? null : t.e - 1.96 * t.se,
      yhi: t.se == null ? null : t.e + 1.96 * t.se,
      color: scheme.colors[scheme.of(r)] || '#9E9E9E',
        // Point AREA carries the Eldjarn Olink-SomaScan assay correlation, as
        // asked. Missing reliability is NOT drawn small: 22% of proteins were
        // never measured on both platforms, and a vanishing marker would read
        // as "the platforms disagreed" when it means "nobody looked". Those
        // keep the mid size and are called out in the legend and the table.
        size: r.rel == null ? 8 : 5 + 9 * Math.max(0, Math.min(1, r.rel)),
      meta: {
        protein: r.protein,
        beta: ci(r.beta, r.se),
        betaBase: f3(r.betaBase),
        p: fp(r.p),
        replicated: r.replicated ? 'replicated' : 'not replicated',
        effect: ci(t.e, t.se),
        // Never an em dash here: a dash in a numeric column reads as zero, and
        // a missing assay correlation is not a low one.
        rel: r.rel == null ? 'no assay pair' : f2(r.rel),
        role: r.mrRole || 'not tested',
        supportArm: r.mrSupport || 'not tested',
        edge: edgeText(r),
        disease: diseaseText(r),
      },
    };
  }), [drawn, trial, scheme]);

  const columns = useMemo(() => {
    const cols = [
      { key: 'protein', label: 'Protein' },
      { key: 'beta', label: 'UKB β (95% CI)', align: 'right' },
    ];
    // Only worth a column when the reader has moved off the primary spec: it is
    // what makes the attenuation legible protein by protein instead of only in
    // the headline r.
    if (!specIsPrimary) cols.push({ key: 'betaBase', label: 'β under base', align: 'right' });
    return cols.concat([
      { key: 'p', label: 'p', align: 'right' },
      { key: 'replicated', label: 'UKB' },
      { key: 'effect', label: `${trial.label} effect (95% CI)`, align: 'right' },
      { key: 'rel', label: 'Olink–Soma r', align: 'right' },
      { key: 'role', label: 'MR role' },
      { key: 'supportArm', label: 'Platform' },
      { key: 'edge', label: 'Best P→D tier' },
      { key: 'disease', label: 'Disease', wrap: true },
    ]);
  }, [trial, specIsPrimary]);

  const legend = useMemo(() => {
    const counts = new Map();
    drawn.forEach((r) => {
      const k = scheme.of(r);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const keys = scheme.order.filter((k) => counts.has(k));
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        {keys.map((k) => (
          <Swatch key={k} color={scheme.colors[k]}>
            {`${(scheme.names && scheme.names[k]) || k} (${counts.get(k)})`}
          </Swatch>
        ))}
      </Box>
    );
  }, [drawn, scheme]);

  // Zero lines only. A y = x diagonal would be a lie here: the axes are
  // different estimands in different units, so the reference that carries
  // meaning is the sign quadrant, not the identity line.
  const shapes = [
    {
      type: 'line', xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0, y1: 1,
      line: { width: 1, color: '#ddd' },
    },
    {
      type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 0,
      line: { width: 1, color: '#ddd' },
    },
  ];

  // The correlation, printed ON the plot. The number is the claim; it should
  // not live only in a chip above the chart where it can be scrolled away from
  // the cloud it describes.
  const annotations = useMemo(() => {
    const lines = [];
    if (published?.r != null) {
      lines.push(`weighted r = ${f2(published.r)}   (n_eff ${f2(published.neff)}, `
        + `${published.nprot} proteins reported)`);
    }
    if (narrowed && onScreen) {
      lines.push(`on screen, recomputed: r = ${f2(onScreen.r)}   (${onScreen.n} points)`);
    }
    if (!lines.length) return [];
    return [{
      xref: 'paper',
      yref: 'paper',
      x: 0.01,
      y: 0.99,
      xanchor: 'left',
      yanchor: 'top',
      showarrow: false,
      align: 'left',
      text: lines.join('<br>'),
      font: { size: 11, color: '#333' },
      bgcolor: 'rgba(255,255,255,0.85)',
      bordercolor: '#ddd',
      borderwidth: 1,
      borderpad: 4,
    }];
  }, [published, narrowed, onScreen]);

  return (
    <SectionCard
      title="One scatter: the UK Biobank effect against the trial that moved the same protein"
      subtitle={
        // The estimand caveat is stated once, in the page-level warning, and in full
        // behind the page's disclosure. A subtitle's job is to name the axes.
        'x is the UK Biobank exposure→protein effect; y is what a randomized trial '
        + 'reported for the same protein. Different estimands — which is why agreement '
        + 'between them is informative rather than circular.'
      }
      loading={kLoading}
      error={kError}
    >
      {/* ---- what is being plotted -------------------------------------- */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ minWidth: 300, flex: '1 1 340px', maxWidth: 520 }}>
          <Typography
            variant="caption"
            sx={{ display: 'block', fontWeight: 700, color: 'text.secondary', letterSpacing: 0.3 }}
          >
            EXPOSURE
          </Typography>
          <Select
            options={options}
            value={{ value: exposure, label: termLabel(exposure) }}
            onChange={(o) => setWanted(o.value)}
            isSearchable
            placeholder="Search an exposure…"
          />
        </Box>
        <Picker
          label="TRIAL"
          value={trial.id}
          onChange={setTrialId}
          options={TRIALS.map((t) => ({ id: t.id, label: t.label }))}
          help={trial.arm}
        />
        {category && (
          <Chip
            size="small"
            label={prettyCategory(category)}
            sx={{
              mt: 2, backgroundColor: ecatColor(category), color: '#fff', fontWeight: 600,
            }}
          />
        )}
      </Box>

      {loading && <Typography variant="body2">Loading {termLabel(exposure)}…</Typography>}
      {error && (
        <Typography variant="body2" color="error">{String(error.message || error)}</Typography>
      )}

      {!loading && !error && spec && (
        <>
          {/* ---- covariate specification -------------------------------- */}
          <Box sx={{ mt: 1.5 }}>
            <Picker
              label="COVARIATE SPECIFICATION"
              value={spec.id}
              onChange={setSpecId}
              options={specs.map((s) => ({ id: s.id, label: specLabel(s.id) }))}
              help={`${spec.varies || spec.kind}${spec.covset ? ` · covariate set: ${spec.covset}` : ''}`}
            />
          </Box>

          {/*
            THE CAVEAT THIS PICKER CANNOT SHIP WITHOUT.
            An effect that shrinks under +BMI has NOT been shown to run through
            BMI. Adjustment cannot separate mediation from confounding, and the
            manuscript withdrew that claim outright
            (project_bmi_adjustment_not_mediation). Every word below is about
            attenuation and robustness; none of it licenses a mediation reading.
          */}
          <Alert severity="warning" sx={{ mb: 2 }}>
            <b>This picker shows attenuation, not mediation.</b>
            {' '}
            It asks one question: whether the concordance survives a richer adjustment. If r
            falls when BMI or the clinical block enters the model, that says the agreement is
            not robust to that adjustment. It does <b>not</b> say the exposure acts through
            BMI. Adjusting for a covariate cannot separate mediation from confounding, so a
            shrinking estimate is equally consistent with either. Read a drop as “not robust to
            this adjustment”, never as “this much of it is mediated by BMI”.
            {spec.kind === 'sample' && (
              <>
                {' '}
                <b>{specLabel(spec.id)}</b>
                {' '}
                is a different kind of change again — it restricts who is in the analysis
                rather than what is adjusted for, so the sample moves along with the estimate.
              </>
            )}
          </Alert>

          {/* ---- the annotation controls -------------------------------- */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Picker
              label="UK BIOBANK SIDE (x)"
              value={xSig}
              onChange={setXSig}
              options={[
                { id: 'any', label: 'any estimate' },
                { id: 'nominal', label: 'p < 0.05' },
                { id: 'replicated', label: 'replicated' },
              ]}
              help="“Replicated” is the paper’s rule: Bonferroni in the discovery split and again in the held-out split."
            />
            <Picker
              label="TRIAL SIDE (y)"
              value={ySig}
              onChange={setYSig}
              options={[
                { id: 'this', label: `reported by ${trial.label}` },
                { id: 'multi', label: 'and by another trial' },
              ]}
              help={`A point exists only where ${trial.label} reported the protein — ${trial.reportedNote}.`}
            />
            <Picker
              label="MR OVERLAP"
              value={mrFilter}
              onChange={setMrFilter}
              options={[
                { id: 'all', label: 'all proteins' },
                { id: 'edge', label: 'any MR edge' },
                { id: 'causal', label: 'protein → disease' },
              ]}
              help="“Any MR edge” uses this exposure’s strongest significant edge; “protein → disease” uses the protein’s Tier-1 record."
            />
            <Picker
              label="EDGE DIRECTION"
              value={dirFilter}
              onChange={setDirFilter}
              options={[
                { id: 'all', label: 'either' },
                { id: 'forward', label: 'protein → disease' },
                { id: 'reverse', label: 'disease → protein' },
                { id: 'bothdir', label: 'both' },
              ]}
              help="Not exclusive: a protein can carry a causal edge and a reverse edge at once, which is what “both” selects."
            />
            <Picker
              label="INSTRUMENT CLASS"
              value={instFilter}
              onChange={setInstFilter}
              options={[
                { id: 'all', label: 'either' },
                { id: 'cis', label: 'cis' },
                { id: 'trans', label: 'trans' },
              ]}
              help="Tier 2 is the LD-confounded cis tier the manuscript demotes on purpose, and does not count here as a causal cis edge."
            />
            <Picker
              label="PLATFORM REPLICATION"
              value={supportValue}
              onChange={setSupport}
              options={supportOptions.map((v) => ({ id: v, label: v === 'all' ? 'any' : v }))}
              help="Which arm carried the MR edge. Olink is the UK Biobank arm, SomaScan the deCODE arm."
            />
            <Picker
              label="COLOUR"
              value={colorBy}
              onChange={setColorBy}
              options={Object.keys(SCHEMES).map((k) => ({ id: k, label: SCHEMES[k].button }))}
              help={scheme.note}
            />
          </Box>

          {/* ---- the number on the cloud -------------------------------- */}
          <Box sx={{ border: '1px solid #e6e6e6', borderRadius: 1, p: 1.25, mt: 0.5, mb: 2 }}>
            {published ? (
              <>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {`Reliability-weighted Pearson r = ${f3(published.r)}`}
                  {published.neff != null && `   ·   n_eff ${f2(published.neff)}`}
                  {published.nprot != null && `   ·   ${published.nprot} proteins`}
                  {published.p != null && `   ·   p ${fp(published.p)}`}
                  {published.q != null && `   ·   q (BH) ${fp(published.q)}`}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  The paper's number: Pearson r weighted by assay reliability, over every
                      protein
                      {` ${trial.label} `}
                      reported under
                      {` ${specLabel(spec.id)}`}
                      , before any filter here. Proteins with non-positive reliability drop
                      out, so the count can sit below the
                      {` ${published.npairs == null ? '—' : published.npairs} `}
                      pairs available.
                </Typography>
                <Box sx={{ mt: 0.75, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`unweighted Pearson r ${f3(published.rPearson)}`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Spearman ρ ${f3(published.rSpearman)}`}
                  />
                  {narrowed && onScreen && (
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={`on screen, recomputed: r ${f3(onScreen.r)} over ${onScreen.n} points`}
                    />
                  )}
                  {narrowed && !onScreen && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label="on screen: fewer than 3 points, no r"
                    />
                  )}
                </Box>
                {narrowed && (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}
                  >
                    The controls have narrowed the set, so the headline r no longer describes
                    what is drawn. The recomputed value applies the same weighted estimator to
                    the visible points — it imputes a missing reliability from this exposure’s
                    own proteins rather than the whole panel, so it can differ from the
                    published figure in the third decimal even with nothing filtered out. The
                    search box under the plot filters further still, and is in neither number.
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No correlation is published for this exposure, specification and trial — fewer
                than three proteins overlap, so no r is estimable.
              </Typography>
            )}
          </Box>

          {/* ---- what a BLANK means, and why it differs by trial --------- */}
          {panelKnown ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              <b>{trial.label}</b>
              {` assayed ${coverage.assayed} of ${coverage.tested} and reported `}
              {`${coverage.reported}`}
              . Of the rest,
              {` ${coverage.measuredNull} `}
              were <b>measured and did not move</b> and
              {` ${coverage.offPanel} `}
              were <b>never on the panel</b> — a real distinction, taken from the
              trial's own gene list, not inferred from absence.
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <b>
                {trial.label}
                {' '}
                is not symmetric with the GLP-1 trials and must not be read as if it were.
              </b>
              {' '}
              Its published table contains only the proteins that reached q &lt; 0.01, so the
              assayed panel is not in the file, and it was deliberately not back-filled from the
              hit list. For
              {` ${trial.label} `}
              we can say <b>reported</b> —
              {` ${coverage.reported} of ${coverage.tested} `}
              proteins here — but we can <b>never</b> say “measured and null”. The
              {` ${coverage.unknown} `}
              proteins with no
              {` ${trial.label} `}
              value are <b>unknown</b>: some were assayed and null, some were never assayed, and
              the published record cannot tell them apart. Absence here is not evidence of no
              effect.
            </Alert>
          )}

          {coverage.dropped > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {`${coverage.dropped} `}
              {coverage.dropped === 1 ? 'pair is' : 'pairs are'}
              {' not estimated under '}
              {specLabel(spec.id)}
              {' — that specification drops the people the estimate needed. They are withheld '}
              from the plot rather than drawn at zero, which would invent a null effect.
            </Alert>
          )}

          <Typography
            variant="caption"
            sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}
          >
            <b>{`Colour: ${scheme.label}.`}</b>
            {' '}
            Error bars are 95% intervals. <b>Marker area</b> is the Olink–SomaScan assay
              correlation (Eldjarn et al.) — bigger means the platforms agree more closely
              about that protein. The
              {` ${coverage.tested - coverage.withRel} of ${coverage.tested} `}
              with no assay pair are drawn <b>mid-size, not small</b>: unknown agreement,
              not poor agreement.
            </Typography>

          {culprit && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Nothing is left to plot, and the control that emptied it is
              {' '}
              <b>{culprit}</b>
              . No protein for this exposure and trial satisfies it.
            </Alert>
          )}

          <LinkedScatterTable
            points={points}
            columns={columns}
            xTitle={`UK Biobank exposure→protein β — ${specLabel(spec.id)}`}
            yTitle={trial.yTitle}
            height={520}
            searchPlaceholder="Filter proteins…"
            legend={legend}
            rowsVisible={12}
            extraShapes={shapes}
            extraAnnotations={annotations}
            emptyNote={
              culprit
                ? `No protein passes “${culprit}” for ${termLabel(exposure)} and ${trial.label}.`
                : `${trial.label} reported none of this exposure’s proteins, so there is nothing to plot.`
            }
          />
        </>
      )}
    </SectionCard>
  );
}
