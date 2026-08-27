// src/pages/Home.js
//
// Landing page for the HEAP resource.
//
// What changed and why: the previous version described the ORIGINAL manuscript --
// "4 modules" (Variance Decomposition, GxE Associations, Mediation, Interventional
// Validation). The revised manuscript has six modules, a different central claim,
// and GxE demoted to the supplement (standing decision S10), so that copy was wrong
// on the front door of the site. See docs/WEBSITE_PLAN.md sections 1, 4 and 6.1.
//
// Editorial rules applied here:
//   S8  -- every rendered number is read from the payload (meta/headline.json.gz,
//          generated from HEAP_manuscript/macros/numbers.tex). Nothing hand-typed.
//   S13 -- structural copy (what the site holds, what a page shows, how to move
//          around it) is drafted here; anything that INTERPRETS a result is left
//          for the author and marked with an `AUTHOR:` comment.
//
// The old hero image (/HEAP_summ.png, still in public/) is deliberately NOT rendered.
// It is the graphical abstract for the original manuscript: it shows the retired
// four-module structure and a stale disease count, and it predates the reframe
// (WEBSITE_PLAN.md section 13, GA1-GA4). Showing it here would contradict the page
// around it. It comes back when the updated SVG abstract exists.

import React, { useEffect, useState } from 'react';
import { prefetchCharts } from '../lib/prefetch';
import { Link } from 'react-router-dom';
import { Alert } from '@mui/material';
import { WEB_DATA_BASE } from '../lib/heapdata';
import './Home.css';

// ---------------------------------------------------------------------------
// AUTHOR-OWNED COPY (S13)
//
// These two strings make (or would make) a scientific claim, so they are the
// author's to write, not mine. Each currently holds a neutral, factual fallback
// that describes the resource without interpreting any result. Replace the string;
// nothing else on the page depends on its wording.
// ---------------------------------------------------------------------------

// AUTHOR: hero claim -- needs Shakson's wording.
// The design plan's proposed hero sentence (WEBSITE_PLAN.md section 6.1) reads:
//   "Explore how 169 modifiable lifestyle and environmental exposures are reflected
//    in the human plasma proteome, how these signatures relate to disease, and which
//    relationships have genetic or interventional support."
// It is not used verbatim because it asserts what the proteome reflects. Fallback below.
const HERO_CLAIM =
  'A UK Biobank resource of exposure, proteome and disease summary statistics: '
  + 'browsable protein by protein and exposure by exposure, and available to download.';

// AUTHOR: reporter/intermediate framing -- needs Shakson's wording.
// The plan's proposed strapline (WEBSITE_PLAN.md section 3) reads:
//   "Most exposure-responsive proteins behave as biological reporters; a small subset
//    has genetic evidence consistent with causal mediation."
// That is the paper's central claim and is the author's sentence to approve, so the
// fallback below states only how the evidence is laid out on this site.
const HERO_FRAMING =
  'Observational association, disease link and genetic evidence (Mendelian randomization '
  + 'and colocalization) are shown separately for each relationship, never merged into a '
  + 'single verdict.';

// ---------------------------------------------------------------------------
// Stat bar -- macro-driven (S8)
//
// `meta/headline.json.gz` is generated from HEAP_manuscript/macros/numbers.tex by the
// payload builder; each macro arrives as {raw, value, note, section, file}. `raw` is the
// string exactly as the manuscript prints it ("2,686"), so it is what gets rendered --
// the site and the paper then cannot drift apart in formatting either.
//
// Fetched with plain fetch() rather than through heapdata's section helpers: those
// resolve a section id through the manifest, and this is a fixed meta path. The URL and
// the `cache: 'no-cache'` entry-point policy mirror src/lib/heapdata.js, and the objects
// are served with Content-Encoding: gzip so the browser inflates them for free.
// ---------------------------------------------------------------------------

const STAT_TILES = [
  { key: 'nParticipants', label: 'participants' },
  { key: 'nProteins', label: 'plasma proteins' },
  { key: 'nExposures', label: 'exposures tested' },
  { key: 'nReplAssoc', label: 'replicated associations' },
  { key: 'nProteinsAssoc', label: 'proteins with an association' },
  { key: 'nExposuresAssoc', label: 'exposures with an association' },
  { key: 'nDiseasesGEM', label: 'incident diseases' },
  {
    key: 'nExposuresPES',
    label: 'exposure scores (PES)',
    // Flagged, not silently corrected: the published macro says 164 while the weights
    // bundle's own manifest.tsv lists 160 directories (WEBSITE_PLAN.md G3, TASKS B5).
    // Which one is right is an author decision, so the page prints the published macro
    // and says the other number exists.
    footnote: '164 published; 160 exposure directories exist in the weights bundle',
  },
  { key: 'nColoc', label: 'colocalized cis-pQTL loci' },
];

/** A macro's printed form. Never falls back to a typed-in number -- absent means absent. */
function macroText(macros, key) {
  const m = macros && macros[key];
  if (!m) return null;
  if (m.raw !== undefined && m.raw !== null && String(m.raw).length) return String(m.raw);
  if (Number.isFinite(m.value)) return Number(m.value).toLocaleString();
  return null;
}

// Participants are a special case. The design plan budgeted for "50K+" on the stat bar
// because the cohort count was believed to be truncated at its source. In the payload
// actually published, \nParticipants is clean -- raw "53,014", value 53014, note
// "participants with a baseline (i0) proteomic draw -- CONFIRMED" (verified 2026-08-08
// against split_df in HEAP.rds) -- so the macro itself is rendered. The vague "50,000+"
// is kept only as the fallback for a future build where the macro is missing or comes
// back truncated (a value under 1,000 would be a truncated "53"-style entry), because an
// unambitious true number beats a precise wrong one.
function participantsText(macros) {
  const m = macros && macros.nParticipants;
  if (m && Number.isFinite(m.value) && m.value >= 1000) return macroText(macros, 'nParticipants');
  return '50,000+';
}

function StatBar({ macros, meta, loading, error }) {
  const sourceFile = meta && meta.sources && meta.sources.length
    ? String(meta.sources[0]).split('/').slice(-2).join('/')
    : 'macros/numbers.tex';

  return (
    <section className="home-stats" aria-label="HEAP in numbers">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load the headline numbers from {WEB_DATA_BASE}/meta/headline.json.gz:{' '}
          {String(error.message || error)}. Nothing is shown here rather than a stale or
          typed-in figure.
        </Alert>
      )}

      <div className="home-stat-grid">
        {STAT_TILES.map((tile) => {
          const macro = macros && macros[tile.key];
          const text = tile.key === 'nParticipants'
            ? (loading || error ? null : participantsText(macros))
            : macroText(macros, tile.key);
          return (
            <div className="home-stat" key={tile.key} title={`\\${tile.key}`}>
              <div className={`home-stat-value${text ? '' : ' home-stat-value--pending'}`}>
                {text || (loading ? '…' : '—')}
              </div>
              <div className="home-stat-label">{tile.label}</div>
              {macro && macro.note && <div className="home-stat-note">{macro.note}</div>}
              {!macro && !loading && (
                <div className="home-stat-note">macro not in this payload build</div>
              )}
              {tile.footnote && (
                <div className="home-stat-note home-stat-note--flag">{tile.footnote}</div>
              )}
            </div>
          );
        })}
      </div>

      <p className="home-provenance">
        Every number above is read at page load from{' '}
        <code>meta/headline.json.gz</code>, generated from <code>{sourceFile}</code>
        {meta && meta.n_macros ? ` (${meta.n_macros} macros` : ''}
        {meta && meta.version ? `, payload ${meta.version})` : meta && meta.n_macros ? ')' : ''}.
        Hover a tile for its macro name. Nothing on this page is typed by hand.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Entry cards and use cases point ONLY at routes that resolve today (src/App.js and
// src/pages/Results.js). The entity pages in WEBSITE_PLAN.md section 4
// (/explore/protein/<SYM>, /explore/exposure/<slug>, /start) are queued, not built,
// so nothing here links to them yet.
// ---------------------------------------------------------------------------

const ENTRY_CARDS = [
  {
    to: '/results/associations',
    title: 'Exposure–protein associations',
    body: 'Every exposure tested against one protein, as a Miami plot and a table with '
      + 'effect size, standard error, p-value and sample size. Five alternative covariate '
      + 'specifications sit behind a switcher; the primary base model is the default.',
  },
  {
    to: '/results/causal',
    title: 'Causal evidence',
    body: 'Mendelian randomization and colocalization for protein–disease pairs, '
      + 'reported as directed edges and motif profiles rather than one label per protein.',
  },
  {
    to: '/results/pes',
    title: 'Proteome-based exposure scores',
    body: 'Trained scores for each exposure: how well each one reproduces its exposure, '
      + 'how the scores track over repeat visits, and how they relate to incident disease.',
  },
  {
    to: '/downloads',
    title: 'Downloads',
    body: 'Summary statistics and score weights as files, for reuse outside this site.',
  },
];

// The five use cases are from WEBSITE_PLAN.md section 6.2. They live inline here until
// /start exists (queue item Q8), at which point this block moves there unchanged.
const USE_CASES = [
  {
    lead: 'I study a protein',
    body: 'Its exposure associations, then its disease links and the genetic evidence '
      + 'around them.',
    links: [
      { to: '/results/associations', label: 'Associations' },
      { to: '/results/mediation', label: 'Disease Links' },
      { to: '/results/causal', label: 'Causal Evidence' },
    ],
  },
  {
    lead: 'I study a lifestyle exposure',
    body: 'Its proteomic signature, the tissues and pathways that signature is enriched '
      + 'for, and how it compares with intervention trials.',
    links: [
      { to: '/results/summary', label: 'Lifestyle Categories' },
      { to: '/results/enrichment', label: 'Tissues & Pathways' },
      { to: '/results/intervention', label: 'Intervention' },
    ],
  },
  {
    lead: 'I study a disease',
    body: 'The proteins linking lifestyle exposures to that disease, kept separate from '
      + 'the Mendelian randomization verdict on the same pair.',
    links: [
      { to: '/results/mediation', label: 'Disease Links' },
      { to: '/results/causal', label: 'Causal Evidence' },
    ],
  },
  {
    lead: 'I have my own proteomics cohort',
    body: 'The exposure-score model cards and their weights, to score your own samples.',
    links: [
      { to: '/results/pes', label: 'Exposure Scores' },
      { to: '/downloads', label: 'Downloads' },
    ],
  },
  {
    lead: 'I want HEAP summary statistics',
    body: 'Browse a result on the site, or take the underlying files.',
    links: [
      { to: '/results/main', label: 'Main Results' },
      { to: '/downloads', label: 'Downloads' },
    ],
  },
];

const Home = () => {
  // Pull the charting chunk down while this page is idle, so the first click
  // into a results page renders immediately instead of waiting on Plotly.
  useEffect(prefetchCharts, []);

  const [meta, setMeta] = useState(null);
  const [macros, setMacros] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${WEB_DATA_BASE}/meta/headline.json.gz`, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((d) => {
        if (!alive) return;
        setMeta(d);
        setMacros(d.macros || {});
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e);
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  return (
    <div className="home">
      <section className="home-hero">
        <p className="home-eyebrow">UK Biobank · exposures · genetics · plasma proteomics · disease</p>
        <h1 className="home-title">
          HEAP
          <span className="home-title-expansion">
            <strong>H</strong>uman <strong>E</strong>xposomic <strong>A</strong>rchitecture
            of the <strong>P</strong>roteome
          </span>
        </h1>

        {/* AUTHOR: hero claim -- needs Shakson's wording (S13). Neutral fallback below. */}
        <p className="home-lede">{HERO_CLAIM}</p>

        {/* AUTHOR: reporter/intermediate framing -- needs Shakson's wording (S13). */}
        <p className="home-framing">{HERO_FRAMING}</p>

        <div className="home-hero-actions">
          <a className="home-cta" href="#start-here">Start here</a>
          <Link className="home-cta home-cta--ghost" to="/results/associations">
            Browse results
          </Link>
        </div>
      </section>

      <StatBar macros={macros} meta={meta} loading={loading} error={error} />

      <section className="home-block" aria-label="Where to go">
        <h2 className="home-h2">Four ways in</h2>
        <div className="home-card-grid">
          {ENTRY_CARDS.map((c) => (
            <Link className="home-card" key={c.to} to={c.to}>
              <span className="home-card-title">{c.title}</span>
              <span className="home-card-body">{c.body}</span>
              <span className="home-card-go">{c.to}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-block" id="start-here" aria-label="Start here">
        <h2 className="home-h2">Start here</h2>
        <p className="home-block-sub">
          Five ways people arrive at this resource. Pick the one that matches yours —
          no need to know which analysis module holds the answer.
        </p>
        <ul className="home-usecases">
          {USE_CASES.map((u) => (
            <li className="home-usecase" key={u.lead}>
              <div className="home-usecase-lead">{u.lead}</div>
              <div className="home-usecase-body">{u.body}</div>
              <div className="home-usecase-links">
                {u.links.map((l) => (
                  <Link className="home-pill" key={l.to + l.label} to={l.to}>{l.label}</Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-block home-legal" aria-label="Citation and license">
        <h2 className="home-h2">Cite and reuse</h2>
        <p className="home-legal-line">
          Results on this site come from the HEAP preprint:{' '}
          <a
            href="https://doi.org/10.1101/2025.05.07.25327178"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://doi.org/10.1101/2025.05.07.25327178
          </a>
        </p>
        <p className="home-legal-line">
          <strong>Data usage agreement and licenses:</strong> this work is licensed under a{' '}
          <a
            href="https://creativecommons.org/licenses/by-nc-nd/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International
            License (CC BY-NC-ND)
          </a>.
        </p>
        {/* S12 / D10: datasets carry a version string and build date, never their own DOI. */}
        <p className="home-legal-line home-legal-fine">
          Datasets carry a version string rather than a DOI — cite the paper.
          {meta && meta.version ? ` Data payload ${meta.version}.` : ''}
        </p>
      </section>
    </div>
  );
};

export default Home;
