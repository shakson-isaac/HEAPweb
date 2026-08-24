import React from 'react';
import { Alert, AlertTitle, Box, Divider, Typography } from '@mui/material';
import VarianceReach from '../../components/redesign/VarianceReach';
import VarianceStack from '../../components/redesign/VarianceStack';
import ExposomicGradient from '../../components/redesign/ExposomicGradient';
import CategoryReach from '../../components/redesign/CategoryReach';
import CategoryProfile from '../../components/redesign/CategoryProfile';
import MediationLandscape from '../../components/redesign/MediationLandscape';
import PleiotropySpectrum from '../../components/redesign/PleiotropySpectrum';
import MediationGrid from '../../components/redesign/MediationGrid';
import DriverComparison from '../../components/redesign/DriverComparison';

// ---------------------------------------------------------------------------
// The three proposed primary visuals, on one page, for comparison.
//
// NOT LINKED FROM THE NAVIGATION and NOT PUBLISHED. It reads from
// public/mockup/, which is scratch data, so nothing here can affect the live
// site. Its only purpose is to let the three designs be argued with side by
// side before any of them is committed to a page, a section or the bucket.
//
// If a design is accepted it moves to its page and its data moves to a real
// builder; if it is dropped, deleting this file and public/mockup/ removes it
// completely.
// ---------------------------------------------------------------------------

export default function DesignPreview() {
  return (
    <Box sx={{ mt: 2 }}>
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Design preview — not part of the site</AlertTitle>
        Three proposed lead visuals, one for Main results, Lifestyle categories and Disease
        links. Each reads real deposit data through a scratch file rather than a published
        section, and each replaces a page that currently opens with between five and nine
        charts. The existing sections are not touched; the plan is that they move below the
        lead visual rather than being removed.
      </Alert>

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        1 · Main results — variance partitioning
      </Typography>
      <VarianceReach />
      <VarianceStack />
      <ExposomicGradient />

      <Divider sx={{ my: 4 }} />
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        2 · Lifestyle categories
      </Typography>
      <CategoryReach />
      <CategoryProfile />

      <Divider sx={{ my: 4 }} />
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        3 · Disease links — mediation
      </Typography>
      <MediationLandscape />
      <PleiotropySpectrum />
      <MediationGrid />
      <DriverComparison />
    </Box>
  );
}
