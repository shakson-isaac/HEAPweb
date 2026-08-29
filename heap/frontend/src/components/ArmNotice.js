import React from 'react';
import { Alert, Chip, Tooltip } from '@mui/material';
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

/** Page-level statement. Rendered once, near the top, not per section. */
export default function ArmNotice() {
  return (
    <Alert severity="info" sx={{ mb: 3 }}>
      Motifs are assigned from the <b>UK Biobank</b> pQTL panel. A second panel,{' '}
      <b>deCODE</b> (SomaScan), supplies independent pQTL instruments and so
      corroborates the <i>protein arm</i> of a triad &mdash; the
      protein&rarr;disease and protein&rarr;exposure edges. It cannot produce an
      exposure&rarr;protein edge, which needs exposure instruments, so a deCODE
      triad can never satisfy the mediator motif on its own; the motif is
      UK&nbsp;Biobank&ndash;anchored by construction. Where deCODE estimates
      exist they are shown alongside, and agreement on the protein arm is what
      the <b>Tier&nbsp;1+</b> rung encodes: cis-anchored, colocalized{' '}
      <i>and replicated across both panels</i>.
    </Alert>
  );
}
