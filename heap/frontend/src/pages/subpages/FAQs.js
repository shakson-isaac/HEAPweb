import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import { Typography } from '@mui/material';
import './FAQs.css';
import { AuthorNote, DocPage, Mono, Section } from '../Documentation';

// Short answers only. Anything that needs more than a few lines points at the
// page that carries it, so the detail lives in exactly one place.
const FAQ_ITEMS = [
  {
    q: 'What is the exposome?',
    a: [
      'The exposome is the totality of a person’s environmental exposures — lifestyle, social, and chemical.',
      'These exposures influence health across the lifespan (Vermeulen et al., 2020).',
      <span key="dict">
        HEAP analyzes a defined subset of it; every feature is listed in the{' '}
        <Link to="/documentation/dictionary">exposome dictionary</Link>, along with the candidate
        variables that were considered and dropped.
      </span>,
    ],
  },
  {
    q: 'What is the plasma proteome?',
    a: [
      'The plasma proteome is the complete set of proteins found in blood plasma.',
      'These proteins offer insight into processes such as hormone regulation, immune response, and disease states (Anderson et al., 2002).',
    ],
  },
  {
    q: 'How should I use HEAP?',
    a: [
      <span key="a">
        Start from whatever you already have — a protein, an exposure, or a disease. The{' '}
        <Link to="/documentation/quickstart">quick start</Link> lists the route for each.
      </span>,
      <span key="b">
        Read <Link to="/documentation/evidence-tiers">Evidence tiers</Link> before drawing a
        conclusion from any single result. Every relationship carries an evidence level, and an
        observational association is badged differently from a colocalized Mendelian
        randomization edge.
      </span>,
      <span key="c">
        The per-exposure score weights and the full summary statistics are reachable without a
        browser. See the <Link to="/documentation/api">Data API</Link>.
      </span>,
      <span key="d">
        Cite the paper: <Link to="/documentation/cite">How to cite</Link>.
      </span>,
    ],
  },
  {
    q: 'Which covariate specification should I use?',
    a: [
      <span key="a">
        <Mono>base</Mono>, unless you have a specific reason not to. It is the primary model
        behind every main result and the default in every switcher here.
      </span>,
      <span key="b">
        The other five sets are sensitivity layers, each adding one adjustment on top of{' '}
        <Mono>base</Mono> so that a movement in an estimate can be attributed to that adjustment.
        Full definitions on <Link to="/documentation/models">Specifications</Link>.
      </span>,
    ],
  },
  {
    q: 'Does the estimate shrinking under "+ BMI" mean the effect is mediated by BMI?',
    a: [
      'No. Attenuation after BMI adjustment is equally consistent with mediation, with confounding and with collider bias. Adjustment cannot separate the three.',
    ],
  },
  {
    q: 'What do the evidence badges mean?',
    a: [
      <span key="a">
        Each badge names the strongest evidence obtained for that relationship, from “an estimate
        exists” up to a colocalized, cross-platform-replicated Mendelian randomization edge.
      </span>,
      <span key="b">
        Definitions rung by rung: <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.
      </span>,
    ],
  },
  {
    q: 'Why does a protein look causal for one disease and not for another?',
    a: [
      'Because classification is per protein–disease pair. The motif rule is defined over the six directed edges of one exposure–protein–disease triad, so it has no protein-wide value.',
      'Applied protein-wide, a single label contradicts the paper for its own mediator proteins.',
    ],
  },
  {
    q: 'Is the mediation analysis causal?',
    a: [
      'No. Observational mediation estimates are descriptive and may reflect confounding, reverse causation, or shared upstream causes. Causal support is evaluated separately using MR and colocalization.',
      <span key="b">
        That sentence is shown verbatim next to every mediated fraction on the site. The causal
        adjudication lives on <Link to="/results/causal">Causal evidence</Link>.
      </span>,
    ],
  },
  {
    q: 'Why is gene-by-environment interaction in the supplement now?',
    a: [
      <span key="a">
        The revised manuscript reports G×E as a supplementary result, and the site follows it. The
        analysis is reachable below the divider on{' '}
        <Link to="/results/architecture">Genetic and exposomic architecture</Link>, and the old{' '}
        <Mono>/results/interactions</Mono> link still works.
      </span>,
    ],
  },
  {
    q: 'Why do I see 2,686 proteins in one place and 2,923 in another?',
    a: [
      'Each number belongs to a different panel. 2,686 is the analyzed panel behind the variance decomposition, and 2,923 is the longitudinal panel behind the proteome-based exposure scores.',
      'Exposures work the same way: 169 features are analyzed, drawn from a larger set of candidate variables.',
    ],
  },
  {
    q: 'Why is the mediator-motif count six in one figure and 84 in another?',
    a: [
      'They are two different bars. Six triads across three proteins is the Tier 1 bar, which is the headline. 84 triads across 25 proteins is the nominal-significance bar.',
      <span key="b">
        The two sets are separate. Motif definitions require some edges to be absent, so
        membership is recomputed at each rung and the counts are not monotonic. See{' '}
        <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.
      </span>,
    ],
  },
  {
    q: 'My protein or exposure is missing from a result. Was it not significant?',
    a: [
      'Check which of the two it is. Every empty state draws "not tested" and "tested, not significant" differently.',
      <span key="b">
        Several exposures, including much of the deprivation and pollution set, map too few
        genome-wide loci to be instrumented. They are absent from the Mendelian randomization
        results by construction. The instrument diagnostics are on{' '}
        <Link to="/results/gwas">Exposure GWAS</Link>.
      </span>,
    ],
  },
  {
    q: 'Can I get the data without using the website?',
    a: [
      <span key="a">
        Yes. Every panel is a static gzipped JSON object on a public bucket, with no
        authentication and no rate limit. One line of R or Python pulls a whole result —{' '}
        <Link to="/documentation/api">Data API</Link>.
      </span>,
      <span key="b">
        Packaged archives are on <Link to="/downloads">Downloads</Link>.
      </span>,
    ],
  },
  {
    q: 'Where are the exposure GWAS summary statistics?',
    a: [
      <span key="a">
        In <Mono>gs://heap-gwas</Mono>: 169 exposures, one bgzipped file each with a tabix index,
        7.78 million variants per file and 51 GB in total. REGENIE step 2 under the base covariate
        set, autosomes only, columns in the GWAS Catalog standard.
      </span>,
      <span key="b">
        The bucket is requester-pays, so the transfer is billed to the Google Cloud project you
        name and a project with billing enabled is needed:{' '}
        <Mono>gcloud storage cp gs://heap-gwas/&lt;exposure&gt;.tsv.bgz . --billing-project=YOUR_PROJECT</Mono>.
      </span>,
      <span key="c">
        <Link to="/downloads">Downloads</Link> lists every exposure with its size and the exact
        command.
      </span>,
    ],
  },
];

export default function FAQs() {
  const [openIndex, setOpenIndex] = useState(0);
  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <DocPage
      title="FAQs"
      lead="Short answers. Anything that needs more than a few lines links to the page that carries it."
    >
      <ul className="faq-list">
        {FAQ_ITEMS.map((item, i) => (
          <li className="faq-item" key={item.q}>
            <div
              className="faq-header"
              onClick={() => toggle(i)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(i)}
              role="button"
              tabIndex={0}
            >
              <QuizOutlinedIcon style={{ color: 'var(--accent)', marginRight: '12px' }} />
              <span className={openIndex === i ? 'faq-question active' : 'faq-question'}>
                {item.q}
              </span>
            </div>
            {openIndex === i && (
              <ul className="faq-answer">
                {item.a.map((line, j) => (
                  <li key={typeof line === 'string' ? line : j}>{line}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <AuthorNote what="Why G×E was demoted — the FAQ answers the what, not the why.">
        The answer above states only that G×E is supplementary in the revised manuscript and where
        to find it. The reason recorded in the claims ledger is a statement about the results, so
        it is left for you. A reader who asks this question is asking for the reason.
      </AuthorNote>

      <Section title="References">
        <ul className="references-list">
          <li>
            <Typography variant="body2" component="span">
              Vermeulen, R., Schymanski, E. L., Barabási, A.-L. &amp; Miller, G. W. The exposome and
              health: Where chemistry meets biology. <i>Science</i> <b>367</b>, 392–396 (2020).
            </Typography>
          </li>
          <li>
            <Typography variant="body2" component="span">
              Anderson, N. L. &amp; Anderson, N. G. The human plasma proteome: history, character,
              and diagnostic prospects. <i>Mol. Cell. Proteomics</i> <b>1</b>, 845–867 (2002).
            </Typography>
          </li>
        </ul>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Cite HEAP as the preprint. See <Link to="/documentation/cite">How to cite</Link>.
        </Typography>
      </Section>
    </DocPage>
  );
}
