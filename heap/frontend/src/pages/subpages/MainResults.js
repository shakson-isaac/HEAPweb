import React from 'react';
import { Box, Typography } from '@mui/material';

import VarianceReach from '../../components/redesign/VarianceReach';
import VarianceStack from '../../components/redesign/VarianceStack';
import ExposomicGradient from '../../components/redesign/ExposomicGradient';


export default function MainResults() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 1.5, maxWidth: 900 }}>
        How much of each plasma protein’s variation is accounted for by demographic covariates,
        by common genetic variation, by the measured exposome and by their interaction. Every
        panel on this page is cross-validated: R² is scored on held-out folds, so a component
        that only fits noise scores at or below zero rather than above it.
      </Typography>
      {/* The specification sentence was here. It named 'base' and listed its
          covariates, directly above a Specification dropdown that changes both --
          so the prose went stale the moment a reader picked another spec. The
          picker names the spec and its own helper text lists the covariates. */}

      {/* The three lead visuals. Each takes a specification picker. */}
      <VarianceReach />
      <VarianceStack />
      <ExposomicGradient />
    </Box>
  );
}
