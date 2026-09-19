// ---------------------------------------------------------------------------
// The documentation table of contents, in reading order.
//
// ONE list, imported by both the Documentation page and the header menu. It
// lived in Documentation.js while the header kept its own hand-written copy of
// the same items, and the two drifted the moment a page was added: the
// references page was routed and listed in the sidebar but unreachable from the
// header, which is how most people navigate.
//
// `group: true` starts a new visual group -- the header draws a divider before
// it; the sidebar ignores it.
// ---------------------------------------------------------------------------

export const DOC_PAGES = [
  { path: 'about', label: 'About HEAP', blurb: 'What the resource contains and how it is put together.' },
  { path: 'quickstart', label: 'Quick start', blurb: 'Find a protein, an exposure or a disease; download; call the API.' },
  { group: true, path: 'evidence-tiers', label: 'Evidence tiers', blurb: 'What each badge on a relationship means, rung by rung.' },
  { path: 'models', label: 'Specifications', blurb: 'The six covariate sets, and which one every main result uses.' },
  { path: 'dictionary', label: 'Exposome dictionary', blurb: 'All 169 analyzed exposures, plus the candidates that were excluded.' },
  { group: true, path: 'api', label: 'Data API', blurb: 'Static file API over a public CDN, with R and Python examples.' },
  { path: 'methods', label: 'Detailed methods', blurb: 'The six analysis modules and what each one computes.' },
  { path: 'changelog', label: 'Changelog', blurb: 'What changed structurally between v1 and v2.' },
  { path: 'cite', label: 'How to cite', blurb: 'Preprint DOI, license, and dataset versioning.' },
  { path: 'credits', label: 'References and credits', blurb: 'The datasets, drawings and methods this site is built on.' },
  { path: 'faqs', label: 'FAQs', blurb: 'Short answers, each pointing at the page that carries the detail.' },
];
