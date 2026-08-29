import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import Disclosure from '../../components/Disclosure';
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
// The lede states the one thing a reader must not get wrong; both full caveats
// are kept verbatim behind the disclosure at the foot of the page. Nothing was
// dropped -- 207 words of preamble became 62 before the first plot.
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

      <Alert severity="warning" sx={{ mb: 3, maxWidth: 1000 }}>
        <b>Read agreement in sign and rank, not magnitude.</b> The two axes are
        different estimands on different assay platforms, and the trial effects are
        significance-selected &mdash; so every correlation here is an upper bound.
      </Alert>

      <InterventionConcordance />
      <InterventionNetwork />

      <Disclosure title="why these comparisons are not like-for-like" count={2}>
        <Alert severity="warning" sx={{ mb: 2, maxWidth: 1000 }}>
          <b>The two axes are not the same estimand.</b> UK Biobank protein levels are
          measured on Olink and the trial reports are SomaScan, so the comparison is
          restricted to proteins measured on both, and every protein carries its
          Olink&ndash;SomaScan assay correlation. Beyond the platform difference, a
          between-person association and a within-person change under treatment are
          different quantities in different units.
        </Alert>

        <Alert severity="info" sx={{ maxWidth: 1000 }}>
          <b>Both trial arms are significance-selected, which flatters the
          agreement.</b>{' '}
          HERITAGE published only proteins reaching q &le; 0.01 (450 of roughly five
          thousand assayed), and the GLP-1 effects are filtered to each trial&apos;s own
          q &lt; 0.05 before any join. So every correlation here is computed against
          trial effects pre-selected to be large, which biases it upward. That is a
          property of what the trials published, not of the estimates themselves
          &mdash; but it means these correlations are an upper bound on concordance
          rather than an unbiased estimate of it.
        </Alert>
      </Disclosure>
    </Box>
  );
}
