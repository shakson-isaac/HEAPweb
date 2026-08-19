import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Chip, Paper, Typography } from '@mui/material';
import { DocPage, Mono, P, Section, SimpleTable, SourceNote } from '../Documentation';

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
    summary: 'Demographics, assessment site and ancestry. Nothing that could be a mediator of an exposure → protein effect.',
    modules: 'modules 1, 2, 3, 5, 6, population architecture',
    covariates: BASE_CORE,
    adds: null,
    note: 'Every main figure in the manuscript uses this set, and it is the default everywhere on this site.',
  },
  {
    id: 'base_bmi',
    role: 'supplementary',
    summary: 'base plus body mass index.',
    modules: 'modules 1, 2, 3, 6',
    covariates: BASE_CORE,
    adds: ['body_mass_index_bmi_f23104_0_0'],
    note: 'BMI is a likely mediator or collider for many exposures, so it is isolated in its own set rather than folded into the primary model.',
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
    note: 'Response-category medication indicators (do not know / prefer not to answer / none of the above) are deliberately excluded; only the five real classes are adjusted for.',
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
    note: 'These nine variables live in the Deprivation_Indices exposure and are moved into the covariate matrix at run time, so they are not counted as both exposure and covariate. Wales and Scotland scores are dropped for more than 20% missingness. The set includes the overall England index alongside its seven domain sub-scores, so it is collinear by construction — acceptable only because the SES coefficients are never interpreted. The remap is implemented in Module 2 alone, which is why the set is offered nowhere else.',
  },
  {
    id: 'base_prevalent',
    role: 'supplementary',
    summary: 'base plus a prevalent major chronic disease flag.',
    modules: 'modules 1, 2, 3, 6',
    covariates: BASE_CORE,
    adds: ['prevalent_major_disease'],
    note: 'The adjustment-axis answer to the reviewer question about prevalent disease. Its complement on the sample axis is the exclude_prevalent filter, which drops those participants instead of adjusting for them.',
  },
];

export default function Specifications() {
  return (
    <DocPage
      title="Specifications"
      lead="Six named covariate sets are defined for HEAP. One of them is the primary model behind every main result; the other five exist so that the robustness of that result can be inspected rather than asserted."
    >
      <Section title="base is the primary specification">
        <P>
          <Mono>base</Mono> contains only structural confounders — demographics, assessment site
          and ancestry — chosen because none of them can be a mediator of an exposure → protein
          effect. Every main figure in the manuscript uses it, and it is the default in every
          switcher on this site. The other five sets are supplementary sensitivity layers, each
          adding one potentially mediating or optional adjustment on top of <Mono>base</Mono>, so
          that the movement in an estimate can be attributed to a specific adjustment.
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
        <SourceNote>
          <Mono>HEAP/config/covariates/covariate_sets.yml</Mono>, version 2.0.
        </SourceNote>
      </Section>

      <Section title="+ BMI is a sensitivity layer, not a mediation test">
        <Alert severity="warning" sx={{ maxWidth: 820, mb: 1.5 }}>
          Attenuation of an estimate after adjusting for BMI <b>cannot</b> distinguish mediation
          from confounding. The <Mono>base_bmi</Mono> specification is a sensitivity layer
          everywhere it appears on this site, and nothing derived from it is presented as evidence
          of a mediated pathway.
        </Alert>
        <P>
          If an exposure–protein estimate shrinks under <Mono>base_bmi</Mono>, that is consistent
          with BMI lying on the causal path, with BMI confounding the association, and with BMI
          being a collider — the three cannot be separated by adjustment. Mediation is addressed
          separately, and descriptively, in <Link to="/results/mediation">Disease links</Link>;
          causal adjudication is separate again, in{' '}
          <Link to="/results/causal">Causal evidence</Link>.
        </P>
        <SourceNote><Mono>docs/TASKS.md</Mono> standing decision S2.</SourceNote>
      </Section>

      <Section title="base_ses over-adjusts, on purpose">
        <Alert severity="warning" sx={{ maxWidth: 820, mb: 1.5 }}>
          <Mono>base_ses</Mono> is never a default. Adding deprivation to the covariate matrix
          removes it from the exposome, so the specification is not a robustness check on the
          exposome result — it is a different analysis of a smaller exposome.
        </Alert>
        <P>
          The nine deprivation variables are exposures in HEAP. Moving them into the covariate
          matrix deletes an entire exposure category from the model, which makes{' '}
          <Mono>base_ses</Mono> mis-specified for anything that treats the exposome as a whole. It
          is offered in Module 2 only, and labelled with this caveat wherever it appears.
        </P>
        <SourceNote>
          <Mono>docs/TASKS.md</Mono> standing decision S1; set definition and the{' '}
          <Mono>e_to_covariate</Mono> remap from <Mono>covariate_sets.yml</Mono>.
        </SourceNote>
      </Section>

      <Section
        title="The sets in full"
        subtitle="Field names exactly as they appear in covariate_sets.yml. Every set contains the base block; the second column is what that set adds to it."
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
        <SourceNote>
          <Mono>sex</Mono> and <Mono>uk_biobank_assessment_centre</Mono> are coerced to factors;{' '}
          <Mono>age2</Mono>, <Mono>age_sex</Mono> and <Mono>age2_sex</Mono> are the derived
          quadratic and interaction terms, not separate UK Biobank fields.
        </SourceNote>
      </Section>

      <Section title="Migration from the old Type1–Type7 naming">
        <P>
          The previous scheme numbered covariate sets Type1 to Type7, and the earlier version of
          this website keyed its association pages on <Mono>Type6</Mono>. That scheme is retired.
          The sets were <i>renamed</i> rather than redefined in place, so results produced under
          the old names remain valid — with one exception, which matters.
        </P>
        <SimpleTable
          head={['Old', 'New', 'Note']}
          rows={[
            ['Type3', <Mono>base</Mono>, <span><b>Not a pure rename.</b> <Mono>base</Mono> drops BMI and fasting time from the old Type3, so <Mono>base</Mono> ≠ Type3. A Type3 result and a base result are different models.</span>],
            ['Type4, Type5', <Mono>base_clinical</Mono>, 'Both fold into the maximal explicit adjustment.'],
            ['Type6', <Mono>base_ses</Mono>, 'The set the old site served unlabelled as its default.'],
            ['Type1 (age + sex)', '— dropped', 'No longer produced.'],
            ['Type2 (no-PC metabolic)', '— dropped', 'No longer produced.'],
            ['Type7 (medications as exposures)', '— dropped', 'No longer produced.'],
          ]}
        />
        <SourceNote>
          migration block at the head of <Mono>covariate_sets.yml</Mono>; the archived
          definitions are kept in <Mono>covariate_sets_v1_archive.yml</Mono>.
        </SourceNote>
      </Section>

      <Section title="Three sensitivity axes, not one">
        <P>
          The covariate set is only one of the axes the supplement varies. Reading them as a
          single list of alternative models conflates adjustments with sample definitions.
        </P>
        <SimpleTable
          head={['Axis', 'Varies', 'Deposited variants']}
          rows={[
            ['Adjustment', 'which covariates enter the model', <span><Mono>base</Mono>, <Mono>base_plus_bmi</Mono>, <Mono>base_plus_blood_draw</Mono>, <Mono>base_plus_clinical</Mono></span>],
            ['Sample', 'which participants are analyzed', <span><Mono>exclude_prevalent_disease</Mono> — participants with prevalent major disease are removed rather than adjusted for</span>],
            ['Estimator', 'how the penalized score is fitted', <span><Mono>estimator_ridge</Mono>, <Mono>estimator_elastic_net</Mono> (variance decomposition and mediation only)</span>],
          ]}
        />
        <P>
          A fourth axis, the interaction structure (
          <Mono>interactions_gene_by_covariate</Mono>, <Mono>interactions_exposure_by_covariate</Mono>,{' '}
          <Mono>interactions_both</Mono>), is varied for the variance decomposition alone.
        </P>
        <SourceNote>
          folder layout of the published supplementary deposit (<Mono>supp_catalog.json.gz</Mono>).
        </SourceNote>
      </Section>

      <Section title="What is actually published under each specification">
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
          Two of the six defined sets are therefore <b>not</b> in the published payload:{' '}
          <Mono>base_ses</Mono>, which is Module-2 only, and the{' '}
          <Mono>base_prevalent</Mono> adjustment, whose question is answered on the sample axis by{' '}
          <Mono>exclude_prevalent_disease</Mono> instead. The switcher on{' '}
          <Link to="/results/associations">Associations</Link> shows exactly the five that exist.
        </P>
        <SourceNote>
          published section ids in <Mono>manifest.json.gz</Mono> and file layout in{' '}
          <Mono>supp_catalog.json.gz</Mono>, both read from the live payload.
        </SourceNote>
      </Section>
    </DocPage>
  );
}
