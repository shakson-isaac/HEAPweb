import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Paper, Typography } from '@mui/material';
import {
  AuthorNote, Code, DocPage, Mono, P, Section, SimpleTable, SourceNote,
} from '../Documentation';
import { WEB_DATA_BASE } from '../../lib/heapdata';

const DOI = '10.1101/2025.05.07.25327178';
const DOI_URL = `https://doi.org/${DOI}`;
const TITLE = 'Human Plasma Proteomics Links Modifiable Lifestyle Exposome to Disease Risk';
const AUTHORS = [
  'Shakson Isaac', 'Randall J. Ellis', 'Alexander Gusev',
  'Venkatesh L. Murthy', 'Miriam S. Udler', 'Chirag J. Patel',
];

// The build a reader actually pulled from, read from the catalog rather than
// written down here -- a hand-typed build date goes stale the first time the
// payload is republished.
function useCatalog() {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    fetch(`${WEB_DATA_BASE}/catalog.json.gz`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then((data) => alive && setState({ data, error: null }))
      .catch((error) => alive && setState({ data: null, error }));
    return () => { alive = false; };
  }, []);
  return state;
}

export default function Cite() {
  const { data: catalog, error } = useCatalog();
  const updates = catalog
    ? catalog.datasets.map((d) => d.updated).filter(Boolean).sort()
    : [];
  const latest = updates.length ? updates[updates.length - 1] : null;

  return (
    <DocPage
      title="How to cite"
      lead="Cite the paper. The datasets published here carry a version and a build date so you can state exactly which release you used, but they do not carry separate DOIs of their own."
    >
      <Section title="The paper">
        <Paper variant="outlined" sx={{ p: 2, mb: 2, maxWidth: 820, borderLeft: '4px solid #124533' }}>
          <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
            {AUTHORS.join(', ')}. <b>{TITLE}</b>. medRxiv (preprint).{' '}
            <a href={DOI_URL} target="_blank" rel="noopener noreferrer">
              doi:{DOI}
            </a>
          </Typography>
        </Paper>
        <Code label="BibTeX">
{`@article{isaac_heap,
  author  = {Isaac, Shakson and Ellis, Randall J. and Gusev, Alexander and
             Murthy, Venkatesh L. and Udler, Miriam S. and Patel, Chirag J.},
  title   = {${TITLE}},
  journal = {medRxiv},
  year    = {2025},
  doi     = {${DOI}},
  url     = {${DOI_URL}}
}`}
        </Code>
        <SourceNote>
          title and author list read from <Mono>HEAP_manuscript/main.tex</Mono>; DOI as posted.
        </SourceNote>
      </Section>

      <AuthorNote what="Confirm the author list before this page goes public.">
        The names above are the six authors currently in <Mono>main.tex</Mono>. That file also
        carries an open note to update the credit statement with additional co-authors, so the
        list here may be incomplete relative to what is posted. It also needs checking against the
        posted preprint version, since the site should cite what a reader will actually find at
        the DOI.
      </AuthorNote>

      <Section title="License">
        <P>
          The preprint is distributed under{' '}
          <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer">
            Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)
          </a>.
        </P>
        <SimpleTable
          head={['You may', 'You may not']}
          rows={[
            ['Share and redistribute the material in any medium or format, with attribution.', 'Use it for commercial purposes.'],
            ['Quote and cite it in your own work.', 'Distribute a modified or transformed version.'],
          ]}
        />
      </Section>

      <Section title="The datasets">
        <Alert severity="info" sx={{ maxWidth: 820, mb: 2 }}>
          There are no dataset DOIs, by decision. Each dataset carries a version string and a
          build date so that a reader can state which build they used; the citation is always the
          paper.
        </Alert>
        <P>
          Three things identify a build, and all three are readable from the payload rather than
          from this page:
        </P>
        <SimpleTable
          head={['Identifier', 'Where it lives', 'Current value']}
          rows={[
            [
              'Payload API version',
              <Mono>manifest.json.gz → version</Mono>,
              <Mono>v1</Mono>,
            ],
            [
              'Catalog version',
              <Mono>catalog.json.gz → version</Mono>,
              catalog ? <Mono>{catalog.version}</Mono> : '—',
            ],
            [
              'Dataset build date',
              <Mono>catalog.json.gz → datasets[].updated</Mono>,
              latest ? <span>most recent: <Mono>{latest}</Mono> across {catalog.n_datasets} datasets</span> : '—',
            ],
          ]}
        />
        {error && (
          <Alert severity="warning" sx={{ maxWidth: 820, mb: 2 }}>
            The catalog could not be read from the payload ({String(error.message || error)}), so
            the current values above show as em dashes rather than as stale hand-typed dates.
          </Alert>
        )}
        <P>A data statement can therefore be written as:</P>
        <Code>
{`Summary statistics were obtained from the HEAP resource
(${WEB_DATA_BASE}), payload version v1,
dataset build ${latest || '<see catalog.json.gz>'} (accessed <date>), described in
${AUTHORS[0].split(' ').slice(-1)[0]} et al., doi:${DOI}.`}
        </Code>
        <SourceNote>
          decision D10 / S12 in <Mono>docs/WEBSITE_PLAN.md</Mono>; version axes in §15. Values
          above are read live from <Mono>catalog.json.gz</Mono>.
        </SourceNote>
      </Section>

      <Section title="Citing one result">
        <P>
          If you are citing a single relationship rather than the resource, cite the paper and
          name the evidence level, because the level is the claim. “Tier 1+, colocalized” and
          “observational, replicated” are different statements about the same pair of entities —
          see <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.
        </P>
      </Section>

      <Section title="Reusing figures">
        <Box sx={{ maxWidth: 820 }}>
          <P>
            Published figures are shown as printed. Under the preprint license they may be
            redistributed with attribution but not modified, which includes recoloring or
            recropping a panel.
          </P>
        </Box>
      </Section>
    </DocPage>
  );
}
