import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Chip, Paper, Typography } from '@mui/material';
import { DocPage, Mono, P, Section, SimpleTable } from '../Documentation';

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
    role: 'PRIMARY',
    summary: 'Demographics, assessment site and ancestry.',
    modules: 'modules 1, 2, 3, 5, 6, population architecture',
    covariates: BASE_CORE,
    adds: null,
    note: 'Every main figure in the manuscript uses this set. It is the default across this site.',
  },
  {
    id: 'base_bmi',
    role: 'supplementary',
    summary: 'base plus body mass index.',
    modules: 'modules 1, 2, 3, 6',
    covariates: BASE_CORE,
    adds: ['body_mass_index_bmi_f23104_0_0'],
    note: 'BMI can act as a mediator or a collider for many exposures, so it is kept in its own set.',
  },
  {
    id: 'base_draw',
    role: 'supplementary',
    summary: 'base plus the conditions at blood draw.',
    modules: 'modules 1, 2, 3, 6',
    covariates: BASE_CORE,
    adds: ['fasting_time_f74_0_0', 'assessment_season'],
    note: 'Metabolic state at the draw and the time of year the sample was taken.',
  },
  {
    id: 'base_clinical',
    role: 'supplementary — maximal explicit adjustment',
    summary: 'base plus BMI, draw conditions and five medication classes.',
    modules: 'modules 1, 2, 3, 6, population architecture',
    covariates: BASE_CORE,
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
    note: 'Five medication classes are adjusted for. Response categories (do not know / prefer not to answer / none of the above) are excluded.',
  },
  {
    id: 'base_ses',
    role: 'supplementary — MODULE 2 ONLY',
    summary: 'base plus socioeconomic deprivation, remapped out of the exposome.',
    modules: 'module 2 only',
    covariates: BASE_CORE,
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
    note: 'These nine variables belong to the Deprivation_Indices exposure and move into the covariate matrix at run time, so each is counted once. Wales and Scotland scores are dropped for more than 20% missingness. The set holds the overall England index alongside its seven domain sub-scores, so it is collinear by construction, and the SES coefficients are left uninterpreted. The remap is implemented in Module 2, so the set is offered there only.',
  },
  {
    id: 'base_prevalent',
    role: 'supplementary',
    summary: 'base plus a prevalent major chronic disease flag.',
    modules: 'modules 1, 2, 3, 6',
    covariates: BASE_CORE,
    adds: ['prevalent_major_disease'],
    note: 'The adjustment-axis treatment of prevalent disease. Its sample-axis counterpart is the exclude_prevalent filter, which drops those participants.',
  },
];

export default function Specifications() {
  return (
    <DocPage
      title="Specifications"
      lead="Six named covariate sets are defined for HEAP. One is the primary model behind every main result. The other five are sensitivity layers."
    >
      <Section title="base is the primary specification">
        <P>
          <Mono>base</Mono> holds structural confounders only: demographics, assessment site and
          ancestry. None of them can mediate an exposure → protein effect. Every main figure in the
          manuscript uses it, and it is the default in every switcher here. Each of the other five
          sets adds one adjustment on top of <Mono>base</Mono>, so a shift in an estimate can be
          attributed to that adjustment.
        </P>
        <SimpleTable
          head={['Set', 'Role', 'Adds to base', 'Available in']}
          rows={SETS.map((s) => [
            <Chip
              size="small" label={s.id}
              sx={{
                fontFamily: 'ui-monospace, monospace', fontWeight: 600,
                backgroundColor: s.role === 'PRIMARY' ? '#124533' : '#e8e8ea',
                color: s.role === 'PRIMARY' ? '#fff' : 'inherit',
              }}
            />,
            s.role,
            s.adds ? s.adds.length : '—',
            s.modules,
          ])}
        />
      </Section>

      <Section title="+ BMI is a sensitivity layer">
        <Alert severity="warning" sx={{ maxWidth: 820, mb: 1.5 }}>
          Attenuation after BMI adjustment can arise from mediation, from confounding or from
          collider bias. <Mono>base_bmi</Mono> is labeled a sensitivity layer wherever it appears
          on this site.
        </Alert>
        <P>
          An estimate that shrinks under <Mono>base_bmi</Mono> is consistent with BMI on the causal
          path, with BMI confounding the association, and with BMI as a collider. Adjustment cannot
          separate the three. Mediation is reported descriptively in{' '}
          <Link to="/results/mediation">Disease links</Link>, and causal adjudication in{' '}
          <Link to="/results/causal">Causal evidence</Link>.
        </P>
      </Section>

      <Section title="base_ses answers a different question">
        <Alert severity="warning" sx={{ maxWidth: 820, mb: 1.5 }}>
          Adding deprivation to the covariate matrix removes it from the exposome, so{' '}
          <Mono>base_ses</Mono> estimates a smaller exposome. It is a separate analysis, and it is
          a default nowhere on this site.
        </Alert>
        <P>
          The nine deprivation variables are exposures in HEAP. Moving them into the covariate
          matrix deletes an exposure category from the model, which makes <Mono>base_ses</Mono>{' '}
          mis-specified for the exposome as a whole. It is offered in Module 2 only.
        </P>
      </Section>

      <Section
        title="The sets in full"
        subtitle="Field names as they appear in covariate_sets.yml. Every set contains the base block, and the second row is what the set adds."
      >
        {SETS.map((s) => (
          <Paper key={s.id} variant="outlined" sx={{ p: 2, mb: 2, maxWidth: 820 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
              >
                {s.id}
              </Typography>
              <Chip size="small" label={s.role} variant="outlined" />
            </Box>
            <Typography variant="body2" sx={{ mb: 1 }}>{s.summary}</Typography>
            <SimpleTable
              head={['Block', 'Covariates']}
              rows={[
                [
                  'base',
                  <Box component="ul" sx={{ m: 0, pl: 2.2, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>
                    {s.covariates.map((c) => <li key={c}>{c}</li>)}
                  </Box>,
                ],
                ...(s.adds
                  ? [[
                    `+ ${s.id}`,
                    <Box component="ul" sx={{ m: 0, pl: 2.2, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>
                      {s.adds.map((c) => <li key={c}>{c}</li>)}
                    </Box>,
                  ]]
                  : []),
              ]}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.note}</Typography>
          </Paper>
        ))}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          <Mono>sex</Mono> and <Mono>uk_biobank_assessment_centre</Mono> are coerced to factors.{' '}
          <Mono>age2</Mono>, <Mono>age_sex</Mono> and <Mono>age2_sex</Mono> are derived quadratic
          and interaction terms.
        </Typography>
      </Section>

      <Section title="Migration from the old Type1–Type7 naming">
        <P>
          The previous scheme numbered covariate sets Type1 to Type7, and the earlier version of
          this website keyed its association pages on <Mono>Type6</Mono>. That scheme is retired.
          The sets were renamed, so results produced under the old names remain valid. One
          exception matters.
        </P>
        <SimpleTable
          head={['Old', 'New', 'Note']}
          rows={[
            ['Type3', <Mono>base</Mono>, <span><b>Different model.</b> <Mono>base</Mono> drops BMI and fasting time from the old Type3, so a Type3 result and a base result come from different models.</span>],
            ['Type4, Type5', <Mono>base_clinical</Mono>, 'Both fold into the maximal explicit adjustment.'],
            ['Type6', <Mono>base_ses</Mono>, 'The set the old site served unlabelled as its default.'],
            ['Type1 (age + sex)', '— dropped', 'No longer produced.'],
            ['Type2 (no-PC metabolic)', '— dropped', 'No longer produced.'],
            ['Type7 (medications as exposures)', '— dropped', 'No longer produced.'],
          ]}
        />
      </Section>

      <Section title="Three sensitivity axes">
        <P>
          The covariate set is one of three axes the supplement varies. The other two are the
          analyzed sample and the estimator.
        </P>
        <SimpleTable
          head={['Axis', 'Varies', 'Deposited variants']}
          rows={[
            ['Adjustment', 'which covariates enter the model', <span><Mono>base</Mono>, <Mono>base_plus_bmi</Mono>, <Mono>base_plus_blood_draw</Mono>, <Mono>base_plus_clinical</Mono></span>],
            ['Sample', 'which participants are analyzed', <span><Mono>exclude_prevalent_disease</Mono> — participants with prevalent major disease are dropped from the sample</span>],
            ['Estimator', 'how the penalized score is fitted', <span><Mono>estimator_ridge</Mono>, <Mono>estimator_elastic_net</Mono> (variance decomposition and mediation only)</span>],
          ]}
        />
        <P>
          A fourth axis, the interaction structure (
          <Mono>interactions_gene_by_covariate</Mono>, <Mono>interactions_exposure_by_covariate</Mono>,{' '}
          <Mono>interactions_both</Mono>), is varied for the variance decomposition alone.
        </P>
      </Section>

      <Section title="What is published under each specification">
        <P>
          Five specifications are deposited for the exposure–protein associations, the G×E
          associations, the variance decomposition and the mediation results:{' '}
          <Mono>base</Mono>, <Mono>base_plus_bmi</Mono>, <Mono>base_plus_blood_draw</Mono>,{' '}
          <Mono>base_plus_clinical</Mono> and <Mono>exclude_prevalent_disease</Mono>. The
          exposure-score results use the same five under shorter names (<Mono>base</Mono>,{' '}
          <Mono>base_bmi</Mono>, <Mono>base_draw</Mono>, <Mono>base_clinical</Mono>,{' '}
          <Mono>base_exclprev</Mono>).
        </P>
        <P>
          Two of the six defined sets are absent from the published payload. <Mono>base_ses</Mono>{' '}
          is Module 2 only. The <Mono>base_prevalent</Mono> adjustment is covered on the sample axis
          by <Mono>exclude_prevalent_disease</Mono>. The switcher on{' '}
          <Link to="/results/associations">Associations</Link> shows the five that exist.
        </P>
      </Section>
    </DocPage>
  );
}
