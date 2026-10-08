// Page views for a single-page app.
//
// WHY THIS FILE EXISTS. gtag.js runs its `config` call once, when the script in
// public/index.html loads, and that call is what sends the page_view. React
// Router then changes the URL with history.pushState, which gtag never sees. So
// before this, Google Analytics recorded only the page a visitor first landed
// on -- measured 2026-10-08 against the live site: one page_view on arrival,
// then zero across three in-app navigations to /downloads, /results/causal and
// back to /. Every click through Results, Documentation and Downloads was
// invisible, which is most of what anyone would want to know.
//
// `send_page_view: false` is set on the config call in index.html so the
// initial view is not counted twice -- once by gtag and once by the effect
// below, which also runs on first render.
//
// GA4's "enhanced measurement" has a browser-history option that can cover
// this from the console instead. It is deliberately not relied on: it is a
// server-delivered setting that can be toggled off by anyone with access to the
// property, and a silent change there would stop collection with nothing in
// this repository to show why.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** The measurement ID configured in public/index.html, or null if gtag is absent. */
function gtag(...args) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

/**
 * Sends a page_view on every route change, including the first render.
 *
 * Mounted inside <Router> in App.js -- useLocation() throws outside a router
 * context, so it cannot be hoisted to index.js.
 */
export default function usePageViews() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // page_location carries the full URL including origin; page_path is what
    // GA4's "Pages and screens" report groups on.
    gtag('event', 'page_view', {
      page_path: pathname + search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, search]);
}
