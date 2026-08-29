import React from 'react';

import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Link, Typography } from '@mui/material';
import PleiotropySpectrum from '../../components/redesign/PleiotropySpectrum';
import MediationGrid from '../../components/redesign/MediationGrid';
import DriverComparison from '../../components/redesign/DriverComparison';
import MediationLandscape from '../../components/redesign/MediationLandscape';


// Verbatim, and repeated next to every mediated-fraction number on the page.
// Do not reword: this is the manuscript's own statement of what an
// observational mediation estimate is and is not.
const CAVEAT = 'Observational mediation estimates are descriptive and may reflect '
  + 'confounding, reverse causation, or shared upstream causes. Causal support is '
  + 'evaluated separately using MR and colocalization.';

function Caveat({ withLink = false, sx }) {
  return (
    <Alert severity="info" sx={{ my: 2, ...sx }}>
      {CAVEAT}
      {withLink && (
        <Box sx={{ mt: 1 }}>
          <Link component={RouterLink} to="/results/causal">
            Causal adjudication — Mendelian randomization and colocalization →
          </Link>
        </Box>
      )}
    </Alert>
  );
}

export default function Mediation() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Disease links</Typography>
      <Typography variant="body1" sx={{ mb: 1, maxWidth: 900 }}>
        Each protein → disease link estimated by the mediation analysis: how much of an
        exposure&apos;s effect on disease is carried by the protein, how that compares with the
        genetic arm of the same link, and which lifestyle domain the exposure arm comes from.
        Every estimate here comes from proportional-hazards mediation models fitted in UK Biobank —
        not from a trial and not from an instrumental-variable design.
      </Typography>
      <Caveat withLink />

      {/* Four lead visuals, left all visible while the remaining partitioned
          specifications finish. Which one deserves to lead depends on how they
          read across five specifications rather than one, so the order here is
          provisional and the page says so. */}
      <PleiotropySpectrum />
      <MediationGrid />
      <DriverComparison />
      <MediationLandscape />
    </Box>
  );
}
