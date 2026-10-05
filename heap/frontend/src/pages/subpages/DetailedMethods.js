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
            For each protein, variance in abundance was partitioned into the shares explained by
            covariates, genetics, the exposome and gene-by-environment interaction. Two estimators
            were run side by side: a predictive decomposition, fitting a polygenic score and a
            penalized poly-exposure score scored out of fold; and GREML, fitting the genetic,
            exposomic and G×E kernels jointly in one multi-kernel model.
          </P>
          <P>
            Each component&apos;s share is its unique contribution, so the four are disjoint, and R²
            scored on held-out folds places a component that fits only noise at or below zero. An
            exposure category&apos;s contribution is its leave-one-category-out predictive R², taken
            from its own fit, so the 13 category values do not sum to the exposome component.
          </P>
          <P>
            GREML was fitted once, at a GRM cutoff of 0.025, so the covariate specifications apply
            to the predictive decomposition only. The two estimators differ on the absolute number
            of exposure-responsive proteins, as two estimators of the same component will; the
            comparison rests on their selecting overlapping proteins.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/main">Main results</Link> and{' '}
            <Link to="/results/summary">Lifestyle categories</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 2" name="Exposure–protein association">
          <P>
            Every exposure was regressed against every protein under the primary covariate set,
            separately in the training and test splits. An association counts as replicated when it
            clears the significance threshold in both splits with a consistent sign;{' '}
            {n('nExposuresAssoc')} exposures and {n('nProteinsAssoc')} proteins carry at least one.
          </P>
          <Alert severity="info" sx={{ my: 1.5 }}>
            The headline of {n('nReplAssoc')} replicated associations counts{' '}
            <b>exposure × protein pairs</b>, from a block F-test over every term belonging to that
            exposure. The tables and plots are <b>per model term</b>, so a categorical exposure
            contributes one row per level and the two counts do not match.
          </Alert>
          <P>
            Polygenic G×E was tested per exposure–protein pair with a joint F-test over the cis and
            trans genetic blocks, under a Bonferroni threshold across all pairs in one split. A
            replicated pair clears that threshold in the training split and again in held-out data,
            so replicated counts are much smaller.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/associations">Associations</Link>; G×E on{' '}
            <Link to="/results/architecture">Genetic and exposomic architecture</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 3" name="Observational mediation (GEM)">
          <P>
            Two models were fitted per link: a mediator model,{' '}
            <Mono>protein ~ PGS + PXS + covariates</Mono>, and an outcome model,{' '}
            <Mono>disease ~ protein + PGS + PXS + covariates</Mono>. G-computation over the two
            gives the indirect effects, genetic → protein → disease and exposure → protein →
            disease, with their matching direct effects.
          </P>
          <P>
            Pleiotropy is the number of diseases a protein mediates through its dominant exposure
            category: at most 3 is disease-specific, at least 20 a pleiotropic shared reporter. No
            principled cut on the proportion mediated separates a reporter from an intermediate.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/mediation">Disease links</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 4" name="Mendelian randomization and colocalization">
          <P>
            Two-sample bidirectional MR was run over each exposure–protein–disease triad, testing
            all six directed edges: exposure → protein, protein → exposure, protein → disease,
            disease → protein, exposure → disease and disease → exposure. Exposure instruments came
            from GWAS in UK Biobank participants independent of the pQTL discovery sample; protein
            instruments came from two pQTL arms, UK Biobank Olink and deCODE SomaScan, which share
            one edge set so the two can be compared directly.
          </P>
          <P>
            Each surviving edge was graded on a stringency ladder folding in instrument strength,
            Steiger orientation, heterogeneity, directional pleiotropy, MR-PRESSO correction and
            cross-platform replication. Colocalization was run for cis instruments and gated at
            PP.H4 ≥ 0.8; {n('nColoc')} loci clear it. Exposures mapping few or no genome-wide loci,
            including much of the deprivation and pollution set, cannot be instrumented, and are
            reported as such.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Definitions of every rung are on <Link to="/documentation/evidence-tiers">Evidence tiers</Link>;
            results on <Link to="/results/causal">Causal evidence</Link> and{' '}
            <Link to="/results/gwas">Exposure GWAS</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 5" name="Interventional comparison">
          <P>
            Exposure–protein associations were correlated against measured proteomic change
            (post-intervention minus baseline) in three interventional cohorts: HERITAGE, a 20-week
            endurance-training intervention, and STEP 1 and STEP 2, 68-week GLP-1 receptor agonist
            randomized controlled trials. The comparison is restricted to proteins measured on both
            platforms, and the interface carries the Olink-to-SomaScan agreement for that set.
          </P>
          <P>
            A between-person association and a within-person change under treatment are different
            quantities, and both trials published significance-selected proteins &mdash; HERITAGE at
            q &le; 0.01, the GLP-1 effects at each trial&apos;s own q &lt; 0.05. The correlations are
            an upper bound on concordance.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/intervention">Intervention</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 6" name="Proteome-based exposure scores (PES)">
          <P>
            A penalized proteomic score was trained per exposure on the baseline sample and
            evaluated on participants held out for a repeat visit. Three quantities are reported
            for each score: how well it reads the exposure (R², AUC, AUPR), how it tracks within
            the same person across visits, and what it adds to a disease model on top of standard
            predictors.
          </P>
          <P>
            Incremental disease prediction is reported from held-out or bootstrapped estimates,
            because the apparent change in C-index computed in the training sample is biased toward
            zero.
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
          interactions, assessment center and 20 genetic principal components. Five supplementary
          sets add one adjustment each, and results are deposited under all of them.
        </P>
        <P>
          <Link to="/documentation/models">Specifications</Link> lists every set, its exact
          covariates, and which specifications are published.
        </P>
      </Section>

    </DocPage>
  );
}
