import React from 'react';
import { Box, Typography } from '@mui/material';

import CategoryReachPanel from '../../components/redesign/CategoryReach';
import CategoryProfile from '../../components/redesign/CategoryProfile';


export default function HeapSummary() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 900 }}>
        Which parts of the exposome account for the proteome’s exposure-responsive variation?
        The exposome was grouped into 13 categories spanning lifestyle, physical-environment and
        socioeconomic domains.
      </Typography>

      {/* The two lead visuals, both specification-aware. */}
      <CategoryReachPanel />
      <CategoryProfile />
    </Box>
  );
}
