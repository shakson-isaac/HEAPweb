import React from 'react';
import { Paper, Typography } from '@mui/material';
import {
  AuthorNote, Code, DocPage, Mono, P, Section, SimpleTable,
} from '../Documentation';

const DOI = '10.1101/2025.05.07.25327178';
const DOI_URL = `https://doi.org/${DOI}`;
const TITLE = 'Human Plasma Proteomics Links Modifiable Lifestyle Exposome to Disease Risk';
const AUTHORS = [
  'Shakson Isaac', 'Randall J. Ellis', 'Alexander Gusev',
  'Venkatesh L. Murthy', 'Miriam S. Udler', 'Chirag J. Patel',
];

// Trimmed 2026-10-05 to the preprint, the BibTeX, the license and one sentence
// on citing the data. The page also carried three build identifiers read live
// from catalog.json.gz, two data-statement templates and sections on citing a
// single result and on reusing figures. A reader who needs the build string can
// read it from the catalog, which the Data API page documents.
export default function Cite() {
  return (
    <DocPage
      title="How to cite"
      lead="Cite the preprint. If you use summary statistics or any other data from this site, cite the preprint for those too — the datasets have no separate DOI."
    >
      <Section title="The paper">
        <Paper variant="outlined" sx={{ p: 2, mb: 2, maxWidth: 820, borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
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
    </DocPage>
  );
}
