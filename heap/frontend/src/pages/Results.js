// src/pages/Results.js
import NotFound from './NotFound';
import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

// Every result subpage is code-split. Plotly alone is ~1.4 MB gzipped, and the
// home and downloads pages never plot anything -- loading it up front would
// block first paint on pages that have no chart. Each page now pulls the
// charting bundle only when the visitor actually opens a result.
const MainResults = lazy(() => import('./subpages/MainResults'));
const HeapSummary = lazy(() => import('./subpages/HeapSummary'));
const Associations = lazy(() => import('./subpages/Associations'));
const Interactions = lazy(() => import('./subpages/Interactions'));
const Mediation = lazy(() => import('./subpages/Mediation'));
const Intervention = lazy(() => import('./subpages/Intervention'));
const Enrichment = lazy(() => import('./subpages/Enrichment'));
const Pes = lazy(() => import('./subpages/Pes'));
const Gwas = lazy(() => import('./subpages/Gwas'));
// Unlinked design preview -- see subpages/DesignPreview.js. Reachable only by
// typing the path, and reads scratch data, so it cannot affect the live site.
const DesignPreview = lazy(() => import('./subpages/DesignPreview'));
// Scratch surface for the drill-in panel redesign; unlinked.
const DrillDesign = lazy(() => import('./subpages/DrillDesign'));
// The causal page. The stacked version it replaced is archived outside src/
// at heap/frontend/deprecated/Causal.oldpage.js.
const CausalGuide = lazy(() => import('./subpages/CausalGuide'));
// Reorganized Tissues & Pathways, running alongside the original for
// comparison; see subpages/EnrichmentGuide.js.
const EnrichmentGuide = lazy(() => import('./subpages/EnrichmentGuide'));
// Reorganized Exposure Scores, alongside the original for comparison.
const PesGuide = lazy(() => import('./subpages/PesGuide'));

function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

function Results() {
  return (
    <div className="flex p-6">
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold">Results</h2>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="main" element={<MainResults />} />
            <Route path="summary" element={<HeapSummary />} />
            <Route path="associations" element={<Associations />} />
            {/* GxE is supplementary (S10): reachable, not a top-level pillar.
                The old /interactions path still resolves so existing links work. */}
            <Route path="architecture" element={<Interactions />} />
            <Route path="interactions" element={<Interactions />} />
            <Route path="mediation" element={<Mediation />} />
            <Route path="intervention" element={<Intervention />} />
            <Route path="enrichment" element={<Enrichment />} />
            <Route path="causal/*" element={<CausalGuide />} />
            <Route path="pes" element={<Pes />} />
            <Route path="gwas" element={<Gwas />} />
            <Route path="design-preview" element={<DesignPreview />} />
            <Route path="drill-design" element={<DrillDesign />} />
            {/* Links handed out while the two versions ran side by side. */}
            <Route path="causal-guide/*" element={<CausalGuide />} />
            <Route path="enrichment-guide/*" element={<EnrichmentGuide />} />
            <Route path="pes-guide/*" element={<PesGuide />} />
            {/* /results/<unknown> rendered an empty shell before this. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default Results;
