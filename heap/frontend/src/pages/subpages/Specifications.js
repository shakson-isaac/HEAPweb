import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { DocPage, Mono, P, Section, SimpleTable } from '../Documentation';

// Rewritten 2026-10-05, twice over.
//
// The first version was a manuscript methods table: role, count-of-covariates-
// added, which analysis modules offered each set. The second answered why more
// than one model exists and what each adds -- but it documented the SIX sets
// defined in covariate_sets.yml, which is the wrong set for this page.
//
// What a visitor can actually switch between is the five in lib/covariateSpecs
// SPECS, and the mismatch was not cosmetic: base_ses and base_prevalent were
// documented but are offered nowhere, while `Healthy at baseline` -- the fifth
// button on every switcher -- had no row at all. It is also the one that works
// differently from the others, and nothing said so.
//
// So this page now mirrors lib/covariateSpecs.js, in its order, with its
// labels. If a specification is added there, add it here.

const BASE_CORE = [
  'age_when_attended_assessment_centre_f21003_0_0',
  'sex_f31_0_0',
  'age2',
  'age_sex',
  'age2_sex',
  'uk_biobank_assessment_centre_f54_0_0',
  'genetic_principal_components_f22009_0_1 … genetic_principal_components_f22009_0_20',
];

// Order, ids and labels follow lib/covariateSpecs.js SPECS exactly, so the page
// reads in the same order as the control it describes.
const SPECS = [
  {
    id: 'base',
    label: 'Primary (base)',
    kind: 'model',
    adds: null,
    addsPlain: 'age, age², sex, their interactions, assessment centre, 20 genetic PCs',
    tells: 'The primary model, and what every other specification is measured against. None of these can sit on the path from an exposure to a protein.',
  },
  {
    id: 'base_bmi',
    label: '+ BMI',
    kind: 'model',
    adds: ['body_mass_index_bmi_f23104_0_0'],
    addsPlain: 'body mass index',
    tells: 'Attenuation here is not evidence of mediation: BMI can be a mediator, a confounder or a collider, and adjustment cannot tell them apart.',
  },
  {
    id: 'base_clinical',
    label: '+ clinical',
    kind: 'model',
    adds: [
      'body_mass_index_bmi_f23104_0_0',
      'fasting_time_f74_0_0',
      'assessment_season',
      'combined_Blood_pressure_medication',
      'combined_Hormone_replacement_therapy',
      'combined_Oral_contraceptive_pill_or_minipill',
      'combined_Insulin',
      'combined_Cholesterol_lowering_medication',
    ],
    addsPlain: 'BMI, the draw conditions, and blood-pressure, HRT, oral-contraceptive, insulin and cholesterol-lowering medication',
    tells: 'The most heavily adjusted model on the site.',
  },
  {
    id: 'base_draw',
    label: '+ blood draw',
    kind: 'model',
    adds: ['fasting_time_f74_0_0', 'assessment_season'],
    addsPlain: 'fasting time and the season of the visit',
    tells: 'Whether the conditions at the blood draw explain the result.',
  },
  {
    id: 'base_exclprev',
    label: 'Healthy at baseline',
    kind: 'sample',
    adds: null,
    addsPlain: 'nothing — it drops participants instead',
    tells: 'Whether the result holds in people who were not already ill. Participants with a prevalent major chronic disease at the blood draw are excluded, about 15% of the panel.',
  },
];

export default function Specifications() {
  return (
    <DocPage
      title="Specifications"
      lead="Every number on this site was produced under one of five specifications. The control on a results page switches between them."
    >
      <Section title="The five specifications">
        <P>
          Four of the five change the <b>model</b>, each adding a single adjustment on top of{' '}
          <Mono>base</Mono> so that a shift in an estimate is attributable to that one adjustment.
          The fifth changes the <b>sample</b>.
        </P>
        <SimpleTable
          head={['Specification', 'Changes', 'What it tells you']}
          rows={SPECS.map((s) => [
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {s.label}
              </Typography>
              <Mono>{s.id}</Mono>
            </Box>,
            <Box>
              <Typography variant="caption" sx={{
                display: 'block', fontWeight: 700, letterSpacing: '0.06em',
                color: s.kind === 'sample' ? 'text.primary' : 'text.secondary',
              }}>
                {s.kind === 'sample' ? 'THE SAMPLE' : 'THE MODEL'}
              </Typography>
              {s.addsPlain}
            </Box>,
            s.tells,
          ])}
        />
      </Section>

      <Section title="Why “Healthy at baseline” is not like the others">
        <P>
          The four adjustment specifications re-estimate the same model on the same people. “Healthy
          at baseline” estimates it on <b>different people</b>, so everything downstream is refitted —
          the exposure scores, the variance decomposition and the mediation models are all trained
          again on the smaller sample.
        </P>
        <P>
          A difference between <Mono>base</Mono> and an adjustment layer therefore says something
          about that covariate. A difference between <Mono>base</Mono> and this one says something
          about who was analyzed, and the two are not read the same way.
        </P>
      </Section>

      <Section title="Using the control">
        <P>
          A results page with a <b>Specification</b> control opens on <Mono>base</Mono>, and
          switching shows the same result as fitted under that specification. A page offers
          whichever of the five exist for the result on screen, rather than offering one that would
          silently fall back to <Mono>base</Mono>.
        </P>
        <P>
          The estimator is varied too — ridge and elastic net, for the variance decomposition and
          mediation — but that is deposited with the supplement rather than offered as a control.
        </P>
      </Section>

      <Section
        title="The exact covariates"
        subtitle="Field names as they appear in covariate_sets.yml, for reproducing a fit."
      >
        <Paper variant="outlined" sx={{ p: 2, mb: 2, maxWidth: 820 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Every specification contains the <Mono>base</Mono> block
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.2, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>
            {BASE_CORE.map((c) => <li key={c}>{c}</li>)}
          </Box>
        </Paper>
        <SimpleTable
          head={['Specification', 'What it adds to base']}
          rows={SPECS.filter((s) => s.adds || s.kind === 'sample').map((s) => [
            <Mono>{s.id}</Mono>,
            s.adds ? (
              <Box component="ul" sx={{ m: 0, pl: 2.2, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>
                {s.adds.map((c) => <li key={c}>{c}</li>)}
              </Box>
            ) : (
              <span>
                No covariates. The <Mono>base</Mono> block is fitted on the subset of participants
                without a prevalent major chronic disease.
              </span>
            ),
          ])}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          <Mono>sex</Mono> and <Mono>uk_biobank_assessment_centre</Mono> are coerced to factors.{' '}
          <Mono>age2</Mono>, <Mono>age_sex</Mono> and <Mono>age2_sex</Mono> are derived quadratic
          and interaction terms. Which covariates sit behind any single estimate is also in{' '}
          <Link to="/documentation/methods">Detailed methods</Link>.
        </Typography>
      </Section>
    </DocPage>
  );
}
