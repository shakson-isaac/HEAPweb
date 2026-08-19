import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Chip, Paper, Typography } from '@mui/material';
import {
  AuthorNote, DocPage, Mono, P, Section, SimpleTable, SourceNote, useHeadline, macro,
} from '../Documentation';

// Structural changes only (standing decision S13). Where a row would need a
// statement about what a result *means*, the row records the structural fact and
// the interpretation is marked for the author instead.
function Kind({ value }) {
  const structural = value === 'structural';
  return (
    <Chip
      size="small"
      label={value}
      sx={{
        fontWeight: 600,
        backgroundColor: structural ? '#e8eef0' : '#fdf3e0',
        color: structural ? '#0f3d4d' : '#7a4a00',
      }}
    />
  );
}

export default function Changelog() {
  const { data: h } = useHeadline();
  const n = (k) => macro(h, k);

  return (
    <DocPage
      title="Changelog"
      lead="What changed between the first release of this resource and the current one. This tracks the resource — its structure, its vocabulary and its files — not the manuscript."
    >
      <Section title="v2 — the current release">
        <Paper variant="outlined" sx={{ p: 2, mb: 2, maxWidth: 820 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            v2 rebuilds the site for the revised manuscript. The previous public site was built
            for the original manuscript and still described four analysis modules, the Type1–Type7
            covariate naming, and G×E as a top-level result. All three are superseded.
          </Typography>
        </Paper>

        <SimpleTable
          head={['Change', 'Kind', 'Detail']}
          rows={[
            [
              'Six analysis modules, not four',
              <Kind value="structural" />,
              <span>
                v1 presented four: variance decomposition, G×E associations, mediation, and
                interventional validation. v2 has six numbered modules — variance decomposition,
                exposure–protein association, mediation, Mendelian randomization, interventional
                comparison, and proteome-based exposure scores — plus two un-numbered supporting
                analyses (tissue/pathway enrichment, exposure GWAS). Module numbers follow the
                manuscript, not the code directories.
              </span>,
            ],
            [
              'Bidirectional MR added',
              <Kind value="structural" />,
              <span>
                A new module tests six directed edges for each exposure–protein–disease triad
                (E→P, P→E, P→D, D→P, E→D, D→E) and grades each on a stringency ladder. Nothing
                equivalent existed in v1. See <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.
              </span>,
            ],
            [
              'Colocalization added',
              <Kind value="structural" />,
              <span>
                Cis-pQTL colocalization with a hard gate at PP.H4 ≥ 0.8; {n('nColoc')} loci clear
                it. Cis edges failing the gate because the two signals sit on distinct variants in
                linkage disequilibrium are labelled LD-confounded rather than dropped.
              </span>,
            ],
            [
              'Proteome-based exposure scores (PES) added',
              <Kind value="structural" />,
              <span>
                A new module trains a proteomic score per exposure and evaluates it on exposure
                prediction, within-person tracking, and incremental disease prediction. Weights
                are deposited per exposure. The PES panel is a different protein panel (
                {n('nProteinsPES')}) from the variance-decomposition panel ({n('nProteins')}).
              </span>,
            ],
            [
              'G×E demoted to supplementary',
              <Kind value="structural" />,
              <span>
                G×E is no longer a top-level pillar. It remains fully reachable, below the
                divider, on <Link to="/results/architecture">Genetic and exposomic architecture</Link>;
                the old <Mono>/results/interactions</Mono> path still resolves so existing links
                keep working.
              </span>,
            ],
            [
              'Mediation reframed as descriptive',
              <Kind value="structural" />,
              <span>
                Observational mediation is no longer a top-navigation destination and is labelled
                descriptive wherever a mediated fraction appears, with a fixed caveat shown next
                to the number. Causal adjudication moved to its own page, driven by MR and
                colocalization.
              </span>,
            ],
            [
              'Covariate sets renamed',
              <Kind value="structural" />,
              <span>
                Type1–Type7 is retired for descriptive names: <Mono>base</Mono> (primary),{' '}
                <Mono>base_bmi</Mono>, <Mono>base_draw</Mono>, <Mono>base_clinical</Mono>,{' '}
                <Mono>base_ses</Mono>, <Mono>base_prevalent</Mono>. v1 keyed its association pages
                on <Mono>Type6</Mono>, which is now <Mono>base_ses</Mono> and is never a default.
                <b> Type3 did not simply become base</b>: base drops BMI and fasting time, so the
                two are different models. Full mapping on{' '}
                <Link to="/documentation/models">Specifications</Link>.
              </span>,
            ],
            [
              'Evidence ladder applied site-wide',
              <Kind value="structural" />,
              <span>
                Every relationship now carries an explicit evidence level. The generic
                “significant” badge used in v1 is gone.
              </span>,
            ],
            [
              'Exposure and disease counts restated',
              <Kind value="structural" />,
              <span>
                v1 described 135 lifestyle exposures and 270 disease codes. v2 analyzes{' '}
                {n('nExposures')} exposomic features and {n('nDiseasesGEM')} incident disease
                outcomes — the disease set is restricted to outcomes with at least 100 incident
                cases. Both counts are read from the manuscript macros at page load.
              </span>,
            ],
            [
              'Protein identifiers standardized',
              <Kind value="structural" />,
              <span>
                Protein keys are true HGNC symbols (<Mono>HLA-A</Mono>, not <Mono>HLA_A</Mono>).
                Four proteins carry R-safe underscored names in the upstream exports; the packer
                republishes them under the real symbol and records the alias.
              </span>,
            ],
            [
              'Results served as static files',
              <Kind value="structural" />,
              <span>
                Pages read gzipped columnar JSON from a public bucket instead of round-tripping to
                a database for sorting and filtering. The frontend and the public API are now the
                same files — see <Link to="/documentation/api">Data API</Link>.
              </span>,
            ],
            [
              'No dataset DOIs',
              <Kind value="structural" />,
              <span>
                Datasets carry a version string and build date only; the citation is the paper.
                See <Link to="/documentation/cite">How to cite</Link>.
              </span>,
            ],
          ]}
        />
        <SourceNote>
          <Mono>docs/WEBSITE_PLAN.md</Mono> §1, §2 and §13; <Mono>docs/TASKS.md</Mono> standing
          decisions and completed rows; <Mono>HEAP/docs/MODULE_NUMBERING.md</Mono>;{' '}
          <Mono>HEAP/config/covariates/covariate_sets.yml</Mono>. Live counts from{' '}
          <Mono>meta/headline.json.gz</Mono>.
        </SourceNote>
      </Section>

      <AuthorNote what="Why G×E was demoted — one sentence, yours.">
        The row above states only that G×E moved to the supplement, which is a structural fact
        about the site. The justification recorded in the claims ledger is a statement about the
        results themselves, so it is left for you to write or approve rather than paraphrased
        here.
      </AuthorNote>

      <AuthorNote what="The reframe itself — the headline of this changelog.">
        The single largest change between v1 and v2 is what the resource claims, not how it is
        organized: the shift from presenting exposure-responsive proteins uniformly to
        distinguishing causal intermediates from biological reporters. That belongs at the top of
        this page in your words. Until it is written, this changelog reads as a list of structural
        moves without the reason for any of them.
      </AuthorNote>

      <AuthorNote what="Whether v1 numbers should be shown alongside v2 numbers.">
        The exposure and disease counts changed between releases. They are stated above as a
        before/after pair so that a reader who cited the v1 site can tell what happened. If you
        would rather the old numbers not appear at all, say so and the row becomes a v2-only
        statement.
      </AuthorNote>

      <Section title="v1 — the original release">
        <P>
          Built for the original manuscript. Four analysis modules, Type1–Type7 covariate naming,
          G×E as a top-level result, mediation in the top navigation, and results served from a
          relational database behind a Flask API. Pages from that release remain reachable during
          the transition.
        </P>
      </Section>

      <Section title="How versions move">
        <SimpleTable
          head={['Axis', 'Bumps when', 'Where you see it']}
          rows={[
            ['Site code', 'every change', 'the deployed frontend'],
            ['Payload API', <span>only on a breaking schema change — a field removed or its meaning changed</span>, <Mono>web/v1/</Mono>],
            ['Dataset', 'the analysis is rerun', <span>the <Mono>version</Mono> and build date on each row of <Mono>catalog.json.gz</Mono></span>],
          ]}
        />
        <P>
          Content changes never bump the API version. Adding a section, or republishing one with
          new values, leaves <Mono>v1</Mono> alone; only a change that would make an older client
          misread a newer payload moves it.
        </P>
        <SourceNote><Mono>docs/WEBSITE_PLAN.md</Mono> §15.</SourceNote>
      </Section>

      <Box sx={{ mt: 4 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Rows marked <Kind value="scientific" /> would assert what a result means and are left
          for the author; every row on this page is currently structural.
        </Typography>
      </Box>
    </DocPage>
  );
}
