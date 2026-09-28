// Keep a piece of page state in the URL, with useState's signature.
//
// Every selection on this site used to live in a plain useState, which meant
// no view could be linked to, cited, or survive a refresh. For a companion
// site to a paper that is the wrong default: a reviewer needs to be able to
// point at "this protein on the mediation page", not describe how to click
// their way to it.
//
//   const [protein, setProtein] = useUrlState('protein', 'LEP');
//
// Reads and writes ?protein=... . Everything else behaves like useState,
// functional updater included.
//
// Two deliberate choices:
//
//   * A value equal to the default is REMOVED from the query string rather
//     than written to it. URLs stay clean until someone actually departs from
//     the default, and a bare /results/mediation keeps working as it always
//     did.
//
//   * Writes use `replace`, so changing a dropdown does not push a history
//     entry. Otherwise Back would walk through every intermediate selection
//     instead of leaving the page, which is what people expect Back to do.
//
// KEYS ARE PAGE-GLOBAL. Two components on one page sharing a key will fight
// over it -- Mediation.js, for instance, has two separate `panel` states, and
// they need distinct keys such as `panel` and `driverPanel`.
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// URL values are always strings; give the caller back the type they supplied
// a default in, so `useUrlState('n', 10)` does not silently become "10".
function coerce(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof fallback === 'boolean') return raw === 'true';
  return raw;
}

export function useUrlState(key, initial) {
  const [params, setParams] = useSearchParams();
  const value = coerce(params.get(key), initial);

  const set = useCallback(
    (next) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          const current = coerce(p.get(key), initial);
          const v = typeof next === 'function' ? next(current) : next;
          if (v === null || v === undefined || v === '' || v === initial) {
            p.delete(key);
          } else {
            p.set(key, String(v));
          }
          return p;
        },
        { replace: true },
      );
    },
    [key, initial, setParams],
  );

  return [value, set];
}

export default useUrlState;
