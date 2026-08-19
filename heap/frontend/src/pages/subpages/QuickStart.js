import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { Code, DocPage, Mono, P, Section, SimpleTable, SourceNote } from '../Documentation';

// Only routes that exist today are linked from this page. Entity pages
// (/explore/protein/<SYM> and friends) are specified in WEBSITE_PLAN §6 but are
// not built yet, so they are deliberately absent rather than linked and broken.
function Step({ n, title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, maxWidth: 820, display: 'flex', gap: 2 }}>
      <Box
        sx={{
          flex: '0 0 28px', height: 28, borderRadius: '50%', backgroundColor: '#124533',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14,
        }}
      >
        {n}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>{title}</Typography>
        <Box sx={{ color: 'text.secondary', fontSize: 14.5, lineHeight: 1.6 }}>{children}</Box>
      </Box>
    </Paper>
  );
}

export default function QuickStart() {
  return (
    <DocPage
      title="Quick start"
      lead="Four ways in, depending on what you already know: a protein, an exposure, a disease, or nothing at all because you want the files."
    >
      <Section title="Before you read a result">
        <P>
          Two things determine what a number on this site means. Both take a minute and save
          misreading everything afterwards.
        </P>
        <SimpleTable
          head={['Read', 'Because']}
          rows={[
            [
              <Link to="/documentation/evidence-tiers">Evidence tiers</Link>,
              'Every relationship carries an explicit badge. An observational association and a colocalized Tier 1+ MR edge are both shown, and they are not the same claim.',
            ],
            [
              <Link to="/documentation/models">Specifications</Link>,
              <span>All main results use the <Mono>base</Mono> covariate set. The switcher offers five, and the <Mono>+ BMI</Mono> one is a sensitivity layer, never a mediation test.</span>,
            ],
          ]}
        />
      </Section>

      <Section title="I have a protein">
        <Step n={1} title="Which exposures move it">
          <Link to="/results/associations">Associations</Link> — search the protein by HGNC symbol,
          then read the Miami plot: every exposure tested against it, signed by direction of effect,
          solid points replicated across the train and test splits. Hover gives β ± SE, p and N.
          Switch the covariate specification with the toggle above the plot.
        </Step>
        <Step n={2} title="How much of it is genetic, exposomic or neither">
          <Link to="/results/main">Main results</Link> — the per-protein variance decomposition, and
          where the protein sits on the genetics-versus-exposome spectrum.
        </Step>
        <Step n={3} title="Which diseases it is linked to">
          <Link to="/results/mediation">Disease links</Link> — observational mediation, presented as
          descriptive. Causal adjudication is a separate page on purpose.
        </Step>
        <Step n={4} title="Whether anything causal survives">
          <Link to="/results/causal">Causal evidence</Link> — the Mendelian randomization edges
          touching the protein, with their tiers and colocalization status.
        </Step>
        <Step n={5} title="Whether an intervention moves it too">
          <Link to="/results/intervention">Intervention</Link> — the protein’s response in HERITAGE,
          STEP 1 and STEP 2 against its UK Biobank exposure association.
        </Step>
      </Section>

      <Section title="I have an exposure">
        <Step n={1} title="Its proteomic signature">
          <Link to="/results/summary">Lifestyle categories</Link> — how far each exposure category
          reaches into the proteome, and which exposures carry it.
        </Step>
        <Step n={2} title="The biology it lands in">
          <Link to="/results/enrichment">Tissues and pathways</Link> — tissue and pathway enrichment
          of the proteins that exposure associates with.
        </Step>
        <Step n={3} title="Whether it can be instrumented">
          <Link to="/results/gwas">Exposure GWAS</Link> — instrument diagnostics, heritability and
          genetic correlation. Many deprivation and pollution exposures map few or no loci and
          cannot enter Mendelian randomization at all; that is visible here rather than implied by
          an empty cell later.
        </Step>
        <Step n={4} title="Its proteome-based score">
          <Link to="/results/pes">Exposure scores</Link> — how well a proteomic score reads that
          exposure, how it tracks within a person over time, and what it adds to disease
          prediction.
        </Step>
        <Step n={5} title="Interactions with genotype">
          <Link to="/results/architecture">Genetic and exposomic architecture</Link> — G×E is
          reported here, below the main architecture panels, because it is supplementary in the
          revised manuscript.
        </Step>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Exposure ids are UK Biobank variable names. Look one up in the{' '}
          <Link to="/documentation/dictionary">exposome dictionary</Link>.
        </Typography>
      </Section>

      <Section title="I have a disease">
        <Step n={1} title="Which lifestyle-linked proteins route through it">
          <Link to="/results/mediation">Disease links</Link> — the mediation landscape, keyed by
          disease as well as by protein.
        </Step>
        <Step n={2} title="Which of those have genetic support">
          <Link to="/results/causal">Causal evidence</Link> — MR edges into and out of the disease,
          by tier. Note that disease → protein effects are far more common than protein → disease
          effects, so most proteins linked to a disease are responding to it.
        </Step>
        <Step n={3} title="Whether an exposure score predicts it">
          <Link to="/results/pes">Exposure scores</Link> — the change in C-index when a
          proteome-based exposure score is added to a disease model.
        </Step>
      </Section>

      <Section title="I want the files">
        <Step n={1} title="A single result, in one line">
          No download page needed. Every panel on this site is a static object you can fetch
          directly:
          <Code label="R">
{`jsonlite::fromJSON(
  "https://storage.googleapis.com/heap-web-data/web/v1/e/protein/ASGR1.json.gz"
)`}
          </Code>
          <Code label="Python">
{`import json, urllib.request
with urllib.request.urlopen(
    "https://storage.googleapis.com/heap-web-data/web/v1/s/mr_motif_counts.json.gz"
) as r:
    motifs = json.load(r)`}
          </Code>
          The full URL scheme is on <Link to="/documentation/api">Data API</Link>.
        </Step>
        <Step n={2} title="Browse what exists first">
          <Mono>catalog.json.gz</Mono> lists all 37 supplementary datasets with their schemas and
          build dates; <Mono>manifest.json.gz</Mono> lists every published section. Both are one
          request and under 10 KB.
        </Step>
        <Step n={3} title="Bulk archives">
          <Link to="/downloads">Downloads</Link> serves the packaged summary-statistic archives.
          For a single protein or a single exposure the API above is smaller and faster.
        </Step>
      </Section>

      <Section title="Citing what you took">
        <P>
          Datasets carry a version and a build date but no separate DOI — the citation is always
          the paper. See <Link to="/documentation/cite">How to cite</Link>.
        </P>
        <SourceNote>
          routes listed here are the ones the site serves today; the entity pages described in{' '}
          <Mono>docs/WEBSITE_PLAN.md</Mono> §6 are not built yet and are deliberately not linked.
        </SourceNote>
      </Section>
    </DocPage>
  );
}
