import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import { Typography } from '@mui/material';
import './FAQs.css';
import { AuthorNote, DocPage, Mono, Section, SourceNote } from '../Documentation';

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
        conclusion from any single result. Every relationship carries an explicit evidence level,
        and an observational association is presented very differently from a colocalized
        Mendelian randomization edge.
      </span>,
      <span key="c">
        If you have your own proteomics data, the per-exposure score weights and the full summary
        statistics are reachable without a browser — see the{' '}
        <Link to="/documentation/api">Data API</Link>.
      </span>,
      <span key="d">
        Cite the paper, not the datasets: <Link to="/documentation/cite">How to cite</Link>.
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
      'No. Attenuation after adjusting for BMI cannot distinguish mediation from confounding — or from collider bias. All three produce the same attenuation.',
      <span key="b">
        For that reason <Mono>+ BMI</Mono> is labelled a sensitivity specification everywhere on
        this site and is never presented as a mediation test.
      </span>,
    ],
  },
  {
    q: 'What do the evidence badges mean?',
    a: [
      <span key="a">
        Each badge names the strongest evidence obtained for that specific relationship, from
        “an estimate exists” up to a colocalized, cross-platform-replicated Mendelian
        randomization edge. There is deliberately no generic “significant” badge.
      </span>,
      <span key="b">
        Definitions rung by rung: <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.
      </span>,
    ],
  },
  {
    q: 'Why does a protein look causal for one disease and not for another?',
    a: [
      'Because classification is per (protein, disease) pair, not per protein. The motif rule is defined over the six directed edges of one exposure–protein–disease triad, so it simply has no protein-wide value.',
      'A single per-protein label was tested and rejected: applied protein-wide it contradicts the paper for its own mediator proteins.',
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
        In the revised manuscript G×E is a supplementary result rather than a top-level pillar, so
        the site follows suit. It is fully reachable, below the divider, on{' '}
        <Link to="/results/architecture">Genetic and exposomic architecture</Link>, and the old{' '}
        <Mono>/results/interactions</Mono> link still works.
      </span>,
    ],
  },
  {
    q: 'Why do I see 2,686 proteins in one place and 2,923 in another?',
    a: [
      'They are different panels, not a corrected count. 2,686 is the analyzed panel behind the variance decomposition; 2,923 is the longitudinal panel behind the proteome-based exposure scores.',
      'The same care applies to exposures: 169 features are analyzed, drawn from a larger set of candidate variables.',
    ],
  },
  {
    q: 'Why is the mediator-motif count six in one figure and 84 in another?',
    a: [
      'Because they are two different bars. Six triads across three proteins is the Tier 1 bar and is the headline; 84 triads across 25 proteins is the nominal-significance bar.',
      <span key="b">
        The two sets are <b>not nested</b>. Motif definitions contain negations, so motif
        membership is recomputed at each rung rather than filtered down from the one below, and
        the counts are not monotonic. See{' '}
        <Link to="/documentation/evidence-tiers">Evidence tiers</Link>.
      </span>,
    ],
  },
  {
    q: 'My protein or exposure is missing from a result. Was it not significant?',
    a: [
      'Check which of the two it is, because the site distinguishes them. "Not tested" and "tested, not significant" are shown differently in every empty state.',
      <span key="b">
        Several exposures — much of the deprivation and pollution set — map too few genome-wide
        loci to be instrumented, so they are absent from the Mendelian randomization results by
        construction rather than by failing a test. The instrument diagnostics are on{' '}
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
    q: 'Is there a DOI for the datasets?',
    a: [
      'No, by decision. Each dataset carries a version string and a build date so you can state exactly which release you used; the citation is always the paper.',
      <span key="b">
        Templates for a data statement are on <Link to="/documentation/cite">How to cite</Link>.
      </span>,
    ],
  },
  {
    q: 'Where does each number on this site come from?',
    a: [
      <span key="a">
        Nothing is typed by hand. Headline figures are read at page load from{' '}
        <Mono>meta/headline.json.gz</Mono>, which is generated from the manuscript’s LaTeX
        macros; every table and plot is read from a published payload object; and the covariate
        definitions come straight from the analysis configuration.
      </span>,
      <span key="b">
        Where a figure export and a supplementary table describe the same thing, the supplementary
        table is what the site reads, and the page says so.
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
              <QuizOutlinedIcon style={{ color: '#124533db', marginRight: '12px' }} />
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
        <SourceNote>
          HEAP itself should be cited as the preprint — see{' '}
          <Link to="/documentation/cite">How to cite</Link>.
        </SourceNote>
      </Section>
    </DocPage>
  );
}
