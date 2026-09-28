// Warm the charting chunk while the visitor is reading the homepage.
//
// The results routes are lazy (see pages/Results.js), so Plotly does not start
// downloading until someone clicks into one -- and then they wait on ~570 KB
// before the first pixel of a chart. The homepage needs none of that code but
// is otherwise idle, which makes it the free place to fetch it.
//
// requestIdleCallback yields to anything the page still wants to do; Safari
// has never shipped it, hence the timeout fallback. Failures are swallowed on
// purpose: this is an optimization, and a offline visitor should still get a
// working homepage rather than an unhandled rejection.
export function prefetchCharts() {
  // Bound to `window` on purpose. This module is ESM, so it runs in strict
  // mode and a bare `idle(fn)` would call a Web IDL method with `this ===
  // undefined`, which Chrome rejects outright with "Illegal invocation".
  const idle = window.requestIdleCallback
    ? window.requestIdleCallback.bind(window)
    : (fn) => window.setTimeout(fn, 1200);
  const cancel = window.cancelIdleCallback
    ? window.cancelIdleCallback.bind(window)
    : window.clearTimeout.bind(window);
  const handle = idle(() => {
    import('../pages/subpages/MainResults').catch(() => {});
  });
  return () => cancel(handle);
}
