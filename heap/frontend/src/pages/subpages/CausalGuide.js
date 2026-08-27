// A guided rebuild of /results/causal, kept ALONGSIDE the original so the two
// can be compared. Nothing here is new analysis -- it is the same five panels,
// reached one at a time.
//
// What the original gets wrong is not content, it is sequence. It stacks a
// reading key, an entity browser, a triad explorer, protein-disease effects and
// a colocalization panel on one page. A comment in that file calls them "three
// depths of one question", which is exactly right and is never said to the
// reader. So there is no first step, no next step, and no way to tell whether
// you are meant to read down or pick one.
//
// This version states the sequence, gives each panel its own route, and ends
// every step with the next one. The panels themselves are imported, not
// forked -- TriadExplorer and Coloc are exported from Causal.js.
//
// Selections live in the URL (?motif=, ?q=), so picking an entity in step 2 and
// moving to step 3 carries it, and any step can be linked to or cited.
import React from 'react';
import { Link as RouterLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ArmNotice from '../../components/ArmNotice';
import MotifKey from '../../components/MotifKey';
import EntityMotifBrowser from '../../components/EntityMotifBrowser';
import PDEffects from '../../components/PDEffects';
import Disclosure from '../../components/Disclosure';
import { TriadExplorer, Coloc } from './Causal';
import { useSection } from '../../lib/useSection';
import { useUrlState } from '../../lib/useUrlState';

const BASE = '/results/causal-guide';

// The sequence, declared once. Every step page, the hub cards and the
// prev/next footers all read from this, so the order cannot drift between them.
const STEPS = [
  {
    slug: 'motifs',
    n: 1,
    title: 'Learn the vocabulary',
    question: 'What are the six relationships, and how do they combine?',
    payoff: 'You will be able to read any motif label on the rest of the site.',
  },
  {
    slug: 'browse',
    n: 2,
    title: 'Find your entity',
    question: 'Which motif does my protein, exposure or disease carry?',
    payoff: 'A shortlist of triads worth opening, narrowed to what you study.',
  },
  {
    slug: 'triads',
    n: 3,
    title: 'Inspect one triad',
    question: 'What are its three edges, and why was it classified that way?',
    payoff: 'The evidence behind a single classification, edge by edge.',
  },
  {
    slug: 'genetics',
    n: 4,
    title: 'Check the genetics',
    question: 'Does the protein-disease signal hold up, and does it colocalize?',
    payoff: 'Whether a cis signal is one shared variant or two in LD.',
  },
];

const stepBySlug = (slug) => STEPS.find((s) => s.slug === slug);

/* ------------------------------------------------------------------ *
 * Shared step chrome: where you are, and where you go next.
 * The original page has neither, which is the whole complaint.
 * ------------------------------------------------------------------ */
function StepHeader({ step }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Button
        component={RouterLink}
        to={BASE}
        size="small"
        startIcon={<ArrowBackIcon />}
        sx={{ textTransform: 'none', ml: -1 }}
      >
        Causal evidence — overview
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
        {`${step.n}. ${step.title}`}
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 800 }}>
        {step.question}
      </Typography>
    </Box>
  );
}

function StepFooter({ step, search }) {
  const next = STEPS.find((s) => s.n === step.n + 1);
  const prev = STEPS.find((s) => s.n === step.n - 1);
  return (
    <Box sx={{ mt: 5 }}>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {prev && (
          <Button
            component={RouterLink}
            to={`${BASE}/${prev.slug}${search}`}
            startIcon={<ArrowBackIcon />}
            sx={{ textTransform: 'none' }}
          >
            {`${prev.n}. ${prev.title}`}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {next ? (
          <Button
            component={RouterLink}
            to={`${BASE}/${next.slug}${search}`}
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            sx={{ textTransform: 'none' }}
          >
            {`Next — ${next.n}. ${next.title}`}
          </Button>
        ) : (
          <Button
            component={RouterLink}
            to={BASE}
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Back to the overview
          </Button>
        )}
      </Box>
    </Box>
  );
}

function Step({ step, children }) {
  const { search } = useLocation();
  return (
    <Box sx={{ mt: 3 }}>
      <StepHeader step={step} />
      {children}
      <StepFooter step={step} search={search} />
    </Box>
  );
}

/* ------------------------------------------------------------------ *
 * The overview. One job: say what this section answers, and in what order.
 * ------------------------------------------------------------------ */
function Overview() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Causal evidence
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, maxWidth: 820 }}>
        A protein that tracks a lifestyle exposure may cause a disease, may merely
        record it, or may do neither. This section adjudicates that question with
        Mendelian randomization, one triad at a time.
      </Typography>

      <Alert severity="info" sx={{ mb: 3, maxWidth: 900 }}>
        <b>Four steps, in order.</b> Each answers one question and hands you to the
        next. Selections carry across steps, so a protein picked in step 2 is still
        selected in step 3.
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          maxWidth: 1000,
        }}
      >
        {STEPS.map((s) => (
          <Card key={s.slug} variant="outlined">
            <CardContent>
              <Chip
                label={`Step ${s.n}`}
                size="small"
                sx={{ mb: 1, fontWeight: 700 }}
              />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {s.title}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {s.question}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                <b>You get:</b>
                {' '}
                {s.payoff}
              </Typography>
              <Button
                component={RouterLink}
                to={`${BASE}/${s.slug}`}
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                sx={{ mt: 2, textTransform: 'none' }}
              >
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* The original opens with 175 words of design and provenance before the
          reader has seen anything. It is all true and none of it is the first
          thing anyone needs, so it moves here. */}
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
        This is a redesign of{' '}
        <RouterLink to="/results/causal">the original causal page</RouterLink>, kept
        side by side for comparison. Same data, same panels — resequenced.
      </Alert>
    </Box>
  );
}

/* ------------------------------------------------------------------ *
 * The four steps. Each holds one panel and nothing else.
 * ------------------------------------------------------------------ */
function StepMotifs() {
  const { data: edgeKey } = useSection('mr_edge_key');
  const { data: motifKey } = useSection('mr_motif_key');
  const [motif, setMotif] = useUrlState('motif', 'all');
  return (
    <Step step={stepBySlug('motifs')}>
      <ArmNotice />
      <MotifKey
        edges={edgeKey}
        motifs={motifKey}
        selected={motif === 'all' ? null : motif}
        onSelect={(m) => setMotif(m || 'all')}
      />
    </Step>
  );
}

function StepBrowse() {
  const { data: motifKey } = useSection('mr_motif_key');
  const [motif, setMotif] = useUrlState('motif', 'all');
  const [query, setQuery] = useUrlState('q', '');
  const [entity, setEntity] = React.useState(null);
  return (
    <Step step={stepBySlug('browse')}>
      <EntityMotifBrowser
        motifs={motifKey}
        selectedMotif={motif === 'all' ? null : motif}
        onSelectMotif={(m) => setMotif(m || 'all')}
        picked={entity}
        onPick={(e) => {
          setEntity(e);
          // Push the pick into the URL so step 3 opens on it. This is the
          // carry-over the overview promises.
          setQuery(e ? e.id : '');
        }}
      />
      {query && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <b>{query}</b>
          {' '}
          will be selected when you open the triad explorer.
        </Alert>
      )}
    </Step>
  );
}

function StepTriads() {
  const [motif, setMotif] = useUrlState('motif', 'all');
  const [query, setQuery] = useUrlState('q', '');
  return (
    <Step step={stepBySlug('triads')}>
      <TriadExplorer
        motif={motif}
        onMotif={setMotif}
        query={query}
        onQuery={setQuery}
      />
    </Step>
  );
}

function StepGenetics() {
  return (
    <Step step={stepBySlug('genetics')}>
      <PDEffects />
      <Coloc />
    </Step>
  );
}

export default function CausalGuide() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="motifs" element={<StepMotifs />} />
      <Route path="browse" element={<StepBrowse />} />
      <Route path="triads" element={<StepTriads />} />
      <Route path="genetics" element={<StepGenetics />} />
      <Route path="*" element={<Overview />} />
    </Routes>
  );
}
