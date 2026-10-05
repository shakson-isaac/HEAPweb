import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { DocPage, Mono, P, Section, SimpleTable } from '../Documentation';

// Rewritten 2026-10-05. The page used to open with a summary table of the six
// sets keyed on role, count-of-covariates-added and which analysis modules
// offered them -- a manuscript methods table, on a website. It now answers the
// three questions a visitor actually arrives with: why more than one model
// exists, what each one adds, and what the control on a results page does.
// The exact field names stay, as reference, at the bottom.

// Transcribed from HEAP/config/covariates/covariate_sets.yml (version 2.0), the
// single source of truth for named covariate sets across all HEAP modules.
// Field names are reproduced exactly as they appear there.
const BASE_CORE = [
  'age_when_attended_assessment_centre_f21003_0_0',
  'sex_f31_0_0',
  'age2',
  'age_sex',
  'age2_sex',
  'uk_biobank_assessment_centre_f54_0_0',
  'genetic_principal_components_f22009_0_1 … genetic_principal_components_f22009_0_20',
];

const SETS = [
  {
    id: 'base',
    label: 'base',
    adds: null,
    addsPlain: 'nothing — this is the model everything else is measured against',
    tests: 'The primary model. It holds structural confounders only: age, sex, where and when the sample was taken, and ancestry. None of them can sit on the path from an exposure to a protein.',
  },
  {
    id: 'base_bmi',
    label: '+ BMI',
    adds: ['body_mass_index_bmi_f23104_0_0'],
    addsPlain: 'body mass index',
    tests: 'Whether a result survives adjusting for body size. An estimate that shrinks here is equally consistent with BMI on the causal path, BMI confounding the association, and BMI as a collider — adjustment cannot separate the three, so attenuation is not evidence of mediation.',
  },
  {
    id: 'base_draw',
    label: '+ blood draw',
    adds: ['fasting_time_f74_0_0', 'assessment_season'],
    addsPlain: 'fasting time and the season of the visit',
    tests: 'Whether the conditions at the blood draw explain the result rather than the exposure.',
  },
  {
    id: 'base_clinical',
    label: '+ clinical',
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
    addsPlain: 'BMI, the draw conditions, and five medication classes',
    tests: 'The most heavily adjusted model on the site. Blood pressure, hormone replacement, oral contraceptive, insulin and cholesterol-lowering medication are each adjusted for.',
  },
  {
    id: 'base_ses',
    label: '+ deprivation',
    adds: [
      'average_total_household_income_before_tax_f738_0_0',
      'index_of_multiple_deprivation_england_f26410_0_0',
      'income_score_england_f26411_0_0',
      'employment_score_england_f26412_0_0',
      'health_score_england_f26413_0_0',
      'education_score_england_f26414_0_0',
      'housing_score_england_f26415_0_0',
      'crime_score_england_f26416_0_0',
      'living_environment_score_england_f26417_0_0',
    ],
    addsPlain: 'household income and eight deprivation scores',
    tests: 'A different question, not a stricter version of the same one. Those nine variables are exposures in HEAP, so moving them into the model deletes a whole exposure category from the exposome being estimated. Fitted for the associations only, and a default nowhere.',
  },
  {
    id: 'base_prevalent',
    label: '+ prevalent disease',
    adds: ['prevalent_major_disease'],
    addsPlain: 'a flag for prevalent major chronic disease',
    tests: 'Whether disease a participant already had at the draw explains the result. Its counterpart on the sample side drops those participants instead of adjusting for them.',
  },
];

export default function Specifications() {
  return (
    <DocPage
      title="Specifications"
      lead="A specification is the set of covariates an estimate was adjusted for. Every number on this site was produced under one of six, and the control on a results page switches between them."
    >
      <Section title="Why there is more than one">
        <P>
          What an exposure–protein estimate comes out at depends on what else is in the model.
          Adjust for nothing and a result can be driven by age or sex; adjust for everything and a
          variable on the causal path can be removed along with the confounders. HEAP fits one
          primary model and five variants, each adding a single adjustment on top of it, so a
          movement in an estimate can be attributed to that one adjustment rather than to a
          wholesale change of model.
        </P>
      </Section>

      <Section title="The six specifications">
        <SimpleTable
          head={['Specification', 'Adds', 'What it tells you']}
          rows={SETS.map((s) => [
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {s.label}
              </Typography>
              <Mono>{s.id}</Mono>
            </Box>,
            s.addsPlain,
            s.tests,
          ])}
        />
      </Section>

      <Section title="Using the control">
        <P>
          A results page that carries a <b>Specification</b> control opens on <Mono>base</Mono>.
          Switching re-reads the same result as it was fitted under that adjustment; nothing is
          refitted in the browser, and no estimate changes meaning. Five are published —{' '}
          <Mono>base</Mono>, <Mono>+ BMI</Mono>, <Mono>+ blood draw</Mono>,{' '}
          <Mono>+ clinical</Mono> and the exclude-prevalent-disease sample variant — so a page
          offers the subset that exists for the result it is showing.
        </P>
        <P>
          The covariate set is one of three things the supplement varies. The other two are the
          analyzed sample (dropping participants with prevalent major disease) and the estimator
          (ridge and elastic net, for the variance decomposition and mediation). Those are
          deposited rather than offered as a control.
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
          rows={SETS.filter((x) => x.adds).map((x) => [
            <Mono>{x.id}</Mono>,
            <Box component="ul" sx={{ m: 0, pl: 2.2, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>
              {x.adds.map((c) => <li key={c}>{c}</li>)}
            </Box>,
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
