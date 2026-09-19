import React from 'react';
import { Box, Typography } from '@mui/material';
import InterventionConcordance from '../../components/intervention/InterventionConcordance';
import InterventionNetwork from '../../components/intervention/InterventionNetwork';

// ---------------------------------------------------------------------------
// Interventions: does the proteomic signature of an exposure actually MOVE when
// the exposure is changed?
//
// Two panels carry the whole page. The first asks the question protein by
// protein, with every annotation a control the reader sets rather than a
// decision baked into a figure. The second places those proteins in the
// exposure -> protein -> disease network for any disease, not only the
// cardiometabolic cut the printed figure shows.
//
// Five earlier panels were retired rather than deleted, for the same reason the
// other pages' panels were: they were fed by figure exports rather than the
// supplementary deposit, so they showed fewer exposures and no standard errors,
// and one silently truncated to 65 of 97 exposure terms.
//
// Caveats moved to Methods (2026-09-19): the platform point was already in the
// Module 5 card there, and the estimand and significance-selection points were
// added to it. This page carries results only.
// ---------------------------------------------------------------------------

export default function Intervention() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 2, maxWidth: 900 }}>
        Do the proteins that track a lifestyle exposure actually move when the exposure
        is changed? HEAP&apos;s observational signatures are set against protein effects
        from randomized trials &mdash; HERITAGE (exercise training) and STEP 1 / STEP 2
        (a GLP-1 receptor agonist).
      </Typography>

      <InterventionConcordance />
      <InterventionNetwork />

    </Box>
  );
}
