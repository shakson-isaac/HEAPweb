// A reorganized Tissues & Pathways, running ALONGSIDE /results/enrichment so
// the two can be compared. Same panels, same data.
//
// The original stacks ELEVEN panels: three interactive views, then eight raw
// grids under "Every enrichment, as heatmaps", four of them 420-760px tall.
// Nothing says the three are alternatives rather than a sequence, and nothing
// says the eight below are an appendix rather than the point.
//
// The irony is that the three components already know what they are for. Their
// own headers say it:
//
//   ExposureBodyMap   "THE ENTRY POINT: pick an exposure, see which tissues it
//                      touches" -- starts from the question a non-specialist
//                      arrives with, not from the analysis.
//   TissueExplorer    "The two entry points this page has never offered" --
//                      a reader holding a protein, or holding an organ.
//   EnrichTripartite   main Fig 2d, for all 114 exposures rather than the ten
//                      the printed panel had room for.
//
// So they are four different questions, and the page presented them as one
// column. This gives each its own route and puts the headline result on the
// landing page, where the causal redesign learned to put the reading key.
import React from 'react';
import { Link as RouterLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Divider, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ExposureBodyMap from '../../components/enrichment/ExposureBodyMap';
import EnrichTripartite from '../../components/enrichment/EnrichTripartite';
import TissueExplorer from '../../components/enrichment/TissueExplorer';
import TableSection from '../../components/TableSection';
import { EnrichHeatmap, NesBar } from './Enrichment';

const BASE = '/results/enrichment-guide';

// The body map is NOT in here: it is the landing page itself. These are the
// ways OUT of it, for detail the anatomogram cannot carry.
const VIEWS = [
  {
    slug: 'tissue',
    title: 'Start from a protein or an organ',
    question: 'Where is this protein expressed, or what reaches this organ?',
    payoff: 'The same question from the other end. Two modes, one vocabulary.',
  },
  {
    slug: 'programs',
    title: 'Programs and tissues',
    question: 'Which biological programs carry an exposure into which tissues?',
    payoff: 'Main Figure 2d, for all 114 exposures rather than the ten in print.',
  },
  {
    slug: 'all',
    title: 'Every enrichment',
    question: 'Show me the whole grid, not one thread through it.',
    payoff: 'Eight full views: tissue and pathway heatmaps, themes by category, NES bars, and the genetic-versus-exposomic table.',
  },
];

const viewBySlug = (slug) => VIEWS.find((v) => v.slug === slug);

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
        Tissues &amp; pathways — overview
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>{view.title}</Typography>
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

function Landing() {
  const { search } = useLocation();
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Tissues &amp; pathways
      </Typography>
      {/* No lede. ExposureBodyMap opens with its own heading -- "What does this
          exposure touch, and which proteins carry it?" -- and its own
          description of picking an exposure and clicking an organ. A page-level
          paragraph saying the same thing put the same sentence on screen twice,
          thirty pixels apart. The NES convention stays because the component
          prints NES values on the body and never defines the sign. */}
      <Typography variant="body2" sx={{ mb: 3, maxWidth: 820, color: 'text.secondary' }}>
        Positive NES means the set is enriched among proteins associated with that
        exposure; negative means depleted. Everything shown is FDR q &lt; 0.05.
      </Typography>

      {/* The body map IS the front page.
          A first pass landed on a compact organ-system heatmap with the
          anatomogram one click away. That inverted the section: this component's
          own header calls itself "THE ENTRY POINT" and opens on the question a
          non-specialist actually arrives with -- "I play strenuous sports; what
          does that show up in?" -- while a category-by-organ grid answers a
          question you need the vocabulary to ask. The grid is still available,
          under Every enrichment, where it belongs among the other reference
          views. */}
      <ExposureBodyMap />

      <Divider sx={{ my: 4 }} />

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        More detail
      </Typography>
      <Box
        sx={{
          display: 'grid', gap: 2, mt: 1,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, maxWidth: 1000,
        }}
      >
        {VIEWS.map((v) => (
          <Card key={v.slug} variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{v.title}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {v.question}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5 }}>{v.payoff}</Typography>
              <Button
                component={RouterLink}
                to={`${BASE}/${v.slug}${search}`}
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

      <Alert severity="success" sx={{ mt: 3, maxWidth: 900 }}>
        A reorganization of{' '}
        <RouterLink to="/results/enrichment">the original Tissues &amp; Pathways page</RouterLink>,
        kept side by side. Same data, same panels.
      </Alert>
    </Box>
  );
}

const ViewTissue = () => (
  <ViewPage view={viewBySlug('tissue')}><TissueExplorer /></ViewPage>
);
const ViewPrograms = () => (
  <ViewPage view={viewBySlug('programs')}><EnrichTripartite /></ViewPage>
);

// The eight grids the original stacked below its three interactive views. They
// are a reference surface, not a reading order, so they stay together on one
// route rather than becoming eight more.
function ViewAll() {
  return (
    <ViewPage view={viewBySlug('all')}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 900 }}>
        Every exposure against every tissue and pathway, the same enrichments grouped
        by exposure category and by variance component, and the genetic-versus-exposomic
        comparison. For scanning the whole space rather than following one thread.
      </Typography>
      <EnrichHeatmap
        section="tissue_enrichment" title="Tissue enrichment"
        subtitle="Exposures against GTEx tissue signatures. Blank cells were not significant."
        xCol="tissue" yCol="exposure" height={760}
      />
      <EnrichHeatmap
        section="pathway_enrichment" title="Pathway enrichment"
        subtitle="Exposures against Reactome pathways."
        xCol="pathway" yCol="exposure" height={700}
      />
      <EnrichHeatmap
        section="tissue_themes" title="Tissue themes by exposure category"
        subtitle="Tissues grouped into organ systems, shown per exposure category."
        xCol="tissue" yCol="category" height={420}
      />
      <EnrichHeatmap
        section="pathway_themes" title="Pathway themes by exposure category"
        subtitle="Pathways grouped into themes, shown per exposure category."
        xCol="pathway" yCol="category" height={420}
      />
      <NesBar
        section="exposure_tissue" title="Exposure&ndash;tissue enrichment"
        subtitle="Tissue signal aggregated across each exposure category."
        labelCol="tissue" groupCol="category"
      />
      <NesBar
        section="inflammation_convergence" title="Inflammatory convergence"
        subtitle="Where distinct exposure categories converge on shared inflammatory pathways."
        labelCol="pathway" groupCol="category"
      />
      <NesBar
        section="component_pathways" title="Pathways by variance component"
        subtitle="Which biology sits behind the exposomic component of protein variance."
        labelCol="Description" groupCol="ONTOLOGY"
      />
      <TableSection section="geno_expo_pathways"
                    title="Genetic versus exposomic pathways" rowsPerPage={25} />
    </ViewPage>
  );
}

export default function EnrichmentGuide() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="tissue" element={<ViewTissue />} />
      <Route path="programs" element={<ViewPrograms />} />
      <Route path="all" element={<ViewAll />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
