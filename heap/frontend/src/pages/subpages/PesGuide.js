// A reorganized Exposure Scores page, running ALONGSIDE /results/pes.
//
// The original opens with four panels and then adds seventeen more -- three
// section cards and fourteen raw tables under "Supporting results" -- which is
// where the page's 225 interactive controls come from. It is the most
// control-heavy page on the site by a wide margin.
//
// The structure was already there and already stated. The page's own lede says
// Figure 6 "asks three questions of them in sequence": can the proteome READ
// the exposure, does the score TRACK change inside the same person, and is the
// signal DISEASE-RELEVANT. Four components answer exactly those, one of them a
// synthesis of the first two. They just had seventeen panels stacked under
// them.
//
// Landing is READ, on the enrichment lesson: the front page shows the section's
// most direct visual, not a summary of it. "Can plasma proteins tell what you
// do?" is the question a visitor arrives with; the disease payoff is one click
// on from it.
import React from 'react';
import { Link as RouterLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Divider, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import PesReads from '../../components/pes/PesReads';
import PesTracks from '../../components/pes/PesTracks';
import PesTwoTimescales from '../../components/pes/PesTwoTimescales';
import PesWithinPerson from '../../components/pes/PesWithinPerson';
import PesReadVsTrack from '../../components/pes/PesReadVsTrack';
import PesDisease from '../../components/pes/PesDisease';

const BASE = '/results/pes-guide';

const VIEWS = [
  {
    slug: 'tracks',
    title: 'Does it track change?',
    question: 'When someone’s exposure changes, does their score move with it?',
    payoff: 'Within-person change over ~10 years and over ~2, with the exemplars the paper uses.',
  },
  {
    slug: 'compare',
    title: 'Reading versus tracking',
    question: 'Are the scores that read an exposure well the same ones that track it?',
    payoff: 'The two things a score has to do, on one pair of axes.',
  },
  {
    slug: 'disease',
    title: 'Does it predict disease?',
    question: 'Does an exposure’s score carry risk for incident disease?',
    payoff: 'Per-exposure disease associations, held out, with the specification stated.',
  },
];

const viewBySlug = (slug) => VIEWS.find((v) => v.slug === slug);

function ViewPage({ view, children }) {
  const { search } = useLocation();
  const others = VIEWS.filter((v) => v.slug !== view.slug);
  return (
    <Box sx={{ mt: 3 }}>
      <Button component={RouterLink} to={`${BASE}${search}`} size="small"
              startIcon={<ArrowBackIcon />} sx={{ textTransform: 'none', ml: -1 }}>
        Exposure scores — can the proteome read them?
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>{view.title}</Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2, maxWidth: 840 }}>
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
            <Button key={v.slug} component={RouterLink} to={`${BASE}/${v.slug}${search}`}
                    variant="outlined" endIcon={<ArrowForwardIcon />}
                    sx={{ textTransform: 'none' }}>
              {v.title}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function Landing() {
  const { search } = useLocation();
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Exposure scores
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 840 }}>
        A proteomic exposure score is trained to predict one lifestyle exposure from plasma
        proteins alone. The first question is whether that works at all.
      </Typography>

      {/* No further lede: PesReads opens with its own framing, and a paragraph
          restating it is the duplication this redesign keeps removing. */}
      <PesReads />

      <Divider sx={{ my: 4 }} />

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Then three more questions
      </Typography>
      <Box sx={{
        display: 'grid', gap: 2, mt: 1,
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, maxWidth: 1100,
      }}>
        {VIEWS.map((v) => (
          <Card key={v.slug} variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{v.title}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {v.question}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5 }}>{v.payoff}</Typography>
              <Button component={RouterLink} to={`${BASE}/${v.slug}${search}`}
                      variant="contained" endIcon={<ArrowForwardIcon />}
                      sx={{ mt: 2, textTransform: 'none' }}>
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Alert severity="success" sx={{ mt: 3, maxWidth: 900 }}>
        A reorganization of <RouterLink to="/results/pes">the original Exposure Scores page</RouterLink>,
        kept side by side. Same panels, same data.
      </Alert>
    </Box>
  );
}

// Two timescales first, then the full tracking panel. The scatter is the
// intuitive form -- one point per exposure, the diagonal as the claim -- and it
// is the one in the paper, so it leads.
const ViewTracks = () => (
  <ViewPage view={viewBySlug('tracks')}>
    {/* One exposure at a time first: the question is "does it track change?",
        and a reader can only see what tracking LOOKS like one exposure at a
        time. The 132-exposure overview answers "which ones", which is the
        second question, so it follows. */}
    <PesWithinPerson />
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 2 }} />
      <PesTwoTimescales />
    </Box>
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 2 }} />
      <PesTracks />
    </Box>
  </ViewPage>
);
const ViewCompare = () => (
  <ViewPage view={viewBySlug('compare')}><PesReadVsTrack /></ViewPage>
);
const ViewDisease = () => (
  <ViewPage view={viewBySlug('disease')}><PesDisease /></ViewPage>
);

export default function PesGuide() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="tracks" element={<ViewTracks />} />
      <Route path="compare" element={<ViewCompare />} />
      <Route path="disease" element={<ViewDisease />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
