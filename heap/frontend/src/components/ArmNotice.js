import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { useSectionMeta } from '../lib/useSection';

// The MR analysis runs against TWO pQTL INSTRUMENT PANELS -- UK Biobank (Olink)
// and deCODE (SomaScan). This is NOT two cohorts: the participants, exposures
// and disease outcomes are the same in both arms, and only the genetic
// instruments for the PROTEINS differ. The data shows this directly -- edges
// with no protein in them are identical across arms (D->E Tier-1: 266 vs 266),
// while protein-instrumented edges diverge sharply (E->P Tier-1: 1,505 vs 78,
// largely SomaScan/Olink panel non-overlap).
//
// Most exports carry no arm column, so a section is one panel by default with
// nothing in the data saying which.
//
// IMPORTANT: deCODE cannot classify a triad by itself. It instruments the
// protein as an exposure, so it yields P->D and P->E only; motif A requires
// E->P, which the UK Biobank arm supplies. Never present a deCODE motif label
// as an alternative classification -- it reads as a demotion when it is really
// an absence of the edge type deCODE cannot instrument.
//
// The paper's own Tier 1+ rung REQUIRES replication across both panels, so
// "which arm" is not a footnote here; it changes what a tier means.
//
// This used to render on the /results/causal landing page as an Alert saying
// the same thing to visitors. It was removed (2026-09-19): it is methods, and it
// met a reader before any result. The explanation lives here and in Methods.
const LABEL = { UKB: 'UK Biobank (Olink) pQTL instruments', DECODE: 'deCODE (SomaScan) pQTL instruments' };

export function ArmChip({ sectionId }) {
  const { meta } = useSectionMeta(sectionId);
  const arm = meta?.arm;
  if (!arm) return null;
  if (arm === 'in-data') {
    return (
      <Tooltip title="This section's own rows carry the instrument panel; both are shown.">
        <Chip size="small" variant="outlined" label="both pQTL panels" />
      </Tooltip>
    );
  }
  return (
    <Tooltip title={`Protein instruments from ${LABEL[arm] || arm}. The other panel was analyzed but is not shown in this section. Same participants either way \u2014 only the protein instruments differ.`}>
      <Chip size="small" color="warning" variant="outlined" label={`${arm} pQTL instruments`} />
    </Tooltip>
  );
}
