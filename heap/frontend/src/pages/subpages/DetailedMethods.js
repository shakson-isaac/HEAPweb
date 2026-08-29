import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Chip, Paper, Typography, Box } from '@mui/material';
import {
  DocPage, HeadlineFallback, Mono, P, Section, SimpleTable, SourceNote, macro, useHeadline,
} from '../Documentation';

// Structural description of each module: what it estimates, from what, and where
// the result surfaces. Interpretation of any result belongs to the manuscript and
// is not restated here (standing decision S13).
function ModuleCard({ number, name, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, maxWidth: 820 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={number} sx={{ backgroundColor: '#124533', color: '#fff', fontWeight: 700 }} />
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
      lead="How each result on this site was produced: the sample, the six analysis modules, and the two supporting analyses. This is a structural summary — the full methods are in the paper."
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
        <SourceNote>
          counts read live from <Mono>meta/headline.json.gz</Mono>; the disease threshold from the{' '}
          <Mono>disease_list</Mono> supplementary table.
        </SourceNote>
      </Section>

      <Section
        title="The six modules"
        subtitle="Module numbers are the manuscript's. The code directories use a different numbering on purpose, so a path such as module5_mr/ holds manuscript Module 4."
      >
        <ModuleCard number="Module 1" name="Variance decomposition">
          <P>
            For each protein, the variance in abundance is partitioned into what covariates,
            genetics, the exposome and gene-by-environment interaction each explain. Two
            estimators are run side by side: a predictive decomposition, where a polygenic score
            and a penalized poly-exposure score are fitted and scored out of fold, and GREML,
            which fits the genetic, exposomic and G×E kernels jointly in one multi-kernel model
            rather than one component at a time.
          </P>
          <P>
            Ridge and elastic-net variants of the penalized fit are deposited alongside the
            primary estimator, as is a coarse and a fine partition of the same components.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/main">Main results</Link> and{' '}
            <Link to="/results/summary">Lifestyle categories</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 2" name="Exposure–protein association">
          <P>
            Every exposure is regressed against every protein under the primary covariate set,
            separately in the training and test splits. An association counts as replicated when
            it clears the significance threshold in both splits with a consistent sign.
          </P>
          <Alert severity="info" sx={{ my: 1.5 }}>
            Two different counts exist and are not interconvertible. The headline of{' '}
            {n('nReplAssoc')} replicated associations counts <b>exposure × protein pairs</b>, tested
            with a block F-test over all terms belonging to that exposure. The association tables
            and plots are <b>per model term</b>, so a categorical exposure contributes one row per
            level. A term count will never sum to the pair count.
          </Alert>
          <P>
            {n('nExposuresAssoc')} exposures and {n('nProteinsAssoc')} proteins carry at least one
            replicated association. Gene-by-environment interaction terms are fitted in the same
            framework and reported separately, in the supplement.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/associations">Associations</Link>; G×E on{' '}
            <Link to="/results/architecture">Genetic and exposomic architecture</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 3" name="Observational mediation (GEM)">
          <P>
            G-computation over two fitted models — a mediator model,{' '}
            <Mono>protein ~ PGS + PXS + covariates</Mono>, and an outcome model,{' '}
            <Mono>disease ~ protein + PGS + PXS + covariates</Mono> — yields indirect effects
            (genetic → protein → disease and exposure → protein → disease) and the corresponding
            direct effects. GEM summarizes, per protein, how modifiable that protein is under
            lifestyle exposures across the analyzed diseases.
          </P>
          <Alert severity="info" sx={{ my: 1.5 }}>
            Observational mediation estimates are descriptive and may reflect confounding, reverse
            causation, or shared upstream causes. Causal support is evaluated separately using MR
            and colocalization.
          </Alert>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/mediation">Disease links</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 4" name="Mendelian randomization and colocalization">
          <P>
            Two-sample bidirectional MR over each exposure–protein–disease triad, testing all six
            directed edges: exposure → protein, protein → exposure, protein → disease, disease →
            protein, exposure → disease and disease → exposure. Exposure instruments come from
            GWAS in UK Biobank participants independent of the pQTL discovery sample; protein
            instruments come from two pQTL arms, UK Biobank Olink and deCODE SomaScan, which share
            one edge set so the two can be compared directly.
          </P>
          <P>
            Each surviving edge is graded on a stringency ladder that folds in instrument strength,
            Steiger orientation, heterogeneity, directional pleiotropy, MR-PRESSO correction and
            cross-platform replication. Colocalization is run for cis instruments and gated at
            PP.H4 ≥ 0.8; {n('nColoc')} loci clear it. Exposures that map few or no genome-wide
            loci — much of the deprivation and pollution set — cannot be instrumented at all, and
            that is reported rather than left as an empty cell.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Definitions of every rung are on <Link to="/documentation/evidence-tiers">Evidence tiers</Link>;
            results on <Link to="/results/causal">Causal evidence</Link> and{' '}
            <Link to="/results/gwas">Exposure GWAS</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 5" name="Interventional comparison">
          <P>
            Exposure–protein associations are correlated against measured proteomic change
            (post-intervention minus baseline) in three interventional cohorts: HERITAGE, a
            20-week endurance-training intervention, and STEP 1 and STEP 2, 68-week GLP-1 receptor
            agonist randomized controlled trials.
          </P>
          <P>
            The comparison is restricted to proteins measured on both platforms and carries the
            Olink-to-SomaScan agreement for that protein set in the interface itself, because
            cross-platform concordance bounds what the comparison can show.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/intervention">Intervention</Link>.
          </Typography>
        </ModuleCard>

        <ModuleCard number="Module 6" name="Proteome-based exposure scores (PES)">
          <P>
            A penalized proteomic score is trained per exposure on the baseline sample and
            evaluated on participants held out for a repeat visit. Three things are reported for
            each score: how well it reads the exposure (R², AUC, AUPR), how it tracks within the
            same person across visits, and what it adds to a disease model on top of standard
            predictors.
          </P>
          <P>
            Incremental disease prediction is reported from held-out or bootstrapped estimates,
            because the apparent change in C-index computed in the training sample is biased
            toward zero and is not a usable estimate.
          </P>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Surfaces on <Link to="/results/pes">Exposure scores</Link>.
          </Typography>
        </ModuleCard>
      </Section>

      <Section
        title="Supporting analyses"
        subtitle="Un-numbered in the manuscript; they support the modules above rather than standing alone."
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
              'Genome-wide association for each exposure, with instrument-strength diagnostics, LDSC heritability and intercepts, and genetic correlation between exposures. This is what determines which exposures can enter Mendelian randomization.',
              <Link to="/results/gwas">Exposure GWAS</Link>,
            ],
          ]}
        />
      </Section>

      <Section title="Covariate adjustment">
        <P>
          All main results use the <Mono>base</Mono> covariate set: age, age², sex, their
          interactions, assessment centre and 20 genetic principal components. Five supplementary
          sets add one potentially mediating or optional adjustment each, and results are deposited
          under all of them.
        </P>
        <Alert severity="warning" sx={{ maxWidth: 820, mb: 1.5 }}>
          Earlier versions of this site displayed the maximally adjusted model by default and
          labeled the sets Type1–Type7. Both are retired: the primary model is now{' '}
          <Mono>base</Mono>, and adjustment for BMI is a sensitivity layer that cannot be read as
          a mediation test.
        </Alert>
        <P>
          Every set, its exact covariates, the migration from the old naming, and which
          specifications are actually published are on{' '}
          <Link to="/documentation/models">Specifications</Link>.
        </P>
      </Section>

      <Section title="Reading the results">
        <SimpleTable
          head={['If you want', 'Go to']}
          rows={[
            ['What a badge on a relationship means', <Link to="/documentation/evidence-tiers">Evidence tiers</Link>],
            ['The exact covariates behind an estimate', <Link to="/documentation/models">Specifications</Link>],
            ['What an exposure id refers to', <Link to="/documentation/dictionary">Exposome dictionary</Link>],
            ['The underlying tables, without a browser', <Link to="/documentation/api">Data API</Link>],
            ['The full methods', <a href="https://doi.org/10.1101/2025.05.07.25327178" target="_blank" rel="noopener noreferrer">the preprint</a>],
          ]}
        />
      </Section>
    </DocPage>
  );
}
