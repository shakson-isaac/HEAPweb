// A redesign of /results/causal, kept ALONGSIDE the original for comparison.
// Same panels, same data -- reorganized.
//
// The original stacks five panels on one page with no stated order. A first
// attempt at fixing that replaced the stack with a menu of four numbered steps,
// which was worse in a specific way: the landing page carried 180 words of
// cards and NOT ONE PLOT. It charged a click before showing anything, which is
// the same mistake as a figure panel that explains instead of plots.
//
// This version shows the vocabulary and the triad counts immediately --
// MotifKey is main Fig 4a beside Fig 4b, and it already carries both -- then
// offers VIEWPOINTS rather than steps. Viewpoints matter: steps imply a
// mandatory order and imply you are not finished until the last one. Someone
// who already knows what a motif is should be able to go straight to the
// triad explorer.
//
// Clicking a motif in the key sets ?motif= in the URL, and every viewpoint
// opens filtered to it. The key is the navigation, exactly as its own header
// comment always claimed.
import React, { useMemo } from 'react';
import { Link as RouterLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Divider, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ArmNotice from '../../components/ArmNotice';
import MotifKey from '../../components/MotifKey';
import TriadBuilder from '../../components/TriadBuilder';
import PDEffects from '../../components/PDEffects';
import Disclosure from '../../components/Disclosure';
import { TriadExplorer, Coloc } from './Causal';
import { useSection } from '../../lib/useSection';
import { useUrlState } from '../../lib/useUrlState';
import { prettyExposure, prettyDisease } from '../../lib/palette';

const BASE = '/results/causal-guide';

// Declared once so the landing cards, the footers and the routes cannot drift.
const VIEWS = [
  {
    slug: 'entities',
    title: 'Build a triad',
    question: 'Which triads involve the exposure, protein or disease I care about?',
    payoff: 'The matching triads and how they split across the five patterns.',
  },
  {
    slug: 'triads',
    title: 'Explore one triad',
    question: 'What are its three edges, and why was it classified that way?',
    payoff: 'The evidence behind a single classification, edge by edge.',
  },
  {
    slug: 'effects',
    title: 'Protein → disease effects',
    question: 'Does the MR estimate agree with the observational one?',
    payoff: 'Where genetics and epidemiology agree, and where they part.',
  },
  {
    slug: 'coloc',
    title: 'Colocalization',
    question: 'One shared causal variant, or two distinct variants in LD?',
    payoff: 'Whether a cis signal survives the hard tier gate (PP.H4 ≥ 0.8).',
  },
];

const viewBySlug = (slug) => VIEWS.find((v) => v.slug === slug);

/* ------------------------------------------------------------------ *
 * Viewpoint chrome. Back to the key, plus the other viewpoints -- not a
 * linear "next", because these are angles on one question, not stages.
 * ------------------------------------------------------------------ */
function ViewPage({ view, children }) {
  const { search } = useLocation();
  const others = VIEWS.filter((v) => v.slug !== view.slug);
  return (
    <Box sx={{ mt: 3 }}>
      <Button
        component={RouterLink}
        to={`${BASE}${search}`}
        size="small"
        startIcon={<ArrowBackIcon />}
        sx={{ textTransform: 'none', ml: -1 }}
      >
        The reading key
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
        {view.title}
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2, maxWidth: 820 }}>
        {view.question}
      </Typography>

      {children}

      <Box sx={{ mt: 5 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Other viewpoints
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
          {others.map((v) => (
            <Button
              key={v.slug}
              component={RouterLink}
              to={`${BASE}/${v.slug}${search}`}
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              sx={{ textTransform: 'none' }}
            >
              {v.title}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ *
 * The landing page: the vocabulary and the triads, on screen, first.
 * ------------------------------------------------------------------ */
function Landing() {
  const { data: edgeKey } = useSection('mr_edge_key');
  const { data: motifKey } = useSection('mr_motif_key');
  const [motif, setMotif] = useUrlState('motif', 'all');
  const { search } = useLocation();
  const active = motif !== 'all';

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Causal evidence
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, maxWidth: 820 }}>
        A protein that tracks a lifestyle exposure may cause a disease, may merely
        record it, or may do neither. Mendelian randomization adjudicates that, one
        triad at a time. Below are the six directed relationships and the motifs
        they combine into, with the number of triads carrying each.
      </Typography>

      <ArmNotice />

      {/* The key is the navigation. Clicking a motif writes ?motif= and every
          viewpoint below opens filtered to it. */}
      <MotifKey
        edges={edgeKey}
        motifs={motifKey}
        selected={active ? motif : null}
        onSelect={(m) => setMotif(m || 'all')}
      />

      {active && (
        <Alert
          severity="info"
          sx={{ mt: 2, maxWidth: 900 }}
          action={(
            <Button size="small" onClick={() => setMotif('all')} sx={{ textTransform: 'none' }}>
              Clear
            </Button>
          )}
        >
          Filtered to <b>{motif}</b>. Every viewpoint below opens on it.
        </Alert>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Four ways to look at it
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mt: 1,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          maxWidth: 1000,
        }}
      >
        {VIEWS.map((v) => (
          <Card key={v.slug} variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {v.title}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {v.question}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                {v.payoff}
              </Typography>
              <Button
                component={RouterLink}
                to={`${BASE}/${v.slug}${search}`}
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                sx={{ mt: 2, textTransform: 'none' }}
              >
                {active ? `Open — ${motif}` : 'Open'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* 175 words of design and provenance. All true, none of it the first
          thing anyone needs. */}
      <Disclosure title="how these estimates were made" count={1}>
        <Typography variant="body2" sx={{ maxWidth: 900 }}>
          Every edge is a <b>two-sample Mendelian randomization</b> estimate: the
          instrument&ndash;exposure and instrument&ndash;outcome effects come from
          different samples, so no individual contributes to both sides.
          <Box component="span" sx={{ display: 'block', mt: 1 }}>
            Exposure and protein effects are estimated within UK Biobank on{' '}
            <b>non-overlapping participants</b> (a split-sample design adapted from
            Deng et al., 2025). Proteins are instrumented from two pQTL sources on
            two assay platforms &mdash; <b>UK Biobank (Olink)</b> and, as an external
            replication arm, <b>deCODE (SomaScan)</b> &mdash; deliberately, to
            account for differences in the genetic variants tied to each platform
            (Ferkingstad et al., 2021; Eldjarn et al., 2023; Wang et al., 2025).
            Disease instruments are drawn from <b>FinnGen Release 12</b> (Kurki
            et al., 2023).
          </Box>
          <Box component="span" sx={{ display: 'block', mt: 1 }}>
            A triad therefore draws on all three sources, and only edges involving
            the protein can differ between the two panels. Tier 1 requires a Steiger
            test that is both significant and forward-oriented; Tier 1+ additionally
            requires the edge to be cis-anchored, colocalized and replicated across
            both panels.
          </Box>
        </Typography>
      </Disclosure>

      <Alert severity="success" sx={{ mt: 3, maxWidth: 900 }}>
        A redesign of <RouterLink to="/results/causal">the original causal page</RouterLink>,
        kept side by side. Same data, same panels — reorganized.
      </Alert>
    </Box>
  );
}

/* ------------------------------------------------------------------ *
 * The four viewpoints. One panel each.
 * ------------------------------------------------------------------ */
function ViewEntities() {
  // The builder alone. The single-entity browser that used to sit here asked
  // "pick one exposure, protein or disease -- how do its triads split?", which
  // is what filling one builder slot does, with the same motif split and the
  // same click-through. Two controls for one question is the stacking this
  // redesign exists to remove.
  //
  // EntityMotifBrowser is NOT deleted: the original /results/causal still
  // renders it, and the two pages are meant to be compared.
  return (
    <ViewPage view={viewBySlug('entities')}>
      <TriadBuilder triadsPath={`${BASE}/triads`} />
    </ViewPage>
  );
}

function ViewTriads() {
  const [motif, setMotif] = useUrlState('motif', 'all');
  const [query, setQuery] = useUrlState('q', '');
  const [e] = useUrlState('e', '');
  const [p] = useUrlState('p', '');
  const [d] = useUrlState('d', '');
  const slots = useMemo(() => ({ exposure: e, protein: p, disease: d }), [e, p, d]);
  return (
    <ViewPage view={viewBySlug('triads')}>
      {(e || p || d) && (
        <Alert severity="info" sx={{ mb: 2, maxWidth: 1000 }}>
          <b>Filtered to the triad you built.</b>
          {[e && `exposure ${prettyExposure(e)}`, p && `protein ${p}`,
            d && `disease ${prettyDisease(d, null)}`].filter(Boolean).join(' · ')}
          {'. '}
          <RouterLink to={`${BASE}/triads`}>Show every triad</RouterLink>
        </Alert>
      )}
      <TriadExplorer
        motif={motif}
        onMotif={setMotif}
        query={query}
        onQuery={setQuery}
        slots={slots}
      />
    </ViewPage>
  );
}

function ViewEffects() {
  return (
    <ViewPage view={viewBySlug('effects')}>
      <PDEffects />
    </ViewPage>
  );
}

function ViewColoc() {
  return (
    <ViewPage view={viewBySlug('coloc')}>
      <Coloc />
    </ViewPage>
  );
}

export default function CausalGuide() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="entities" element={<ViewEntities />} />
      <Route path="triads" element={<ViewTriads />} />
      <Route path="effects" element={<ViewEffects />} />
      <Route path="coloc" element={<ViewColoc />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
