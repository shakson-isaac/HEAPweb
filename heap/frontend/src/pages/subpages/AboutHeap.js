import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import {
  AuthorNote, Code, DocPage, HeadlineFallback, Mono, P, Section, SimpleTable,
  macro, useHeadline,
} from '../Documentation';

// Structural description of the resource only (standing decision S13). The
// site's own framing copy is left to the author.
//
// The manuscript's central claim was quoted here in a pull-quote until
// 2026-10-04. It was cut: a finding about reporters and intermediates does not
// tell a first-time visitor what this resource is or what they can do with it,
// which is what an About page is for. The lead sentence does that job.
export default function AboutHeap() {
  const { data: h, error } = useHeadline();
  const n = (k) => macro(h, k);

  return (
    <DocPage
      title="About HEAP"
      lead="HEAP (Human Exposomic Architecture of the Proteome) measures how modifiable lifestyle and environmental exposures are reflected in the human plasma proteome. It links those signatures to incident disease, and grades each link by its genetic and interventional support."
    >
      <AuthorNote what="Landing framing — one paragraph, yours to write." />

      <Section
        title="What is in it"
        subtitle="Counts are read from the published payload, which is generated from the manuscript's macros."
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
      </Section>

      <Section title="Where the numbers differ between pages">
        <SimpleTable
          head={['You may see', 'And elsewhere', 'Why they differ']}
          rows={[
            [
              <span>{n('nProteins')} proteins</span>,
              <span>{n('nProteinsPES')} proteins</span>,
              'Two panels. The first is the Olink panel behind the variance decomposition; the second is the longitudinal panel behind the exposure scores.',
            ],
            [
              <span>{n('nMotifTierOne')} mediator triads</span>,
              <span>{n('nMotifTriads')} mediator triads</span>,
              'Two bars. The first is Tier 1, the published headline; the second is nominal significance, a separate set.',
            ],
          ]}
        />
      </Section>

      <Section title="How the analysis is organized">
        <P>
          Six analysis modules feed the site. <Link to="/documentation/methods">Detailed methods</Link>{' '}
          describes each one. The covariate adjustment they share is on{' '}
          <Link to="/documentation/models">Specifications</Link>.
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
      </Section>

      <Section title="Three rules for reading the site">
        <SimpleTable
          head={['Rule', 'What it means']}
          rows={[
            ['Every relationship carries one badge', <span>Association is badged separately from causal support. See <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.</span>],
            ['Every main result uses base', <span>The other five covariate sets are sensitivity layers behind a switcher. See <Link to="/documentation/models">Specifications</Link>.</span>],
            ['Mediation is descriptive', <span>Causal adjudication is separate, in <Link to="/results/causal">Mendelian randomization and colocalization</Link>.</span>],
          ]}
        />
      </Section>

      <Section title="Getting the data">
        <P>
          Every result is a static gzipped JSON object in a public bucket. No key, no rate limit,
          one line per result:
        </P>
        <Code label="R">
{`jsonlite::fromJSON(
  "https://storage.googleapis.com/heap-data/web/v1/e/protein/ASGR1.json.gz"
)`}
        </Code>
        <P>
          <Link to="/documentation/api">Data API</Link> lists what you can fetch.{' '}
          <Link to="/downloads">Downloads</Link> covers the 169 exposure GWAS, which are 51 GB and
          sit in a requester-pays bucket where transfer is billed to the project you name.
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
          The site code, the payload API and the datasets version independently. The payload path
          prefix (<Mono>web/v1/</Mono>) changes on a breaking schema change. Each dataset carries
          its own version and build date. Datasets have no separate DOI, so cite the paper. See{' '}
          <Link to="/documentation/cite">How to cite</Link>.
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
