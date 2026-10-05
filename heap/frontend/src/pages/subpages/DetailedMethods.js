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
            We asked how much of each protein&apos;s variation covariates, genetics, the exposome
            and gene-by-environment interaction explain.
          </P>
          <P>
            We ran two estimators side by side. For the predictive decomposition we fitted a
            polygenic score and a penalized poly-exposure score, and scored them out of fold. We
            then took each component&apos;s share as the fall in held-out R² when we dropped its
            score from the full model. For GREML we built three similarity kernels across
            participants: genetic relatedness, exposures, and their element-wise product. We fitted
            the three jointly in one REML model, among unrelated participants only.
          </P>
          <P>
            <b>Reading it.</b> We score R² on held-out folds, so a component that fits only noise
            lands at or below zero. We recomputed each of the 13 exposure categories from its own
            fit, so they do not sum to the exposome component. We fitted GREML once, so the
            covariate specifications apply to the predictive decomposition alone.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/main">Main results</Link> and{' '}
            <Link to="/results/summary">Lifestyle categories</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 2" name="Exposure–protein association">
          <P>
            We estimated the effect of each exposure on each protein, and asked whether genotype
            modifies it.
          </P>
          <P>
            We fitted one linear model per protein in an 80/20 train and test split:{' '}
            <Mono>P ~ covariates + G_cis + G_trans + E + G_cis:E + G_trans:E</Mono>. We computed
            each p-value with a nested-model F-test, dropping the relevant block of terms. The
            exposure block gives the main effect. The two interaction terms, tested jointly, give
            the G×E effect. We corrected by Bonferroni across the exposures and proteins tested. We
            counted an association as replicated when it cleared the threshold in both splits with
            the same sign. {n('nExposuresAssoc')} exposures and {n('nProteinsAssoc')} proteins carry
            at least one.
          </P>
          <Alert severity="info" sx={{ my: 1.5 }}>
            <b>Two counts.</b> The headline of {n('nReplAssoc')} counts{' '}
            <b>exposure × protein pairs</b>, from the block F-test. The tables and plots are{' '}
            <b>per model term</b>, so a categorical exposure contributes one row per level. The two
            numbers do not match.
          </Alert>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/associations">Associations</Link>; G×E on{' '}
            <Link to="/results/architecture">Genetic and exposomic architecture</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 3" name="Observational mediation (GEM)">
          <P>
            We quantified how much of an exposure&apos;s or a genotype&apos;s association with
            disease runs through a protein.
          </P>
          <P>
            We fitted two models per link. The mediator model is a linear regression,{' '}
            <Mono>P ~ PGS + PXS + covariates</Mono>. The outcome model is a Cox regression,{' '}
            <Mono>D ~ P + PGS + PXS + covariates</Mono>. We used G-computation over the two to
            obtain the indirect effects, genetic to protein to disease and exposure to protein to
            disease, with their matching direct effects. We analyzed only diseases with at least
            100 incident cases.
          </P>
          <P>
            <b>Reading it.</b> We define pleiotropy as the number of diseases a protein mediates
            through its dominant exposure category. At most 3 is disease-specific. At least 20 is a
            pleiotropic shared reporter. No principled cut on the proportion mediated separates a
            reporter from an intermediate.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/mediation">Disease links</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 4" name="Mendelian randomization and colocalization">
          <P>
            We asked whether a protein moves disease risk, merely records it, or neither.
          </P>
          <P>
            We ran two-sample MR over every exposure, protein and disease triad, testing all six
            directed edges. We chose the estimator by instrument count: a Wald ratio for one, 
            inverse-variance weighting for two, and IVW with MR-Egger, the weighted median and the
            weighted mode for three or more. We then applied a fixed sequence of checks.
            Cochran&apos;s Q tests heterogeneity. The MR-Egger intercept tests directional
            pleiotropy. Steiger filtering resolves causal direction. MR-PRESSO detects and corrects
            outliers. We corrected by Benjamini-Hochberg within each edge type. We drew protein
            instruments from two pQTL panels, UK Biobank Olink and deCODE SomaScan.
          </P>
          <P>
            <b>Reading it.</b> An edge climbs from significance, through instrument robustness, to
            an established direction. For cis instruments we added a colocalization test at
            PP.H4 ≥ 0.8. Exposures that map few or no genome-wide loci cannot be instrumented at
            all, including much of the deprivation and pollution set.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Every rung is defined on <Link to="/documentation/evidence-tiers">Evidence tiers</Link>;
            results on <Link to="/results/causal">Causal evidence</Link> and{' '}
            <Link to="/results/gwas">Exposure GWAS</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 5" name="Interventional comparison">
          <P>
            We asked whether the proteins that track an exposure actually move when a trial changes
            that exposure.
          </P>
          <P>
            We compared each exposure&apos;s whole protein signature against the protein shifts a
            trial measured. HERITAGE reports log fold change across 20 weeks of endurance training.
            STEP 1 and STEP 2 report protein change across 68 weeks of semaglutide. UK Biobank
            measures on Olink and the trials on SomaScan, so we weighted every protein by the
            reported agreement between the two platforms. We computed a Pearson correlation for
            each exposure and trial, and corrected them by Benjamini-Hochberg. We then overlaid
            Tier-1 MR and colocalization evidence, to see which of the shared proteins are
            putatively causal for type 2 diabetes, obesity, lipoprotein disorders and hypertension.
          </P>
          <P>
            <b>Reading it.</b> The sign is the result. Strenuous sports moves proteins in the same
            direction semaglutide does, while processed meat moves them the opposite way. Platform
            overlap limits what can be compared at all, about 250 proteins for HERITAGE and 2,500
            for STEP. Both trials published only the proteins that reached significance, and a
            between-person association is not a within-person change under treatment. Treat the
            correlation as an upper bound.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/intervention">Intervention</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 6" name="Proteome-based exposure scores (PES)">
          <P>
            We trained a proteomic score to read each exposure, then tested what else it can do.
          </P>
          <P>
            We fitted a lasso regression on the full protein panel, one score per exposure, under
            5-fold nested cross-validation. The outer loop produces out-of-fold predictions and the
            inner loop tunes the penalty. We used those out-of-fold predictions as each
            participant&apos;s score, so no score is fitted on the person it later describes. We
            refitted a final model on the whole training cohort and applied it to participants held
            out for a repeat visit.
          </P>
          <P>
            <b>Reading it.</b> We report AUC and AUPR for binary exposures and R² for continuous
            ones. For tracking we report the correlation between a person&apos;s change in
            self-reported exposure and their change in score across visits. For disease prediction
            we report the C-index on bootstrapped held-out data, because the apparent change
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
