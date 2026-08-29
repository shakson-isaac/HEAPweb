import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import {
  AuthorNote, Code, DocPage, HeadlineFallback, Mono, P, Section, SimpleTable, SourceNote,
  macro, useHeadline,
} from '../Documentation';

// Structural description of the resource only (standing decision S13). The
// central scientific claim is quoted from the manuscript rather than restated,
// and the site's own framing copy is left to the author.
export default function AboutHeap() {
  const { data: h, error } = useHeadline();
  const n = (k) => macro(h, k);

  return (
    <DocPage
      title="About HEAP"
      lead="HEAP (Human Exposomic Architecture of the Proteome) measures how modifiable lifestyle and environmental exposures are reflected in the human plasma proteome, how those proteomic signatures relate to incident disease, and which of those relationships carry genetic or interventional support."
    >
      <AuthorNote what="Landing framing — one paragraph, yours to write.">
        This page opens with a structural description. The reframe that the revised manuscript
        turns on (proteins as a record of exposure; a minority of causal intermediates against a
        majority of reporters) is an interpretation of the results, so it is quoted below from
        the manuscript rather than paraphrased here.
      </AuthorNote>

      <Section title="The claim, in the manuscript's own words">
        <Paper variant="outlined" sx={{ p: 2, mb: 1, maxWidth: 820, borderLeft: '4px solid #124533' }}>
          <Typography variant="body1" sx={{ fontStyle: 'italic', lineHeight: 1.65 }}>
            Only a minority of exposure-responsive proteins were consistent with causal
            intermediates, whereas many appeared to function as biological reporters of exposure
            burden, disease liability, and early disease processes.
          </Typography>
        </Paper>
        <SourceNote>
          the revised manuscript, quoted in <Mono>docs/WEBSITE_PLAN.md</Mono> §1. Everything on
          this site is organized so that this distinction is visible on each individual
          relationship rather than asserted once — see <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.
        </SourceNote>
      </Section>

      <Section
        title="What is in it"
        subtitle="Read live from the published payload, which is generated from the manuscript's LaTeX macros. No number on this page is typed by hand."
      >
        <HeadlineFallback error={error} />
        <SimpleTable
          head={['Quantity', 'Value', 'What it counts']}
          rows={[
            ['Participants', n('nParticipants'), 'UK Biobank participants with a baseline plasma proteomic draw'],
            ['Proteins', n('nProteins'), 'proteins in the analyzed Olink panel (variance decomposition)'],
            ['Exposures', n('nExposures'), 'exposomic features, across 13 categories'],
            ['Replicated associations', n('nReplAssoc'), 'exposure × protein associations holding in both the train and the test split'],
            ['Exposures with a hit', n('nExposuresAssoc'), 'exposures with at least one replicated association'],
            ['Proteins with a hit', n('nProteinsAssoc'), 'proteins with at least one replicated association'],
            ['Incident diseases', n('nDiseasesGEM'), 'first-occurrence disease outcomes with enough cases to model'],
            ['Exposure scores (PES)', n('nExposuresPES'), 'proteome-based exposure scores'],
            ['Colocalized loci', n('nColoc'), 'cis-pQTL loci passing the PP.H4 ≥ 0.8 colocalization gate'],
            ['Tier-1 mediator triads', `${n('nMotifTierOne')} (${n('nMotifTierOneProt')} proteins)`, 'exposure → protein → disease triads meeting the Tier-1 mediator motif'],
          ]}
        />
        <SourceNote>
          <Mono>meta/headline.json.gz</Mono>, built from <Mono>HEAP_manuscript/macros/numbers.tex</Mono>.
        </SourceNote>
      </Section>

      <Section title="Two pairs that are easy to conflate">
        <SimpleTable
          head={['Do not confuse', 'with', 'because']}
          rows={[
            [
              <span>{n('nProteins')} proteins</span>,
              <span>{n('nProteinsPES')} proteins</span>,
              'the first is the analyzed panel used for the variance decomposition; the second is the longitudinal panel behind the exposure scores. They are different panels, not a corrected count.',
            ],
            [
              <span>{n('nMotifTierOne')} mediator triads</span>,
              <span>{n('nMotifTriads')} mediator triads</span>,
              'the first is the Tier-1 bar and is the headline; the second is the nominal-significance bar. The two sets are not nested, so the nominal count must never be shown as the headline.',
            ],
          ]}
        />
        <SourceNote>
          <Mono>WEBSITE_PLAN.md</Mono> §3 and §13/G1; motif bars read from{' '}
          <Mono>S_mr_triads</Mono> / <Mono>S_mr_motifs</Mono>.
        </SourceNote>
      </Section>

      <Section title="How the analysis is organized">
        <P>
          Six analysis modules feed the site. Each is described, with its inputs and outputs, in{' '}
          <Link to="/documentation/methods">Detailed methods</Link>; the covariate adjustment
          shared by all of them is on <Link to="/documentation/models">Specifications</Link>.
        </P>
        <SimpleTable
          head={['Module', 'Produces', 'Where it surfaces']}
          rows={[
            ['1 · Variance decomposition', 'per-protein R² split into covariate, genetic, exposomic and G×E components', <Link to="/results/main">Main results</Link>],
            ['2 · Exposure–protein association', 'coefficients for every exposure × protein pair, in a train/test design', <Link to="/results/associations">Associations</Link>],
            ['3 · Mediation (GEM)', 'observational exposure → protein → disease decomposition, descriptive', <Link to="/results/mediation">Disease links</Link>],
            ['4 · Mendelian randomization', 'six directed edges per triad, graded on the evidence ladder, plus colocalization', <Link to="/results/causal">Causal evidence</Link>],
            ['5 · Interventional comparison', 'concordance with HERITAGE, STEP 1 and STEP 2 proteomic responses', <Link to="/results/intervention">Intervention</Link>],
            ['6 · Exposure scores (PES)', 'proteome-based scores per exposure, with tracking and disease prediction', <Link to="/results/pes">Exposure scores</Link>],
            ['Supporting · Enrichment', 'tissue and pathway enrichment of the association results', <Link to="/results/enrichment">Tissues and pathways</Link>],
            ['Supporting · Exposure GWAS', 'instrument diagnostics, LDSC heritability and genetic correlation', <Link to="/results/gwas">Exposure GWAS</Link>],
          ]}
        />
        <SourceNote>
          module numbering follows the manuscript, not the code directories, per{' '}
          <Mono>HEAP/docs/MODULE_NUMBERING.md</Mono>. Manuscript Module 4 (MR) lives in code
          under <Mono>module5_mr/</Mono>, and manuscript Module 5 (interventions) under the code
          <Mono>module4</Mono> namespace.
        </SourceNote>
      </Section>

      <Section title="Rules this resource follows">
        <SimpleTable
          head={['Rule', 'What it means here']}
          rows={[
            ['No generic "significant" badge', <span>Every relationship carries an explicit evidence level, and association is kept visually separate from causal support. See <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.</span>],
            ['One primary specification', <span>All main results use the <Mono>base</Mono> covariate set; the other five are sensitivity layers behind a switcher. See <Link to="/documentation/models">Specifications</Link>.</span>],
            ['+ BMI is not a mediation test', 'Attenuation after adjusting for BMI cannot distinguish mediation from confounding, so the BMI specification is labeled a sensitivity layer everywhere it appears.'],
            ['Mediation is descriptive', <span>Observational mediation is reported as descriptive; causal adjudication is kept separate, in <Link to="/results/causal">Mendelian randomization and colocalization</Link>.</span>],
            ['"Not tested" is not "not significant"', 'Empty states say which of the two they are.'],
            ['Nothing hand-typed', 'Every rendered number traces to a manuscript macro, a registry row or a payload file.'],
            ['Nothing unpublished', 'A result appears here only if it is in the manuscript or its supplement.'],
          ]}
        />
        <SourceNote><Mono>docs/TASKS.md</Mono> standing decisions S1–S13 and <Mono>WEBSITE_PLAN.md</Mono> §16.</SourceNote>
      </Section>

      <Section title="Getting the data">
        <P>
          Everything the pages draw is served as static, gzipped JSON from a public bucket with
          no authentication and no rate limit. One line pulls a whole result:
        </P>
        <Code label="R">
{`jsonlite::fromJSON(
  "https://storage.googleapis.com/heap-data/web/v1/e/protein/ASGR1.json.gz"
)`}
        </Code>
        <P>
          The full URL scheme, with tested R and Python examples, is on{' '}
          <Link to="/documentation/api">Data API</Link>.
        </P>
      </Section>

      <AuthorNote what="Published exposure-score count needs a decision.">
        The manuscript macro reports {n('nExposuresPES')} proteome-based exposure scores; the
        score bundle on disk contains {n('nPESpanels')} panels. Both are shown above as they
        stand. Reconciling them changes a published number, which is an author decision
        (gap G3 / blocker B5).
      </AuthorNote>

      <Section title="Version and provenance">
        <P>
          The site code, the payload API and the datasets version independently: the payload path
          prefix (<Mono>web/v1/</Mono>) changes only on a breaking schema change, while each
          dataset carries its own version and build date. Datasets have no separate DOI — readers
          cite the paper. See <Link to="/documentation/cite">How to cite</Link> and{' '}
          <Link to="/documentation/changelog">Changelog</Link>.
        </P>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Preprint:{' '}
            <a href="https://doi.org/10.1101/2025.05.07.25327178" target="_blank" rel="noopener noreferrer">
              10.1101/2025.05.07.25327178
            </a>
          </Typography>
        </Box>
      </Section>
    </DocPage>
  );
}
