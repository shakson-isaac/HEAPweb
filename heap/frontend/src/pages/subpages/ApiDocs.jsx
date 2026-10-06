import React from 'react';
import { Link } from 'react-router-dom';
import { Typography } from '@mui/material';
import {
  AuthorNote, Code, DocPage, Mono, P, Section, SimpleTable,
} from '../Documentation';

const BASE = 'https://storage.googleapis.com/heap-data/web/v1';

// Rewritten twice. The first version opened on the URL scheme, so a reader had
// to work out what was available from manifest.json.gz backwards. The second
// put a catalog of paths at the top, which named the objects but still never
// showed anyone using one. This version is organized as questions with the code
// that answers them; every output below was run against the live payload on
// 2026-10-05. The path scheme is kept at the bottom, as reference.
const PATHS = [
  ['e/protein/<SYMBOL>.json.gz', 'One protein, nine sections merged. SYMBOL is the hyphenated HGNC symbol (HLA-A).'],
  ['e/exposure/<ID>.json.gz', 'One exposure, eight sections merged. IDs are the UK Biobank variable names.'],
  ['s/<section>.json.gz', 'One whole section, columnar.'],
  ['k/<section>/<KEY>.json.gz', 'One key’s slice of a table too large to serve whole.'],
  ['k/<section>/_keys.json.gz', 'Which column a sharded section is keyed on, and every key.'],
  ['meta/headline.json.gz', 'Every manuscript macro: raw string, numeric value, and what it counts.'],
  ['meta/search_index.json.gz', 'All 2,686 proteins, 169 exposures and 72 diseases, with labels.'],
  ['manifest.json.gz', 'Page, section id, tier and object path for everything published.'],
  ['catalog.json.gz', 'The 37 supplementary datasets, with schema and build date.'],
];

export default function ApiDocs() {
  return (
    <DocPage
      title="Data API"
      lead="Every result on this site is a static file on a public CDN, and those files are the API. There is no key, no rate limit and no query language: you fetch an object and work on it locally. Four worked examples follow, then the reference."
    >
      <Section title="Which proteins respond to an exposure?">
        <P>
          Fetch that exposure&rsquo;s bundle. It carries the exposure against all 2,686 proteins,
          so the answer is a filter and a sort.
        </P>
        <Code label="R">
{`base <- "https://storage.googleapis.com/heap-data/web/v1"

smoking <- jsonlite::fromJSON(file.path(base,
  "e/exposure/pack_years_of_smoking_f20161_0_0.json.gz"))

assoc <- as.data.frame(smoking$expo_protein_assoc)
hits  <- subset(assoc, sig)
nrow(hits)
#> [1] 730

head(hits$protein[order(-hits$R2_Eblock)], 6)
#> [1] "CXCL17" "LAMP3"  "ALPP"   "WFDC2"  "PIGR"   "PRSS8"`}
        </Code>
        <P>
          The same bundle holds that exposure&rsquo;s G&times;E terms, its tissue and pathway
          enrichment, its instrument diagnostics and its exposure-score accuracy.{' '}
          <Mono>names(smoking)</Mono> lists all eight sections.
        </P>
      </Section>

      <Section title="What moves a protein?">
        <P>
          The mirror image. A protein&rsquo;s bundle carries it against all 169 exposures, together
          with its mediation results, its MR edges and its response in the intervention trials.
        </P>
        <Code label="Python">
{`import json, urllib.request
import pandas as pd

BASE = "https://storage.googleapis.com/heap-data/web/v1"

def heap(path):
    with urllib.request.urlopen(f"{BASE}/{path}") as r:
        return json.load(r)

asgr1 = heap("e/protein/ASGR1.json.gz")
list(asgr1)
#> ['mediation_main', 'mr_priority', 'gem_landscape', 'mediation_volcano',
#>  'mr_edges', 'exwas_miami', 'expo_protein_assoc', 'gxe_assoc',
#>  'intervention_scatter']

df  = pd.DataFrame(asgr1["expo_protein_assoc"])
top = df[df.sig].sort_values("R2_Eblock", ascending=False)
len(top)
#> 62
list(top.exposure_id[:3])
#> ['usual_walking_pace_f924_0_0',
#>  'time_spent_watching_television_tv_f1070_0_0',
#>  'pack_years_of_smoking_f20161_0_0']`}
        </Code>
      </Section>

      <Section title="How do I pull a whole result table?">
        <P>
          Small tables are served whole under <Mono>s/</Mono>. Large ones are split by key under{' '}
          <Mono>k/</Mono>, so you fetch the slice you need rather than the whole table.
        </P>
        <Code label="R — a whole section">
{`motifs <- as.data.frame(
  jsonlite::fromJSON(file.path(base, "s/mr_motif_counts.json.gz"))
)
motifs
#>                        motif tier1_triads tier1_proteins nominal_triads nominal_proteins
#> 1       A Mediator (E->P->D)            6              3             84               25
#> 2                B Biomarker         1368            326           2232              404
#> 3          C Exposure-marker         4591            460           4829              444
#> 4           D Reverse (P->E)           30              4            722               41
#> 5 E Disease-liability (D->P)        14273            490          17999              550`}
        </Code>
        <Code label="R — one slice of a sharded table">
{`keys <- jsonlite::fromJSON(file.path(base, "k/assoc_base/_keys.json.gz"))
keys$key_column
#> [1] "Protein"

lep <- as.data.frame(
  jsonlite::fromJSON(file.path(base, "k/assoc_base/LEP.json.gz"))
)`}
        </Code>
      </Section>

      <Section title="How do I check a number from the paper?">
        <P>
          Every figure quoted in the manuscript is published as a macro, with a note saying what it
          counts.
        </P>
        <Code label="R">
{`h <- jsonlite::fromJSON(file.path(base, "meta/headline.json.gz"))

h$macros$nProteins$value
#> [1] 2686
h$macros$nProteins$note
#> [1] "proteins in the analyzed panel (Module 1)"`}
        </Code>
        <P>
          If you do not know an exact protein, exposure or disease id, resolve it first against{' '}
          <Mono>meta/search_index.json.gz</Mono>, which lists every one with its label and category.
        </P>
      </Section>

      <Section title="What you may do with it">
        <P>
          The data are released under{' '}
          <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer">
            CC BY-NC-ND 4.0
          </a>
          : redistribute with attribution, non-commercially. If you use summary statistics or data
          from this site, cite the preprint &mdash; see{' '}
          <Link to="/documentation/cite">How to cite</Link>. Everything served here is summary
          statistics; no individual-level UK Biobank data appears on this site.
        </P>
      </Section>

      <Section title="The paths">
        <Code>{BASE}</Code>
        <SimpleTable
          head={['Path', 'What it returns']}
          rows={PATHS.map(([path, what]) => [<Mono>{path}</Mono>, what])}
        />
      </Section>

      <Section title="Shape and transport">
        <P>
          Sections and shards are <b>columnar</b> &mdash; an object of arrays, so the repeated key
          names are stored once rather than once per row. Both <Mono>data.frame</Mono> in R and{' '}
          <Mono>pd.DataFrame</Mono> in Python accept that directly. An entity bundle is one level
          deeper: an object keyed by section id, each value one columnar table.
        </P>
        <Code label="s/mr_motif_counts.json.gz, abbreviated">
{`{
  "motif":          ["A Mediator (E->P->D)", "B Biomarker", ...],
  "tier1_triads":   [6, 1368, ...],
  "tier1_proteins": [3, 326, ...],
  "nominal_triads": [84, 2232, ...]
}`}
        </Code>
        <SimpleTable
          head={['Property', 'Value']}
          rows={[
            ['Authentication', 'none'],
            ['Rate limit', 'none'],
            ['CORS', <Mono>access-control-allow-origin: *</Mono>],
            ['Encoding', <span>objects are stored gzipped and served with <Mono>content-encoding: gzip</Mono>. Any client that negotiates gzip (every browser, R&rsquo;s curl, Python&rsquo;s urllib) receives plain JSON</span>],
            ['Versioning', <span>the <Mono>/v1/</Mono> prefix changes on a breaking schema change. New content keeps the prefix</span>],
            ['Caching', <span><Mono>max-age=60</Mono> on entry points, longer on content shards</span>],
          ]}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          A client that sets <Mono>Accept-Encoding: gzip</Mono> by hand must also decompress the
          response. The examples above leave the header to the library.
        </Typography>
      </Section>

      <Section title="Two things this API does not do">
        <SimpleTable
          head={['', 'Instead']}
          rows={[
            [
              'Filter on the server',
              'There are no query parameters. Fetch the bundle or the shard and filter locally, as every example above does.',
            ],
            [
              'Serve the exposure GWAS',
              <span>
                The 169 summary-statistic files are 51 GB and sit apart, in{' '}
                <Mono>gs://heap-gwas</Mono>, where transfer is billed to the project you name.
                Their catalog is public at <Mono>meta/gwas_manifest.json.gz</Mono>, and{' '}
                <Link to="/downloads">Downloads</Link> lists every exposure with its fetch command.
              </span>,
            ],
          ]}
        />
      </Section>

      <AuthorNote what="Bulk supplementary deposit — not documented here yet.">
        A second prefix on the same bucket stages the full supplementary deposit as gzipped TSVs
        (all five association specifications, the MR edge table, the variance decomposition, the
        mediation results and the per-exposure exposure-score weights). Those URLs resolve today,
        but advertising them is exactly the question left open as blocker B2 — the UK Biobank
        posture on publishing derived summary statistics and score weights. They are left out of
        this page until you confirm.
      </AuthorNote>
    </DocPage>
  );
}
