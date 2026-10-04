import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Chip, CircularProgress, Divider, Link, Paper, Typography,
} from '@mui/material';
import { WEB_DATA_BASE } from '../lib/heapdata';

// ---------------------------------------------------------------------------
// One protein, across every view that has something to say about it.
//
// WHY THIS PAGE EXISTS. The site is organized by analysis module, which is the
// structure of the paper. Most visitors arrive with a protein instead, and
// finding what HEAP knows about LEP meant opening five pages and knowing which
// five. Every comparable resource -- Open Targets, GTEx, the GWAS Catalog,
// Human Protein Atlas -- is organized the other way: search an entity, land on
// its page, find the analyses as sections of it.
//
// IT COSTS NO NEW PIPELINE. e/protein/<SYM>.json.gz has been published since
// the payload was first built and read by nothing: 2,686 bundles, each joining
// the nine sections that mention that protein. LEP's is 35 KB gzipped. This page
// fetches one bundle and counts rows.
//
// STAGE 1 IS A CHOOSER, NOT A DASHBOARD. Each row says how much evidence exists
// and links into the view that holds it, so a visitor knows whether a page is
// worth opening before they open it. Inline plots are stage 2, and a different
// kind of work -- nine renderers, each a design decision.
// ---------------------------------------------------------------------------

const INDEX_URL = `${WEB_DATA_BASE}/e/protein/_index.json.gz`;
const bundleUrl = (file) => `${WEB_DATA_BASE}/e/protein/${file}`;

// Section -> the view that shows it. `href` is null where the destination has
// no protein-aware selector yet: the row still reports what exists, and links to
// the page without preselecting, rather than promising a filter that is not there.
// Each view reports what it actually has for this protein, not how many rows
// its table happens to carry. The distinction matters: LEP's mediation table
// holds 540 rows because 180 diseases are scored under three drivers, of which
// 34 are significant exposomic links. Reporting 540 would flatter the page.
//
// `href` is null where the destination has no protein-aware selector yet: the
// row still reports what exists and links to the page unfiltered, rather than
// promising a filter that is not there.
const col = (t, name) => (t && t[name]) || [];
const countTrue = (t, name) => col(t, name).filter(Boolean).length;
const nRows = (t) => {
  const first = t && Object.values(t)[0];
  return Array.isArray(first) ? first.length : 0;
};

const VIEWS = [
  {
    key: 'associations',
    label: 'Associations',
    question: 'Which exposures move this protein?',
    href: (p) => `/results/associations?protein=${encodeURIComponent(p)}`,
    count: (b) => {
      const t = b.expo_protein_assoc;
      if (!t) return null;
      const n = countTrue(t, 'sig');
      return { n, text: `${n} of ${nRows(t)} exposures associated` };
    },
  },
  {
    key: 'variance',
    label: 'Main results',
    question: 'How much of it is genetic, exposomic or neither?',
    href: (p) => `/results/main?protein=${encodeURIComponent(p)}`,
    count: () => ({ n: null, text: 'variance decomposition' }),
  },
  {
    key: 'mediation',
    label: 'Disease links',
    question: 'Which diseases does it mediate into?',
    href: (p) => `/results/mediation?driver=protein&protein=${encodeURIComponent(p)}`,
    count: (b) => {
      const t = b.mediation_main;
      if (!t) return null;
      const drivers = col(t, 'driver');
      const sig = col(t, 'sig');
      const n = drivers.filter((d, i) => sig[i] && String(d).startsWith('Exposomic')).length;
      const dz = new Set(drivers.map((_, i) => i).filter((i) => sig[i]).map((i) => col(t, 'DZ_ID')[i]));
      return { n, text: n ? `${n} diseases with a mediated link` : `no mediated link in ${dz.size || nRows(t) / 3} diseases` };
    },
  },
  {
    key: 'causal',
    label: 'Causal evidence',
    question: 'Does genetics support a causal role?',
    href: (p) => `/results/causal/entities?p=${encodeURIComponent(p)}`,
    count: (b) => {
      const n = nRows(b.mr_edges);
      return { n, text: n ? `${n} MR edges` : 'no MR edge' };
    },
  },
  {
    key: 'intervention',
    label: 'Intervention',
    question: 'Does a trial move it too?',
    href: () => '/results/intervention',
    count: (b) => {
      const t = b.intervention_scatter;
      if (!t) return null;
      const trials = new Set(col(t, 'intervention'));
      const exposures = new Set(col(t, 'exposure_id'));
      return { n: exposures.size, text: `${exposures.size} exposures against ${trials.size} trials` };
    },
  },
  {
    key: 'gxe',
    label: 'Genetic & exposomic architecture',
    question: 'Does genotype modify its exposure response?',
    href: () => '/results/architecture',
    count: (b) => {
      const t = b.gxe_assoc;
      if (!t) return null;
      const n = countTrue(t, 'sig_joint');
      return { n, text: n ? `${n} interactions` : `no interaction in ${nRows(t)} tests` };
    },
  },
  {
    key: 'tissue',
    label: 'Tissues & pathways',
    question: 'Where is it expressed?',
    href: (p) => `/results/enrichment/tissue?protein=${encodeURIComponent(p)}`,
    count: () => ({ n: null, text: 'tissue expression' }),
  },
];

export default function EntityProtein() {
  const { symbol } = useParams();
  const [index, setIndex] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(INDEX_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setIndex(d))
      .catch((e) => alive && setError(e));
    return () => { alive = false; };
  }, []);

  // Four proteins are stored under R-safe names (HLA-A as HLA_A); the index
  // carries the alias map, so a URL may use either spelling.
  const file = useMemo(() => {
    if (!index) return null;
    const keys = index.keys || [];
    const rev = Object.entries(index.aliases || {})
      .reduce((m, [safe, real]) => ({ ...m, [real]: safe }), {});
    const i = keys.indexOf(symbol);
    if (i >= 0) return index.files[i];
    const alt = rev[symbol] || (index.aliases || {})[symbol];
    const j = alt ? keys.indexOf(alt) : -1;
    return j >= 0 ? index.files[j] : null;
  }, [index, symbol]);

  useEffect(() => {
    if (!file) return undefined;
    let alive = true;
    setBundle(null);
    fetch(bundleUrl(file), { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setBundle(d))
      .catch((e) => alive && setError(e));
    return () => { alive = false; };
  }, [file]);

  if (error) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 5 }}>
        <Alert severity="error">
          {`Could not load ${symbol}: ${String(error.message || error)}`}
        </Alert>
      </Box>
    );
  }

  if (index && !file) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 5 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>{symbol}</Typography>
        <Alert severity="info">
          {`No protein called ${symbol} in the analyzed panel. The search box in the header lists
            every one of the ${index.n.toLocaleString()} measured proteins.`}
        </Alert>
      </Box>
    );
  }

  if (!bundle) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
    );
  }

  const present = VIEWS.map((v) => {
    const c = v.count(bundle) || { n: 0, text: 'nothing published' };
    return { ...v, ...c, has: c.n === null || c.n > 0 };
  });

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2.5, md: 3 }, py: { xs: 4, md: 6 } }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Protein</Typography>
      <Typography variant="h3" sx={{ mb: 0.5 }}>{symbol}</Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3, maxWidth: 70 * 8 }}>
        What HEAP holds for this protein, and where to read it.
      </Typography>

      <Divider sx={{ mb: 1 }} />

      {present.map((v) => (
        <Paper
          key={v.key}
          variant="outlined"
          sx={{
            p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'baseline',
            flexWrap: 'wrap', opacity: v.has ? 1 : 0.55,
          }}
        >
          <Box sx={{ minWidth: 230, flex: '1 1 260px' }}>
            <Link component={RouterLink} to={v.href(symbol)} variant="subtitle1" sx={{ fontWeight: 600 }}>
              {v.label}
            </Link>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{v.question}</Typography>
          </Box>
          <Box sx={{ flex: '0 0 auto' }}>
            <Chip
              size="small"
              variant={v.n ? 'filled' : 'outlined'}
              color={v.n ? 'primary' : 'default'}
              label={v.text}
            />
          </Box>
        </Paper>
      ))}

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
        Counts come from this protein&apos;s published bundle. A view reporting none was still
        run for it; nothing cleared the threshold.
      </Typography>
    </Box>
  );
}
