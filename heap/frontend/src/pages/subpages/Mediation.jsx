import React from 'react';

import { Box, Typography } from '@mui/material';
import PleiotropySpectrum from '../../components/redesign/PleiotropySpectrum';
import MediationGrid from '../../components/redesign/MediationGrid';
import DriverComparison from '../../components/redesign/DriverComparison';
import MediationLandscape from '../../components/redesign/MediationLandscape';


// The observational-mediation caveat that sat under the lede, with its link to
// /results/causal, moved to Methods (Module 3) and the FAQ on 2026-09-19.
// Results pages carry no caveats. The manuscript's wording is kept verbatim in
// pages/subpages/DetailedMethods.js -- do not reword it there either.

export default function Mediation() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Disease links</Typography>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 900 }}>
        Do exposure-responsive proteins connect lifestyle exposures to disease risk? Genetic and
        Exposomic Mediation (GEM) splits each exposure–disease association into an indirect effect
        through a measured protein and a remaining direct effect.
      </Typography>

      {/* Four lead visuals, left all visible while the remaining partitioned
          specifications finish. Which one deserves to lead depends on how they
          read across five specifications rather than one, so the order here is
          provisional. */}
      <PleiotropySpectrum />
      <MediationGrid />
      <DriverComparison />
      <MediationLandscape />
    </Box>
  );
}
