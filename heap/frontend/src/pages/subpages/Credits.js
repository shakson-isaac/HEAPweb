import React from 'react';
import {
  Box, Chip, Divider, Link, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import SectionCard from '../../components/SectionCard';

// ---------------------------------------------------------------------------
// What this site is built ON, as opposed to how to cite the site itself --
// that lives on the Cite page and is a different question.
//
// Every reference here is copied from the manuscript's own bibliography
// (HEAP_manuscript/refs/heap.bib) rather than written from memory, so the
// website and the paper credit the same work in the same words. If a source is
// added here it should be added there too, or the two will drift.
//
// The rule this page exists to enforce: nothing appears on the site that came
// from outside without being named here. That includes data we did not
// generate, drawings we did not make, and methods implemented by someone else.
// ---------------------------------------------------------------------------

const REFS = [
  {
    what: 'Tissue expression',
    used: 'GTEx v10 median expression across 54 tissues; the tissue signatures the enrichment is computed against, and the per-protein profiles on the body map.',
    cite: 'GTEx Consortium. Genetic effects on gene expression across human tissues. Nature (2017).',
  },
  {
    what: 'Subcellular location',
    used: 'Human Protein Atlas subcellular and tissue tables, shown beside a protein’s expression profile.',
    cite: 'Uhlén M et al. Tissue-based map of the human proteome. Science (2015).',
  },
  {
    what: 'Pathways',
    used: 'Reactome pathway definitions, the gene sets behind every pathway enrichment and the program clusters.',
    cite: 'Joshi-Tope G et al. Reactome: a knowledgebase of biological pathways. Nucleic Acids Research (2005).',
  },
  {
    what: 'Disease genetics',
    used: 'FinnGen Release 12 summary statistics — the disease side of every Mendelian randomization edge and every colocalization.',
    cite: 'Kurki MI et al. FinnGen provides genetic insights from a well-phenotyped isolated population. Nature (2023).',
  },
  {
    what: 'pQTLs — SomaScan',
    used: 'deCODE plasma protein QTLs, the external replication panel for protein-involving MR edges.',
    cite: 'Ferkingstad E et al. Large-scale integration of the plasma proteome with genetics and disease. Nature Genetics (2021).',
  },
  {
    what: 'Cross-platform reliability',
    used: 'Olink–SomaScan assay correlations, used to weight the intervention concordance and to size its points.',
    cite: 'Eldjarn GH et al. Large-scale plasma proteomics comparisons through genetics and disease associations. Nature (2023).',
  },
  {
    what: 'pQTLs — Olink',
    used: 'UK Biobank plasma proteomics and its genetic instruments.',
    cite: 'Wang Y et al. Comparative studies of 2168 plasma proteins measured by two affinity-based platforms. Nature Communications (2025).',
  },
  {
    what: 'Split-sample MR design',
    used: 'The sample-independent design the exposure instruments follow, so no participant contributes to both sides of an estimate.',
    cite: 'Deng Y et al. Atlas of the plasma proteome in health and disease. Cell (2025).',
  },
  {
    what: 'Exercise trial',
    used: 'HERITAGE — protein changes after 20 weeks of endurance training, one arm of the intervention concordance.',
    cite: 'Sarzynski MA et al. The HERITAGE Family Study. Medicine & Science in Sports & Exercise (2022).',
  },
  {
    what: 'GLP-1 trials',
    used: 'STEP 1 and STEP 2 — protein changes under semaglutide, the other two intervention arms.',
    cite: 'Wilding JPH et al. NEJM (2021); Davies M et al. Lancet (2021).',
  },
  {
    what: 'Colocalization',
    used: 'coloc.abf, the posterior behind every PP.H4 and the regional plots that show it.',
    cite: 'Giambartolomei C et al. Bayesian test for colocalisation between pairs of genetic association studies. PLoS Genetics (2014).',
  },
  {
    what: 'Linkage disequilibrium',
    used: 'PLINK against the 1000 Genomes European reference panel — the r² colouring on every regional colocalization plot.',
    cite: 'Chang CC et al. Second-generation PLINK. GigaScience (2015).',
  },
  {
    what: 'Enrichment',
    used: 'clusterProfiler, which computed every tissue and pathway GSEA including the leading-edge proteins.',
    cite: 'Xu S et al. Using clusterProfiler to characterize multiomics data. Nature Protocols (2024).',
  },
  {
    what: 'Causal inference',
    used: 'The two-sample Mendelian randomization framework the evidence tiers are built on.',
    cite: 'Davey Smith G, Hemani G. Mendelian randomization: genetic anchors for causal inference. Human Molecular Genetics (2014).',
  },
];

const DRAWINGS = [
  {
    what: 'Human body and brain anatomograms',
    where: 'The body map in Tissues & Pathways.',
    source: 'EBI Expression Atlas anatomogram',
    href: 'https://github.com/gxa/anatomogram',
    licence: 'Apache-2.0',
    note: 'SVGs redistributed unmodified. Highlighting is ours; the drawings are theirs.',
  },
];

const SOFTWARE = [
  ['React, Material UI', 'the interface'],
  ['Plotly.js', 'every chart that is not hand-drawn SVG'],
  ['data.table, ggplot2', 'the analysis and the printed figures'],
  ['locuszoomr, EnsDb.Hsapiens.v86', 'the print regional plots and the gene track'],
];

function Head({ children }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
      {children}
    </Typography>
  );
}

export default function Credits() {
  return (
    <SectionCard
      title="References and credits"
      subtitle={
        'What this site is built on. Every dataset we did not generate, every drawing we did '
        + 'not make, and every method someone else implemented. To cite HEAP itself, see Cite.'
      }
    >
      <Typography variant="body2" sx={{ maxWidth: 900, mb: 1 }}>
        References are taken from the manuscript&rsquo;s own bibliography rather than retyped, so
        the site and the paper credit the same work in the same words.
      </Typography>

      <Head>Data and methods</Head>
      <TableContainer sx={{ maxWidth: 1040 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>What</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Where it is used here</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {REFS.map((r) => (
              <TableRow key={r.what} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  <b>{r.what}</b>
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>{r.used}</TableCell>
                <TableCell sx={{ verticalAlign: 'top', color: 'text.secondary' }}>
                  {r.cite}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Head>Diagrams and drawings</Head>
      {DRAWINGS.map((d) => (
        <Box key={d.what} sx={{ maxWidth: 900, mb: 2 }}>
          <Typography variant="body2">
            <b>{d.what}</b> &mdash; {d.where}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            From{' '}
            <Link href={d.href} target="_blank" rel="noopener noreferrer">{d.source}</Link>
            {'  '}
            <Chip size="small" variant="outlined" label={d.licence} sx={{ mx: 0.5, height: 20 }} />
            {d.note}
          </Typography>
        </Box>
      ))}

      <Head>Software</Head>
      <Box component="ul" sx={{ maxWidth: 900, pl: 3, m: 0 }}>
        {SOFTWARE.map(([name, use]) => (
          <Typography component="li" variant="body2" key={name} sx={{ mb: 0.5 }}>
            <b>{name}</b> &mdash; {use}
          </Typography>
        ))}
      </Box>

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 900 }}>
        Something used here and not credited on this page is an omission worth reporting. The list
        is maintained by hand, which means it can fall behind the site &mdash; if you find a figure,
        dataset or method that traces back to work not named above, it belongs here.
      </Typography>
    </SectionCard>
  );
}
