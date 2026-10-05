// ---------------------------------------------------------------------------
// Reading the variance sections.
//
// The payload ships LONG and columnar -- one row per (spec, protein, component)
// with each column its own array -- because that is what packs and gzips well:
// varcat_protein is 14.7 MB of TSV and 0.35 MB on the wire, almost all of the
// saving coming from the repeated specification strings collapsing.
//
// Long is not what a chart wants, so every panel indexes it once here rather
// than sweeping the arrays on each render. These helpers are memo-friendly:
// hand them the section data and they return maps keyed the way the panels ask.
// ---------------------------------------------------------------------------

export const COMPONENTS = ['Covars', 'G', 'E', 'GxE'];
export const COMPONENT_LABEL = {
  Covars: 'Covariates', G: 'Genetics', E: 'Exposome', GxE: 'GxE',
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// The five specifications the whole site uses. The payload carries nine -- it
// also holds elastic net and three interaction variants (ExC, GxC, GxC+ExC) --
// but those appear on no other page, and a picker offering a vocabulary of
// specifications unique to one page makes the pages harder to read against each
// other rather than richer. The data is still published; only the picker is
// narrowed, so widening it again is this list, not a rebuild.
export const SITE_SPECS = [
  'M1_base_lasso',            // base -- the paper's primary model
  'M1_base_bmi_lasso',        // + BMI
  'M1_base_clinical_lasso',   // + clinical
  'M1_base_draw_lasso',       // + blood draw
  'M1_base_exclprev_lasso',   // healthy at baseline (a SAMPLE specification)
];

/** varcomp_specs_meta -> [{id, covariate_set, estimator, sample, interactions}] */
export function specList(meta, { all = false } = {}) {
  if (!meta?.spec) return [];
  let out = meta.spec.map((id, i) => ({
    id,
    covariate_set: meta.covariate_set?.[i],
    estimator: meta.estimator?.[i],
    sample: meta.sample_spec?.[i],
    interactions: meta.interactions?.[i],
  }));
  if (!all) out = out.filter((x) => SITE_SPECS.includes(x.id));
  // Reporting order, not alphabetical: base, then the covariate layers, then the
  // sample specification. A picker that opened on a sensitivity would quietly
  // make the paper's numbers the ones you have to hunt for.
  out.sort((a, b) => SITE_SPECS.indexOf(a.id) - SITE_SPECS.indexOf(b.id));
  return out;
}

export function specLabel(s) {
  if (!s) return '';
  const cov = {
    base: 'base', base_bmi: '+ BMI', base_clinical: '+ clinical', base_draw: '+ blood draw',
  }[s.covariate_set] || s.covariate_set;
  const bits = [cov];
  if (s.sample === 'excl_prevalent') bits.push('healthy at baseline');
  if (s.estimator && s.estimator !== 'lasso') {
    bits.push(s.estimator === 'enet' ? 'elastic net' : s.estimator);
  }
  if (s.interactions && s.interactions !== 'none') bits.push(s.interactions);
  return bits.join(', ');
}

/** varcomp_reach -> {spec: {component: {grid:[], n:[]}}} */
export function reachIndex(d) {
  const out = {};
  if (!d?.spec) return out;
  for (let i = 0; i < d.spec.length; i += 1) {
    const s = (out[d.spec[i]] ||= {});
    const c = (s[d.component[i]] ||= { grid: [], n: [] });
    c.grid.push(num(d.threshold[i]));
    c.n.push(num(d.n_proteins[i]));
  }
  return out;
}

/** varcat_reach -> {spec: {category: {grid:[], n:[]}}} */
export function catReachIndex(d) {
  const out = {};
  if (!d?.spec) return out;
  for (let i = 0; i < d.spec.length; i += 1) {
    const s = (out[d.spec[i]] ||= {});
    const c = (s[d.category[i]] ||= { grid: [], n: [] });
    c.grid.push(num(d.threshold[i]));
    c.n.push(num(d.n_proteins[i]));
  }
  return out;
}

/**
 * varcomp_protein -> {proteins:[], bySpec:{spec:{component:{r2:[],lo:[],hi:[]}}}}
 * Values are positional against `proteins`, so a chart maps one array rather
 * than looking up a key per point.
 */
export function proteinIndex(d) {
  if (!d?.spec) return null;
  const proteins = [...new Set(d.protein)].sort();
  const pi = new Map(proteins.map((p, i) => [p, i]));
  const bySpec = {};
  for (let i = 0; i < d.spec.length; i += 1) {
    const s = (bySpec[d.spec[i]] ||= {});
    const c = (s[d.component[i]] ||= {
      r2: new Array(proteins.length).fill(null),
      lo: new Array(proteins.length).fill(null),
      hi: new Array(proteins.length).fill(null),
    });
    const k = pi.get(d.protein[i]);
    c.r2[k] = num(d.r2[i]);
    c.lo[k] = num(d.ci_lo?.[i]);
    c.hi[k] = num(d.ci_hi?.[i]);
  }
  return { proteins, index: pi, bySpec };
}

/** varcat_protein -> {proteins:[], categories:[], bySpec:{spec:{cat:[r2...]}}} */
export function catProteinIndex(d) {
  if (!d?.spec) return null;
  const proteins = [...new Set(d.protein)].sort();
  const categories = [...new Set(d.category)].sort();
  const pi = new Map(proteins.map((p, i) => [p, i]));
  const bySpec = {};
  for (let i = 0; i < d.spec.length; i += 1) {
    const s = (bySpec[d.spec[i]] ||= {});
    const arr = (s[d.category[i]] ||= new Array(proteins.length).fill(null));
    arr[pi.get(d.protein[i])] = num(d.r2[i]);
  }
  return { proteins, categories, index: pi, bySpec };
}

/** varcomp_gradient -> {proteins:[], greml:{comp:[]}, se:{comp:[]}, heap:{comp:[]}} */
export function gradientIndex(d) {
  if (!d?.protein) return null;
  const proteins = [...new Set(d.protein)].sort();
  const pi = new Map(proteins.map((p, i) => [p, i]));
  const mk = () => ({ G: new Array(proteins.length).fill(null),
    E: new Array(proteins.length).fill(null),
    GxE: new Array(proteins.length).fill(null) });
  const greml = mk(); const se = mk(); const heap = mk();
  for (let i = 0; i < d.protein.length; i += 1) {
    const c = d.component[i];
    if (!(c in greml)) continue;
    const k = pi.get(d.protein[i]);
    greml[c][k] = num(d.greml[i]);
    se[c][k] = num(d.greml_se?.[i]);
    heap[c][k] = num(d.heap_r2?.[i]);
  }
  return { proteins, index: pi, greml, se, heap };
}
