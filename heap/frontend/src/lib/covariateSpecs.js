import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

// ---------------------------------------------------------------------------
// The covariate specifications, once.
//
// Transcribed from HEAP/config/covariates/covariate_sets.yml. `base` is the
// PRIMARY specification -- what the printed figures show -- and the rest are
// sensitivity layers on top of it.
//
// This file exists because four PES panels had each declared their own copy and
// they had already diverged: the same specification read "Healthy at baseline"
// in three of them and "excl. prevalent" in the fourth, and two of them ordered
// clinical and draw the other way round. A reader comparing panels was being
// asked to work out that those were the same analysis. Adding the enrichment
// views would have made seven copies, so the list moved here instead.
//
// `refits` is a real property, not a display hint: base_exclprev changes WHO IS
// IN the analysis, so anything fitted is fitted again. The other three change
// only the adjustment. A panel that reports a delta against base needs to know
// the difference, because for the sample specification both sides moved.
// ---------------------------------------------------------------------------

export const SPECS = [
  {
    id: 'base',
    assocSection: 'assoc_base',
    label: 'Primary (base)',
    refits: false,
    note: 'base: age, age², sex, their interactions, assessment centre, 20 genetic PCs',
  },
  {
    id: 'base_bmi',
    assocSection: 'assoc_base_plus_bmi',
    label: '+ BMI',
    refits: false,
    note: 'base + BMI. A sensitivity layer, not a mediation test — attenuation here '
      + 'cannot separate mediation from confounding',
  },
  {
    id: 'base_clinical',
    assocSection: 'assoc_base_plus_clinical',
    label: '+ clinical',
    refits: false,
    note: 'base + BMI, fasting time, season and medication classes (maximal explicit adjustment)',
  },
  {
    id: 'base_draw',
    assocSection: 'assoc_base_plus_blood_draw',
    label: '+ blood draw',
    refits: false,
    note: 'base + fasting time and assessment season',
  },
  {
    id: 'base_exclprev',
    assocSection: 'assoc_exclude_prevalent_disease',
    label: 'Healthy at baseline',
    refits: true,
    note: 'base, restricted to participants without prevalent major disease — the sample '
      + 'changes, so anything fitted is refitted',
  },
];

// The exposure-protein association shards are published under their own section
// names, which do NOT match the `spec` values in the enrichment and PES exports
// (assoc_base_plus_bmi vs base_bmi). Carrying both on one row is what lets a
// single picker move the enrichment and the effect sizes together. They have to
// move together: reading a base-specification enrichment beside +BMI betas is an
// incoherent pairing that the two separate pickers made easy to produce.
export const assocSectionFor = (id) => specById(id).assocSection;

export const SPEC_IDS = SPECS.map((s) => s.id);
export const specById = (id) => SPECS.find((s) => s.id === id) || SPECS[0];

/**
 * The picker. `only` restricts to the specifications a given export actually
 * carries -- an unavailable specification is left out rather than offered and
 * then silently falling back to base, which reads as the toggle being broken.
 */
export function SpecPicker({ value, onChange, only, label = 'Covariate specification', sx }) {
  const shown = only && only.length ? SPECS.filter((s) => only.includes(s.id)) : SPECS;
  const spec = specById(value);
  if (shown.length < 2) return null;
  return (
    <Box sx={{ mb: 1.5, ...sx }}>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
        {label}
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={spec.id}
        onChange={(_, v) => v && onChange(v)}
      >
        {shown.map((s) => (
          <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none' }}>
            {s.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
        {spec.note}
      </Typography>
    </Box>
  );
}
