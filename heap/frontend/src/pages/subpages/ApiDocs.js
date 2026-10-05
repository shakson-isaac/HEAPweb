import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import {
  AuthorNote, Code, DocPage, Mono, P, Section, SimpleTable,
} from '../Documentation';

const BASE = 'https://storage.googleapis.com/heap-data/web/v1';

// This page used to open with the URL scheme: base URL, then manifest.json.gz,
// then the object layout. A reader asking "what can I get out of this?" had to
// assemble the answer themselves from the most abstract object on the page.
// It now opens with what is available, in the reader's terms, and keeps the
// scheme below for anyone writing a client. The per-row "returns 200" chips
// went with it -- they recorded that we had checked the links, which is our
// business, not the reader's.
const WANTS = [
  {
    want: 'Everything about one protein',
    path: 'e/protein/<SYMBOL>.json.gz',
    example: 'e/protein/ASGR1.json.gz',
    detail: 'Nine sections in one request: its exposure associations, G×E, mediation, MR edges, intervention response. SYMBOL is the hyphenated HGNC symbol, such as HLA-A.',
  },
  {
    want: 'Everything about one exposure',
    path: 'e/exposure/<ID>.json.gz',
    example: 'e/exposure/pack_years_of_smoking_f20161_0_0.json.gz',
    detail: 'The same shape, keyed by exposure. IDs are the UK Biobank variable names used throughout HEAP and listed in the Exposome dictionary.',
  },
  {
    want: 'One result table, whole',
    path: 's/<section>.json.gz',
    example: 's/mr_motif_counts.json.gz',
    detail: 'A complete section, columnar. Section ids come from the manifest.',
  },
  {
    want: 'One slice of a table too big to fetch whole',
    path: 'k/<section>/<KEY>.json.gz',
    example: 'k/assoc_base/LEP.json.gz',
    detail: 'The large association tables are sharded by protein. Read _keys.json.gz in the same folder to learn which column they are keyed on.',
  },
  {
    want: 'The headline numbers from the paper',
    path: 'meta/headline.json.gz',
    example: 'meta/headline.json.gz',
    detail: 'Every manuscript macro with its raw string, numeric value and a note on what it counts.',
  },
  {
    want: 'The list of every protein, exposure and disease',
    path: 'meta/search_index.json.gz',
    example: 'meta/search_index.json.gz',
    detail: '2,686 proteins, 169 exposures and 72 diseases, with labels and categories. Use it to resolve a name before fetching its bundle.',
  },
  {
    want: 'What sections exist, and which page draws them',
    path: 'manifest.json.gz',
    example: 'manifest.json.gz',
    detail: 'Page, section id, tier and object path for everything published.',
  },
  {
    want: 'The datasets behind the supplement',
    path: 'catalog.json.gz',
    example: 'catalog.json.gz',
    detail: '37 datasets with title, sheet, source path, row and column counts, column names and build date.',
  },
];

export default function ApiDocs() {
  return (
    <DocPage
      title="Data API"
      lead="Every result on this site is a static file on a public CDN, and those files are the API. No key, no rate limit, no query language: you fetch an object and filter it yourself."
    >
      <Section
        title="What you can fetch"
        subtitle="Each path is relative to the base URL below. Click an example to see the object."
      >
        <SimpleTable
          head={['If you want', 'Fetch', 'What comes back']}
          rows={WANTS.map((w) => [
            w.want,
            // A path with no placeholder IS its own example; printing both
            // put the same string on two lines.
            w.path === w.example ? (
              <a href={`${BASE}/${w.example}`} target="_blank" rel="noopener noreferrer">
                <Mono>{w.path}</Mono>
              </a>
            ) : (
              <Box>
                <Mono>{w.path}</Mono>
                <Box sx={{ mt: 0.5 }}>
                  <a href={`${BASE}/${w.example}`} target="_blank" rel="noopener noreferrer">
                    <Mono>{w.example}</Mono>
                  </a>
                </Box>
              </Box>
            ),
            w.detail,
          ])}
        />
      </Section>

      <Section title="Start here">
        <P>
          One protein, everything HEAP knows about it, in a single request:
        </P>
        <Code label="R">
{`base <- "https://storage.googleapis.com/heap-data/web/v1"

asgr1 <- jsonlite::fromJSON(file.path(base, "e/protein/ASGR1.json.gz"))
names(asgr1)
#> [1] "mediation_main"    "mr_priority"    "gem_landscape"  "mediation_volcano"
#> [5] "mr_edges"          "exwas_miami"    "expo_protein_assoc"
#> [8] "gxe_assoc"         "intervention_scatter"

head(as.data.frame(asgr1$expo_protein_assoc))`}
        </Code>
        <Code label="Python">
{`import json, urllib.request

BASE = "https://storage.googleapis.com/heap-data/web/v1"

def heap(path):
    with urllib.request.urlopen(f"{BASE}/{path}") as r:
        return json.load(r)

asgr1 = heap("e/protein/ASGR1.json.gz")
list(asgr1)[:4]
#> ['mediation_main', 'mr_priority', 'gem_landscape', 'mediation_volcano']`}
        </Code>
      </Section>

      <Section title="What you may do with it">
        <P>
          The data are released under{' '}
          <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer">
            CC BY-NC-ND 4.0
          </a>
          : redistribute with attribution, non-commercially. Cite the paper, not the files —
          datasets carry a version and a build date but no separate DOI. See{' '}
          <Link to="/documentation/cite">How to cite</Link>. The objects are summary statistics
          only; no individual-level UK Biobank data is served here or anywhere on this site.
        </P>
      </Section>

      <Section title="Base URL and transport">
        <Code>{BASE}</Code>
        <SimpleTable
          head={['Property', 'Value']}
          rows={[
            ['Authentication', 'none'],
            ['Rate limit', 'none'],
            ['CORS', <Mono>access-control-allow-origin: *</Mono>],
            ['Encoding', <span>objects are stored gzipped and served with <Mono>content-encoding: gzip</Mono>. Any client that negotiates gzip (every browser, R’s curl, Python’s urllib) receives plain JSON</span>],
            ['Versioning', <span>the <Mono>/v1/</Mono> prefix changes on a breaking schema change. New content keeps the prefix</span>],
            ['Caching', <span><Mono>max-age=60</Mono> on entry points, longer on content shards</span>],
          ]}
        />
      </Section>

      <Section title="Data shape">
        <P>
          Sections and shards are <b>columnar</b>: an object of arrays. Dropping the repeated key
          names saves most of the bytes on the large tables. An entity bundle is one level deeper,
          an object keyed by section id, each holding one columnar table.
        </P>
        <Code label="s/mr_motif_counts.json.gz, abbreviated">
{`{
  "motif":          ["A Mediator (E->P->D)", "B Biomarker", ...],
  "tier1_triads":   [6, 1368, ...],
  "tier1_proteins": [3, 326, ...],
  "nominal_triads": [84, 2232, ...]
}`}
        </Code>
        <P>
          Both <Mono>data.frame</Mono> in R and <Mono>pd.DataFrame</Mono> in Python accept that
          shape directly.
        </P>
      </Section>

      <Section title="More examples">
        <Code label="R — a whole section as a data frame">
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
        <Code label="R — a headline number">
{`h <- jsonlite::fromJSON(file.path(base, "meta/headline.json.gz"))
h$macros$nProteins$value
#> [1] 2686`}
        </Code>
        <Code label="R — discover, then fetch a sharded table">
{`m <- jsonlite::fromJSON(file.path(base, "manifest.json.gz"))
subset(m$pages, page == "causal")$sections[[1]][, c("section_id", "tier")]

keys <- jsonlite::fromJSON(file.path(base, "k/assoc_base/_keys.json.gz"))
keys$key_column
#> [1] "Protein"
lep <- as.data.frame(
  jsonlite::fromJSON(file.path(base, "k/assoc_base/LEP.json.gz"))
)`}
        </Code>
        <Code label="Python — with pandas">
{`import pandas as pd

# a columnar section is already a DataFrame constructor argument
motifs = pd.DataFrame(heap("s/mr_motif_counts.json.gz"))

# one shard of a sharded table
lep = pd.DataFrame(heap("k/assoc_base/LEP.json.gz"))

# one section inside an entity bundle
assoc = pd.DataFrame(heap("e/protein/ASGR1.json.gz")["expo_protein_assoc"])`}
        </Code>
        <Code label="curl">
{`curl -s ${BASE}/meta/headline.json.gz | python3 -m json.tool | head

# list what exists, straight from the bucket
curl -s "https://storage.googleapis.com/storage/v1/b/heap-data/o?prefix=web/v1/&delimiter=/"`}
        </Code>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          A client that sets <Mono>Accept-Encoding: gzip</Mono> by hand must also decompress the
          response. The blocks above leave the header to the library.
        </Typography>
      </Section>

      <Section title="Two things this API does not do">
        <SimpleTable
          head={['', 'Instead']}
          rows={[
            [
              'Filter on the server',
              'There are no query parameters. Fetch the section or the shard and filter locally; sharding keeps a per-protein slice to one small object.',
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
