import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Chip, Paper, Typography, Box } from '@mui/material';
import {
  DocPage, HeadlineFallback, Mono, P, Section, SimpleTable, macro, useHeadline,
} from '../Documentation';

// Structural description of each module: what it estimates, from what, and where
// the result surfaces. Interpretation of any result belongs to the manuscript and
// is not restated here (standing decision S13).
function ModuleCard({ number, name, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, maxWidth: 820 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={number} color="primary" sx={{ fontWeight: 700 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{name}</Typography>
      </Box>
      {children}
    </Paper>
  );
}

export default function DetailedMethods() {
  const { data: h, error } = useHeadline();
  const n = (k) => macro(h, k);

  return (
    <DocPage
      title="Detailed methods"
      lead="How each result on this site was produced: the sample, the six analysis modules, and the two supporting analyses. The full methods are in the paper."
    >
      <HeadlineFallback error={error} />

      <Section title="Sample and measurements">
        <SimpleTable
          head={['Component', 'What was used']}
          rows={[
            ['Cohort', <span>{n('nParticipants')} UK Biobank participants with a baseline plasma proteomic draw</span>],
            ['Proteome', <span>{n('nProteins')} normalized, batch-corrected Olink plasma protein levels in the analyzed panel; {n('nProteinsPES')} in the longitudinal panel used for the exposure scores</span>],
            ['Exposome', <span>{n('nExposures')} exposomic features across 13 categories — see the <Link to="/documentation/dictionary">exposome dictionary</Link></span>],
            ['Genetics', 'UK Biobank imputed genotypes; polygenic scores taken from the OMICSPRED resource'],
            ['Outcomes', <span>{n('nDiseasesGEM')} incident first-occurrence disease outcomes, restricted to those with at least 100 incident cases</span>],
            ['Design', 'a training / held-out test split; associations are reported as replicated only when they hold in both'],
          ]}
        />
      </Section>

      <Section
        title="The six modules"
        subtitle="Module numbers follow the manuscript."
      >
        <ModuleCard number="Module 1" name="Variance decomposition">
          <P>
            How much of each protein&apos;s variation covariates, genetics, the exposome and
            gene-by-environment interaction each explain.
          </P>
          <P>
            Two estimators, run side by side. The <b>predictive decomposition</b> fits a polygenic
            score and a penalized poly-exposure score and scores them out of fold; a component&apos;s
            share is the drop in held-out R² when its score is removed from the full model.{' '}
            <b>GREML</b> instead builds three similarity kernels — genetic relatedness, exposures,
            and their element-wise product — and fits them jointly in one REML model on unrelated
            participants.
          </P>
          <P>
            <b>Reading it.</b> R² is scored on held-out folds, so a component that fits only noise
            lands at or below zero. The 13 exposure categories each come from their own fit, so
            they do not sum to the exposome component. GREML was fitted once, so the covariate
            specifications apply to the predictive decomposition only.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/main">Main results</Link> and{' '}
            <Link to="/results/summary">Lifestyle categories</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 2" name="Exposure–protein association">
          <P>
            The effect of each exposure on each protein, and whether genotype modifies it.
          </P>
          <P>
            One linear model per protein, in an 80/20 train–test split:{' '}
            <Mono>P ~ covariates + G_cis + G_trans + E + G_cis:E + G_trans:E</Mono>. Significance
            comes from a nested-model F-test that drops the relevant block of terms — the exposure
            block for the main effect, the two interaction terms jointly for G×E — under a
            Bonferroni correction across exposures and proteins. An association counts as
            replicated when it clears the threshold in both splits with the same sign;{' '}
            {n('nExposuresAssoc')} exposures and {n('nProteinsAssoc')} proteins carry at least one.
          </P>
          <Alert severity="info" sx={{ my: 1.5 }}>
            <b>Two counts.</b> The headline of {n('nReplAssoc')} counts{' '}
            <b>exposure × protein pairs</b>, from the block F-test. The tables and plots are{' '}
            <b>per model term</b>, so a categorical exposure contributes one row per level and the
            two numbers do not match.
          </Alert>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/associations">Associations</Link>; G×E on{' '}
            <Link to="/results/architecture">Genetic and exposomic architecture</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 3" name="Observational mediation (GEM)">
          <P>
            How much of an exposure&apos;s or a genotype&apos;s association with disease runs
            through a protein.
          </P>
          <P>
            Two models per link: a mediator model,{' '}
            <Mono>P ~ PGS + PXS + covariates</Mono> (linear), and an outcome model,{' '}
            <Mono>D ~ P + PGS + PXS + covariates</Mono> (Cox). G-computation over the two gives the
            indirect effects — genetic → protein → disease and exposure → protein → disease — with
            their matching direct effects. Diseases need at least 100 incident cases.
          </P>
          <P>
            <b>Reading it.</b> Pleiotropy is the number of diseases a protein mediates through its
            dominant exposure category: at most 3 is disease-specific, at least 20 a pleiotropic
            shared reporter. No principled cut on the proportion mediated separates a reporter from
            an intermediate.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/mediation">Disease links</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 4" name="Mendelian randomization and colocalization">
          <P>
            Whether a protein moves disease risk, merely records it, or neither.
          </P>
          <P>
            Two-sample MR over every exposure–protein–disease triad, testing all six directed
            edges. The estimator follows the instrument count: a Wald ratio for one,
            inverse-variance weighting for two, and IVW with MR-Egger, the weighted median and the
            weighted mode for three or more. A fixed sequence of checks follows — Cochran&apos;s Q
            for heterogeneity, the MR-Egger intercept for directional pleiotropy, Steiger for
            causal direction, MR-PRESSO for outliers — with BH correction within each edge type.
            Protein instruments come from two pQTL panels, UK Biobank Olink and deCODE SomaScan.
          </P>
          <P>
            <b>Reading it.</b> An edge climbs from significance, through instrument robustness, to
            an established direction, and for cis instruments a colocalization test at
            PP.H4 ≥ 0.8; {n('nColoc')} loci clear it. Exposures mapping few or no genome-wide loci,
            including much of the deprivation and pollution set, cannot be instrumented at all.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Every rung is defined on <Link to="/documentation/evidence-tiers">Evidence tiers</Link>;
            results on <Link to="/results/causal">Causal evidence</Link> and{' '}
            <Link to="/results/gwas">Exposure GWAS</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 5" name="Interventional comparison">
          <P>
            Whether a trial moves the same proteins the exposure tracks observationally.
          </P>
          <P>
            UK Biobank exposure–protein effect sizes are correlated against measured proteomic
            change in three interventional cohorts: HERITAGE, 20 weeks of endurance training
            (~250 proteins shared with the Olink panel), and STEP 1 and STEP 2, 68-week
            semaglutide trials (~2,500 shared). Pearson correlations, BH-corrected within each
            intervention.
          </P>
          <P>
            <b>Reading it.</b> A between-person association and a within-person change under
            treatment are different quantities, and both trials published significance-selected
            proteins — HERITAGE at q ≤ 0.01, the GLP-1 effects at each trial&apos;s own q &lt; 0.05.
            The correlations are an upper bound, bounded further by the Olink–SomaScan agreement
            for the shared proteins.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/intervention">Intervention</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 6" name="Proteome-based exposure scores (PES)">
          <P>
            A proteomic score trained to read each exposure, then tested on what else it can do.
          </P>
          <P>
            Lasso regression on the full panel, one score per exposure, under 5-fold nested
            cross-validation: the outer loop produces out-of-fold predictions, the inner loop tunes
            the penalty. Those out-of-fold predictions become each participant&apos;s score, so a
            score is never fitted on the person it is later used to describe. A final model refit
            on the whole training cohort is applied to participants held out for a repeat visit.
          </P>
          <P>
            <b>Reading it.</b> Exposure prediction is AUC and AUPR for binary exposures and R² for
            continuous ones. Tracking is the correlation between a person&apos;s change in
            self-reported exposure and their change in score across visits. Disease prediction is
            the C-index on bootstrapped held-out data — the apparent change computed in the
            training sample is biased toward zero.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/pes">Exposure scores</Link>.
          </Typography>
        </ModuleCard>
      </Section>

      <Section
        title="Supporting analyses"
        subtitle="Un-numbered in the manuscript. They support the modules above."
      >
        <SimpleTable
          head={['Analysis', 'What it does', 'Where']}
          rows={[
            [
              'Tissue and pathway enrichment',
              'Gene-set enrichment of the association results against GTEx tissue signatures and Reactome pathways, per exposure and per variance component.',
              <Link to="/results/enrichment">Tissues and pathways</Link>,
            ],
            [
              'Exposure GWAS',
              'Genome-wide association for each exposure, with instrument-strength diagnostics, LDSC heritability and intercepts, and genetic correlation between exposures. It determines which exposures can enter Mendelian randomization.',
              <Link to="/results/gwas">Exposure GWAS</Link>,
            ],
          ]}
        />
      </Section>

      <Section title="Covariate adjustment">
        <P>
          All main results use the <Mono>base</Mono> covariate set: age, age², sex, their
          interactions, assessment center and 20 genetic principal components. Three further
          specifications add one adjustment each — BMI, the blood-draw conditions, or a clinical
          block — and a fourth changes the sample instead, dropping participants who already had a
          major chronic disease.
        </P>
        <P>
          <Link to="/documentation/models">Specifications</Link> lists every set, its exact
          covariates, and which specifications are published.
        </P>
      </Section>

    </DocPage>
  );
}
