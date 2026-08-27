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
      <Typography variant="body2" sx={{ mb: 3, maxWidth: 900, color: 'text.secondary' }}>
        Specification: <b>base</b> covariates (age, age², sex, their interactions, assessment
        centre, 20 genetic principal components) with LASSO block scores, which is the primary
        specification used throughout. Sensitivity layers over the same models are on the
        Associations page.
      </Typography>

      {/* The three lead visuals. Each takes a specification picker. */}
      <VarianceReach />
      <VarianceStack />
      <ExposomicGradient />
    </Box>
  );
}
