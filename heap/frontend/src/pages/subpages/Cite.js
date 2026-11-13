import React from 'react';
import { Paper, Typography } from '@mui/material';
import {
  Code, DocPage, P, Section, SimpleTable,
} from '../Documentation';

const DOI = '10.1101/2025.05.07.25327178';
const DOI_URL = `https://doi.org/${DOI}`;
const TITLE = 'Human Plasma Proteomics Links Modifiable Lifestyle Exposome to Disease Risk';
const AUTHORS = [
  'Shakson Isaac', 'Randall J. Ellis', 'Yon Ho Jee', 'Venkatesh L. Murthy',
  'Miriam S. Udler', 'Benjamin M. Neale', 'Shamil Sunyaev', 'Alexander Gusev',
  'Alicia R. Martin', 'Chirag J. Patel',
];

// Authors match medRxiv v2 (posted 2026-11-13; first posted 2025).
//
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
  author  = {Isaac, Shakson and Ellis, Randall J. and Jee, Yon Ho and
             Murthy, Venkatesh L. and Udler, Miriam S. and Neale, Benjamin M. and
             Sunyaev, Shamil and Gusev, Alexander and Martin, Alicia R. and
             Patel, Chirag J.},
  title   = {${TITLE}},
  journal = {medRxiv},
  year    = {2025},
  doi     = {${DOI}},
  url     = {${DOI_URL}}
}`}
        </Code>
      </Section>

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
