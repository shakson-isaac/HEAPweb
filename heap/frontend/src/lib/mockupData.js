import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Loader for the three design prototypes.
//
// These read from public/mockup/, NOT from the published payload. That is
// deliberate: the point is to argue about the design before anything is
// registered as a section or pushed to the bucket. When a design is accepted
// its data moves to a real builder and this loader stops being used by it.
//
// Files are a few MB and are fetched once per page visit, which is fine for a
// local prototype and would not be for production -- the real sections will be
// sharded and column-packed the way every other section is.
// ---------------------------------------------------------------------------
const cache = new Map();

export function useMockup(name) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    if (cache.has(name)) {
      setState({ data: cache.get(name), loading: false, error: null });
      return () => { alive = false; };
    }
    setState({ data: null, loading: true, error: null });
    fetch(`${process.env.PUBLIC_URL || ''}/mockup/${name}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((d) => {
        cache.set(name, d);
        if (alive) setState({ data: d, loading: false, error: null });
      })
      .catch((e) => { if (alive) setState({ data: null, loading: false, error: e }); });
    return () => { alive = false; };
  }, [name]);
  return state;
}

/** "M1_base_clinical_lasso" + its axes -> a label a reader can act on. */
export function experimentLabel(exp, axes) {
  if (!axes) return exp;
  const bits = [];
  const cov = { base: 'base', base_bmi: '+ BMI', base_clinical: '+ clinical', base_draw: '+ blood draw' };
  bits.push(cov[axes.covariate_set] || axes.covariate_set);
  if (axes.sample === 'excl_prevalent') bits.push('healthy at baseline');
  if (axes.estimator !== 'lasso') bits.push(axes.estimator === 'enet' ? 'elastic net' : axes.estimator);
  if (axes.interactions && axes.interactions !== 'none') bits.push(axes.interactions);
  return bits.join(', ');
}
