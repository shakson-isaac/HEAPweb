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
            We partitioned protein abundance variance into genetic (G), environmental (E) and
            gene-by-environment (G×E) components, and separately partitioned each protein&apos;s
            held-out predictive R² into those components plus covariates (C).
          </P>
          <P>
            For the GREML partition we represented each component as a similarity kernel across
            individuals. The genetic kernel was a genetic relatedness matrix built from LD-pruned,
            genotyped SNPs. The environmental kernel was built from the {n('nExposures')} exposures,
            with continuous exposures centered and scaled and ordinal exposures one-hot encoded.
            The gene-by-environment kernel was the element-wise product of the two. We fitted the
            three kernels jointly in a single REML model. To restrict inference to unrelated
            participants we retained a maximal set with no pairwise relatedness above 0.025.
          </P>
          <P>
            For the predictive partition we used a leave-one-out drop-decomposition on the learned
            scores. Each component&apos;s unique contribution was the reduction in held-out R² when
            its score was removed from the full model, averaged over the outer folds. We recomputed
            exposure scores to predefined categories and applied the same drop procedure to obtain
            each category&apos;s unique R².
          </P>
          <P>
            <b>Reading it.</b> We scored R² on held-out folds, so a component that fits only noise
            falls at or below zero. Each category came from its own fit, so the 13 category values
            do not sum to the exposome component. We fitted GREML once, so the covariate
            specifications apply to the predictive decomposition.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/main">Main results</Link> and{' '}
            <Link to="/results/summary">Lifestyle categories</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 2" name="Exposure–protein association">
          <P>
            We assessed the effects of individual exposures through univariate E and polygenic G×E
            association tests, to obtain the effect size and significance of each exposure.
          </P>
          <P>
            We constructed univariate associations under an 80/20 train-test split, using a linear
            model for each protein:{' '}
            <Mono>P ~ C + G_cis + G_trans + E_i + G_cis:E_i + G_trans:E_i</Mono>. We report the
            standardized betas for <Mono>E_i</Mono>, the effect of an exposure on a protein, and
            for <Mono>G_cis:E_i</Mono> and <Mono>G_trans:E_i</Mono>, the G×E interaction effect. We
            computed their p-values with a nested-model F-test, comparing the full model against
            one with the relevant term block removed. We applied a Bonferroni correction based on
            the number of exposomic features and proteins tested. We declared an effect validated
            if we found a significant association in both the train and test sets.{' '}
            {n('nExposuresAssoc')} exposures and {n('nProteinsAssoc')} proteins carry at least one.
          </P>
          <Alert severity="info" sx={{ my: 1.5 }}>
            <b>Two counts.</b> The headline of {n('nReplAssoc')} counts{' '}
            <b>exposure × protein pairs</b>, from the block F-test. The tables and plots are{' '}
            <b>per model term</b>, so a categorical exposure contributes one row per level. The two
            numbers differ for that reason.
          </Alert>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/associations">Associations</Link>; G×E on{' '}
            <Link to="/results/architecture">Genetic and exposomic architecture</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 3" name="Observational mediation (GEM)">
          <P>
            We quantified the extent to which proteins mediate the relationships between exposure,
            genetics and disease. Indirect effects are those that occur through the protein. Direct
            effects link exposures or genetics to the disease outcome independently of it.
          </P>
          <P>
            We used the polygenic score (PGS) and the constructed polyexposure score (PXS) to
            capture total genetic and exposomic effects. Mediation involved two regression models.
            The mediator model was a linear regression,{' '}
            <Mono>P ~ PGS + PXS + C</Mono>, regressing the protein onto those predictors and
            covariates. The outcome model was a Cox proportional-hazards regression,{' '}
            <Mono>D ~ P + PGS + PXS + C</Mono>, capturing the time-varying disease outcome. We used
            G-computation over the two to estimate the indirect and direct effects. We analyzed only
            diseases with at least 100 incident cases.
          </P>
          <P>
            <b>Reading it.</b> Mediation analysis assumes no unmeasured confounding, which can
            distort the effects captured, so we refitted the models under several covariate
            specifications. Pleiotropy counts the diseases a protein mediates through its dominant
            exposure category, where at most 3 is disease-specific and at least 20 a pleiotropic
            shared reporter. No principled cut on the proportion mediated separates a reporter from
            an intermediate.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/mediation">Disease links</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 4" name="Mendelian randomization and colocalization">
          <P>
            We used Mendelian randomization to test causal relationships among the
            exposure–protein–disease triads found through mediation and exposomic association.
          </P>
          <P>
            We used genetic variants as instruments to estimate the directed edges exposure to
            protein, protein to disease and exposure to disease, along with testing reverse
            causation through protein to exposure, disease to protein and disease to exposure. We
            estimated every edge in two arms: a split-sample UK Biobank arm, in which the exposure
            instruments and the Olink pQTLs are drawn from non-overlapping participants, and an
            external replication arm using deCODE SomaScan pQTLs. We selected the estimator by the
            number of available instruments, using a Wald ratio for one, inverse-variance weighting
            for two, and IVW with MR-Egger, the weighted median and the weighted mode for three or
            more. We then applied a fixed sequence of sensitivity checks: Cochran&apos;s Q for
            heterogeneity, the MR-Egger intercept for directional pleiotropy, Steiger filtering for
            causal direction, and MR-PRESSO for outlier detection and correction. We corrected by
            Benjamini-Hochberg FDR within each edge type.
          </P>
          <P>
            <b>Reading it.</b> An edge advances from significance, through instrument robustness, to
            a confirmed causal direction, and for cis-pQTL edges a colocalization test. Exposures
            that map few or no genome-wide loci cannot be instrumented, including much of the
            deprivation and pollution set.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Every rung is defined on <Link to="/documentation/evidence-tiers">Evidence tiers</Link>;
            results on <Link to="/results/causal">Causal evidence</Link> and{' '}
            <Link to="/results/gwas">Exposure GWAS</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 5" name="Interventional comparison">
          <P>
            We compared the effect sizes of exposure–protein associations with circulating
            proteomics from intervention studies.
          </P>
          <P>
            We used the HERITAGE endurance-training intervention and the STEP 1 and STEP 2 GLP-1
            receptor agonist randomized controlled trials. For HERITAGE we used the reported log
            fold change between pre- and post-training proteomic signatures. For STEP 1 and STEP 2
            we used the summary statistics of the serum protein longitudinal effects. We correlated
            the exposure–protein effect sizes found in UK Biobank to the effects observed in each
            intervention, calculating Pearson correlations and FDR-adjusted p-values for each
            intervention separately, weighted by the reported SomaScan and Olink concordance for
            each protein. We then integrated MR evidence at Tier 1 and above, to assess which
            proteins were putatively causal for type 2 diabetes and its comorbidities: obesity,
            lipoprotein dysfunction and hypertension.
          </P>
          <P>
            <b>Reading it.</b> Approximately 250 plasma proteins could be cross-referenced between
            the HERITAGE SomaScan and UK Biobank Olink platforms, and approximately 2,500 between
            STEP 1/2 and UK Biobank. Both trials reported only the proteins reaching significance.
            The UK Biobank estimate is a between-person association while the trial estimate is a
            within-person change under treatment. The correlations are therefore an upper bound on
            concordance.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/intervention">Intervention</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 6" name="Proteome-based exposure scores (PES)">
          <P>
            We built proteome-based exposure scores that predict an individual&apos;s exposures from
            their proteome, and evaluated their ability to predict exposures that changed
            longitudinally and their prognostic value for incident disease.
          </P>
          <P>
            We used the full set of approximately 2,900 proteins to predict each exposure by lasso
            regression, with median imputation from the training samples in each fold. For model
            selection we used 5-fold nested cross-validation, where the outer loop produces
            out-of-fold predictions and the inner loop tunes the lambda penalty. The out-of-fold
            predictions constructed the per-participant score, preventing overfitting when the score
            is used downstream for disease prediction. We trained on participants with
            baseline-only measurements and held out those with repeated proteomic measurements, so
            the test set is never introduced during training.
          </P>
          <P>
            <b>Reading it.</b> We reported AUC and AUPR for binary exposures and R² for continuous
            exposures, on the held-out test set at each visit. For temporal tracking we computed the
            change in correlation between the within-person change in the self-reported exposure
            and the change in the predicted score. We summarized disease prediction by the
            concordance index on the bootstrapped held-out test set, because the apparent change
            computed in the training sample is biased toward zero.
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
          specifications add one adjustment each: BMI, the blood-draw conditions, or a clinical
          block. A fourth changes the sample instead, dropping participants who already had a major
          chronic disease.
        </P>
        <P>
          <Link to="/documentation/models">Specifications</Link> lists every set, its exact
          covariates, and which specifications are published.
        </P>
      </Section>

    </DocPage>
  );
}
