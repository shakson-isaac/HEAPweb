// ---------------------------------------------------------------------------
// Reading the mediation sections.
//
// Long and columnar, like the variance sections, and for the same reason: the
// specification and disease strings repeat on every row and collapse to almost
// nothing once packed.
//
// DISEASES ARE KEYED ON DZ_ID AND LABELLED SEPARATELY. The two upstream sources
// spell disease names differently -- the deposit keeps the British forms it was
// written with, disease_mediators.tsv has been Americanised -- and twelve names
// disagree. Joining on the label silently lost those twelve. med_disease carries
// id -> label, and every panel renders through it.
//
// SPECIFICATIONS COME FROM THE DATA. Only a partitioned run fits the 13 exposure
// categories and cis/trans separately, so which specifications these panels can
// offer depends on which partitioned runs have been summarised -- a moving
// target while the arrays finish. Nothing here hard-codes a list; a picker asks
// specsIn() what the payload actually carries.
// ---------------------------------------------------------------------------

export const SPEC_LABEL = {
  base: 'Primary',
  base_bmi: '+ BMI',
  base_clinical: '+ clinical',
  base_draw: '+ blood draw',
  base_exclprev: 'Healthy at baseline',
};
const ORDER = ['base', 'base_bmi', 'base_clinical', 'base_draw', 'base_exclprev'];

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Specifications present in a section, in reporting order. */
export function specsIn(d) {
  if (!d?.spec) return [];
  const seen = [...new Set(d.spec)];
  return ORDER.filter((s) => seen.includes(s));
}

/** med_spectrum -> {spec: [{p, pleiotropy, maxEff, nExposures, diseases}]} */
export function spectrumIndex(d) {
  const out = {};
  if (!d?.spec) return out;
  for (let i = 0; i < d.spec.length; i += 1) {
    (out[d.spec[i]] ||= []).push({
      p: d.protein[i],
      x: num(d.pleiotropy[i]) || 0,
      y: num(d.max_eff_pct[i]) || 0,
      n: num(d.n_exposure_categories?.[i]) || 1,
      dz: d.disease_ids?.[i] ? String(d.disease_ids[i]).split('; ') : [],
    });
  }
  return out;
}

/**
 * med_grid -> {spec: {counts: Map("cat|dz" -> n), proteins: Map(same -> []),
 *                     categories: [], diseases: [], total: Map(dz -> n)}}
 */
export function gridIndex(d) {
  const out = {};
  if (!d?.spec) return out;
  for (let i = 0; i < d.spec.length; i += 1) {
    const g = (out[d.spec[i]] ||= {
      counts: new Map(), proteins: new Map(), cats: new Set(), dzs: new Set(),
      total: new Map(),
    });
    const dz = d.disease_id[i];
    const key = `${d.category[i]}|${dz}`;
    const n = num(d.n_proteins[i]) || 0;
    g.counts.set(key, n);
    g.proteins.set(key, d.proteins?.[i] ? String(d.proteins[i]).split('; ') : []);
    g.cats.add(d.category[i]);
    g.dzs.add(dz);
    g.total.set(dz, (g.total.get(dz) || 0) + n);
  }
  Object.values(out).forEach((g) => {
    g.categories = [...g.cats].sort();
    g.diseases = [...g.dzs].sort();
  });
  return out;
}

/** med_disease -> {label: Map(id -> name), cls: Map(id -> class)} */
export function diseaseInfo(d) {
  const label = new Map();
  const cls = new Map();
  if (!d?.disease_id) return { label, cls };
  d.disease_id.forEach((id, i) => {
    label.set(id, d.disease?.[i] || id);
    cls.set(id, d.class?.[i] || 'Other');
  });
  return { label, cls };
}

const DRIVER_COLS = ['pxs', 'cis', 'trans', 'pgs'];

/** med_drivers -> {spec: [{protein, disease, nCases, pm, pxs:{hr,lo,hi,sig}, ...}]} */
export function driverIndex(d) {
  const out = {};
  if (!d?.spec) return out;
  for (let i = 0; i < d.spec.length; i += 1) {
    const rec = {
      protein: d.protein[i],
      disease: d.disease_id[i],
      nCases: num(d.n_cases?.[i]),
      pm: num(d.prop_mediated?.[i]),
    };
    DRIVER_COLS.forEach((c) => {
      rec[c] = {
        hr: num(d[c]?.[i]),
        lo: num(d[`${c}_lo`]?.[i]),
        hi: num(d[`${c}_hi`]?.[i]),
        sig: String(d[`${c}_sig`]?.[i]) === '1',
      };
    });
    (out[d.spec[i]] ||= []).push(rec);
  }
  return out;
}
