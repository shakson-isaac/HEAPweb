import React from 'react';
import { Box, Typography } from '@mui/material';

import CategoryReachPanel from '../../components/redesign/CategoryReach';
import CategoryProfile from '../../components/redesign/CategoryProfile';


export default function HeapSummary() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 1.5, maxWidth: 900 }}>
        The exposome split into lifestyle categories — alcohol, smoking, diet, exercise, sleep,
        vitamins, sun, pollution, deprivation and the rest — and scored one category at a time.
        Each category’s contribution is its leave-one-category-out predictive R²: the variance
        that is lost when that category’s polyexposure score is dropped from the full model.
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, maxWidth: 900, color: 'text.secondary' }}>
        Specification: <b>base</b> covariates with LASSO block scores, the primary specification
        used throughout. All R² values are scored on held-out cross-validation folds, so they can
        be negative; category colors follow the canonical HEAP exposure palette.
      </Typography>

      {/* The two lead visuals, both specification-aware. */}
      <CategoryReachPanel />
      <CategoryProfile />
    </Box>
  );
}
