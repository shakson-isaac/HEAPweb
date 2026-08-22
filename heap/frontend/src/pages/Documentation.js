// src/pages/Documentation.js
//
// The documentation shell: left-hand contents, routed pages, and the small set
// of primitives every doc page shares. The primitives live here rather than in
// components/ so the whole docs section is one self-contained unit; subpages are
// pulled in with React.lazy, so importing back into this module does not create
// an evaluation cycle (the dynamic import only runs when a route renders).
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import {
  Alert, Box, Chip, CircularProgress, Divider, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { WEB_DATA_BASE } from '../lib/heapdata';
import { DOC_PAGES } from '../lib/docPages';

const AboutHeap = lazy(() => import('./subpages/AboutHeap'));
const QuickStart = lazy(() => import('./subpages/QuickStart'));
const EvidenceTiers = lazy(() => import('./subpages/EvidenceTiers'));
const Specifications = lazy(() => import('./subpages/Specifications'));
const DataDictionary = lazy(() => import('./subpages/DataDictionary'));
const ApiDocs = lazy(() => import('./subpages/ApiDocs'));
const DetailedMethods = lazy(() => import('./subpages/DetailedMethods'));
const Changelog = lazy(() => import('./subpages/Changelog'));
const Cite = lazy(() => import('./subpages/Cite'));
const Credits = lazy(() => import('./subpages/Credits'));
const FAQs = lazy(() => import('./subpages/FAQs'));

// Order is the reading order, and it drives both the sidebar and the overview.

/* ------------------------------------------------------------------ layout */

export { DOC_PAGES };

export function DocPage({ title, lead, children }) {
  return (
    <Box sx={{ maxWidth: 960 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: lead ? 1 : 2.5 }}>{title}</Typography>
      {lead && (
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3, maxWidth: 780 }}>
          {lead}
        </Typography>
      )}
      {children}
    </Box>
  );
}

export function Section({ title, subtitle, children }) {
  return (
    <Box component="section" sx={{ mb: 4.5 }}>
      {title && (
        <Typography variant="h6" sx={{ fontWeight: 600, mb: subtitle ? 0.25 : 1.25 }}>{title}</Typography>
      )}
      {subtitle && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>{subtitle}</Typography>
      )}
      {children}
    </Box>
  );
}

export function P({ children, ...rest }) {
  return (
    <Typography variant="body1" sx={{ mb: 1.5, maxWidth: 820, lineHeight: 1.65 }} {...rest}>
      {children}
    </Typography>
  );
}

/** Where a rendered fact comes from. Every page carries at least one (S8). */
export function SourceNote({ children }) {
  return (
    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>
      Source: {children}
    </Typography>
  );
}

/**
 * A gap left deliberately. Standing decision S13: structural copy is drafted
 * here, interpretive copy belongs to the author, so anything that would assert
 * what a result *means* is marked rather than written.
 */
export function AuthorNote({ what, children }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2, mb: 2, maxWidth: 820, borderStyle: 'dashed', borderWidth: 2,
        borderColor: '#b8860b', backgroundColor: '#fffdf5',
      }}
    >
      <Chip
        size="small" label="AUTHOR"
        sx={{ mb: 1, fontWeight: 700, letterSpacing: 0.5, backgroundColor: '#b8860b', color: '#fff' }}
      />
      <Typography variant="body2" sx={{ fontWeight: 600, mb: children ? 0.5 : 0 }}>{what}</Typography>
      {children && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{children}</Typography>}
    </Paper>
  );
}

/** Plain reference table. `head` is an array of column labels. */
export function SimpleTable({ head, rows, dense = true, maxHeight }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight, overflowX: 'auto' }}>
      <Table size={dense ? 'small' : 'medium'} stickyHeader={Boolean(maxHeight)}>
        <TableHead>
          <TableRow>
            {head.map((h) => (
              <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} hover>
              {r.map((c, j) => (
                <TableCell key={j} sx={{ verticalAlign: 'top' }}>{c}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Copy-pasteable block. Monospace, scrolls rather than wrapping mid-token. */
export function Code({ children, label }) {
  return (
    <Box sx={{ mb: 2 }}>
      {label && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <Paper
        variant="outlined"
        component="pre"
        sx={{
          p: 1.5, m: 0, overflowX: 'auto', backgroundColor: '#f7f7f9',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre',
        }}
      >
        {children}
      </Paper>
    </Box>
  );
}

export const Mono = ({ children }) => (
  <Box
    component="code"
    sx={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '0.86em', backgroundColor: '#f1f1f4', px: 0.6, py: 0.15, borderRadius: 0.5,
    }}
  >
    {children}
  </Box>
);

/* ----------------------------------------------------- headline numbers (S8) */

// One fetch per page load, shared by every doc page that renders a number.
// meta/headline.json.gz is generated from HEAP_manuscript/macros/numbers.tex, so
// nothing on these pages is hand-typed.
let headlinePromise = null;

function fetchHeadline() {
  if (!headlinePromise) {
    headlinePromise = fetch(`${WEB_DATA_BASE}/meta/headline.json.gz`, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) {
          headlinePromise = null;
          throw new Error(`${r.status} ${r.statusText}`);
        }
        return r.json();
      });
  }
  return headlinePromise;
}

export function useHeadline() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    fetchHeadline()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => { alive = false; };
  }, []);
  return state;
}

/** Raw macro string ("2,686") or an em dash when the payload has not loaded. */
export function macro(headline, name) {
  const m = headline && headline.macros && headline.macros[name];
  return m ? m.raw : '—';
}

export function macroNote(headline, name) {
  const m = headline && headline.macros && headline.macros[name];
  return m ? m.note : '';
}

/** Degraded-but-explained state. Deliberately not severity="error": the page
 *  itself is fine, only the live numbers are missing. */
export function HeadlineFallback({ error }) {
  if (!error) return null;
  return (
    <Alert severity="warning" sx={{ mb: 2, maxWidth: 820 }}>
      Live headline numbers could not be read from the payload ({String(error.message || error)}).
      The figures below render as em dashes rather than as stale hand-typed values.
    </Alert>
  );
}

/* ------------------------------------------------------------------- shell */

function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

function Sidebar() {
  return (
    <Box
      component="nav"
      sx={{
        width: 232, flexShrink: 0, mr: 4, display: { xs: 'none', md: 'block' },
        position: 'sticky', top: 16, alignSelf: 'flex-start',
      }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700 }}>
        Contents
      </Typography>
      <Divider sx={{ mb: 1 }} />
      {DOC_PAGES.map((p) => (
        <NavLink
          key={p.path}
          to={p.path}
          style={({ isActive }) => ({
            display: 'block',
            padding: '5px 8px',
            marginBottom: 2,
            borderRadius: 4,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: isActive ? 700 : 400,
            color: isActive ? '#124533' : '#333',
            backgroundColor: isActive ? '#eef4f0' : 'transparent',
            borderLeft: isActive ? '3px solid #124533' : '3px solid transparent',
          })}
        >
          {p.label}
        </NavLink>
      ))}
    </Box>
  );
}

function Overview() {
  return (
    <DocPage
      title="Documentation"
      lead="Reference material for the HEAP resource: what is in it, how each number was produced, what the evidence badges mean, and how to pull the data without a browser."
    >
      {DOC_PAGES.map((p) => (
        <Paper key={p.path} variant="outlined" sx={{ p: 2, mb: 1.5, maxWidth: 820 }}>
          <Link to={p.path} style={{ fontWeight: 600, fontSize: 16, textDecoration: 'none', color: '#124533' }}>
            {p.label}
          </Link>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{p.blurb}</Typography>
        </Paper>
      ))}
    </DocPage>
  );
}

function NotFound() {
  return (
    <Box sx={{ maxWidth: 960 }}>
      <Alert severity="info" sx={{ mb: 3, maxWidth: 820 }}>
        There is no documentation page at this address. The full contents are below.
      </Alert>
      <Overview />
    </Box>
  );
}

function Documentation() {
  return (
    <div className="flex p-6">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="about" element={<AboutHeap />} />
            <Route path="quickstart" element={<QuickStart />} />
            <Route path="quick-start" element={<QuickStart />} />
            <Route path="evidence-tiers" element={<EvidenceTiers />} />
            <Route path="evidence" element={<EvidenceTiers />} />
            <Route path="models" element={<Specifications />} />
            <Route path="specifications" element={<Specifications />} />
            <Route path="dictionary" element={<DataDictionary />} />
            <Route path="data-dictionary" element={<DataDictionary />} />
            <Route path="api" element={<ApiDocs />} />
            <Route path="methods" element={<DetailedMethods />} />
            <Route path="changelog" element={<Changelog />} />
            <Route path="cite" element={<Cite />} />
            <Route path="credits" element={<Credits />} />
            <Route path="references" element={<Credits />} />
            <Route path="faqs" element={<FAQs />} />
            <Route path="faq" element={<FAQs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default Documentation;
