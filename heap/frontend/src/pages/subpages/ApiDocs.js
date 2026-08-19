import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Chip } from '@mui/material';
import {
  AuthorNote, Code, DocPage, Mono, P, Section, SimpleTable, SourceNote,
} from '../Documentation';

const BASE = 'https://storage.googleapis.com/heap-web-data/web/v1';

// Every row below was requested over HTTPS and returned 200 on 2026-08-18.
// The status column is a record of that check, not a live probe.
const ENDPOINTS = [
  {
    path: 'manifest.json.gz',
    what: 'Every published section: page, section id, tier, object path. The entry point — resolve a section id here before fetching it.',
    example: 'manifest.json.gz',
  },
  {
    path: 'catalog.json.gz',
    what: 'The 37 datasets behind the supplement: title, sheet, group, source path, row and column counts, column names, build date.',
    example: 'catalog.json.gz',
  },
  {
    path: 'meta/headline.json.gz',
    what: 'The manuscript headline numbers, parsed from macros/numbers.tex. Each macro carries its raw string, numeric value and a note.',
    example: 'meta/headline.json.gz',
  },
  {
    path: 'meta/search_index.json.gz',
    what: 'Every searchable entity: 2,686 proteins, 169 exposures, 72 diseases, with labels and categories.',
    example: 'meta/search_index.json.gz',
  },
  {
    path: 'e/protein/<SYMBOL>.json.gz',
    what: 'One merged bundle per protein — nine sections joined at build time, so a protein page is one request. SYMBOL is the true HGNC symbol (HLA-A, not HLA_A).',
    example: 'e/protein/ASGR1.json.gz',
  },
  {
    path: 'e/exposure/<ID>.json.gz',
    what: 'The same, keyed by exposure id. IDs are the UK Biobank variable names used throughout HEAP.',
    example: 'e/exposure/pack_years_of_smoking_f20161_0_0.json.gz',
  },
  {
    path: 'e/<entity>/_index.json.gz',
    what: 'Which keys exist for an entity tier, plus the sections merged into each bundle and their byte sizes.',
    example: 'e/exposure/_index.json.gz',
  },
  {
    path: 's/<section>.json.gz',
    what: 'One whole section, columnar. Section ids come from manifest.json.gz; tier S sections are small enough to fetch whole.',
    example: 's/mr_motif_counts.json.gz',
  },
  {
    path: 'k/<section>/_keys.json.gz',
    what: 'The key index for a sharded section: which key column it is sharded on, and the shard filename for every key.',
    example: 'k/assoc_base/_keys.json.gz',
  },
  {
    path: 'k/<section>/<KEY>.json.gz',
    what: 'One key’s slice of a large table. The key column itself is not repeated inside the shard.',
    example: 'k/assoc_base/LEP.json.gz',
  },
];

export default function ApiDocs() {
  return (
    <DocPage
      title="Data API"
      lead="Every page on this site is built from static objects on a public CDN, and those objects are the API. There is no server, no authentication, no rate limit and no cold start — the frontend and the public API are the same files."
    >
      <Section title="Base URL">
        <Code>{BASE}</Code>
        <SimpleTable
          head={['Property', 'Value']}
          rows={[
            ['Authentication', 'none'],
            ['Rate limit', 'none'],
            ['CORS', <Mono>access-control-allow-origin: *</Mono>],
            ['Encoding', <span>objects are stored gzipped and served with <Mono>content-encoding: gzip</Mono>; any client that negotiates gzip (every browser, R’s curl, Python’s urllib) receives plain JSON</span>],
            ['Versioning', <span>the <Mono>/v1/</Mono> prefix changes only on a breaking schema change. New content never bumps it</span>],
            ['Caching', <span><Mono>max-age=60</Mono> on entry points, longer on content shards</span>],
          ]}
        />
        <SourceNote>
          response headers observed on <Mono>catalog.json.gz</Mono>;{' '}
          <Mono>docs/WEBSITE_PLAN.md</Mono> §7 and §15.
        </SourceNote>
      </Section>

      <Section
        title="Endpoints"
        subtitle="Each example URL below was requested and returned 200 on 2026-08-18."
      >
        <SimpleTable
          head={['Path', 'What it returns', 'Verified example']}
          rows={ENDPOINTS.map((e) => [
            <Mono>{e.path}</Mono>,
            e.what,
            <Box>
              <a href={`${BASE}/${e.example}`} target="_blank" rel="noopener noreferrer">
                <Mono>{e.example}</Mono>
              </a>
              <Chip size="small" label="200" sx={{ ml: 1, height: 18, backgroundColor: '#124533', color: '#fff' }} />
            </Box>,
          ])}
        />
      </Section>

      <Section title="Data shape">
        <P>
          Sections and shards are <b>columnar</b>: an object of arrays, not an array of objects.
          Dropping the repeated key names is most of the bytes on the large tables. An entity
          bundle is one level deeper — an object keyed by section id, each holding one columnar
          table.
        </P>
        <Code label="s/mr_motif_counts.json.gz, abbreviated">
{`{
  "motif":          ["A Mediator (E->P->D)", "B Biomarker", ...],
  "tier1_triads":   [6, 1353, ...],
  "tier1_proteins": [3, 325, ...],
  "nominal_triads": [84, 2232, ...]
}`}
        </Code>
        <P>
          Both <Mono>data.frame</Mono> in R and <Mono>pd.DataFrame</Mono> in Python accept that
          shape directly.
        </P>
      </Section>

      <Section title="R">
        <Code label="One section as a data frame">
{`base <- "https://storage.googleapis.com/heap-web-data/web/v1"

motifs <- as.data.frame(
  jsonlite::fromJSON(file.path(base, "s/mr_motif_counts.json.gz"))
)
motifs
#>                        motif tier1_triads tier1_proteins nominal_triads nominal_proteins
#> 1       A Mediator (E->P->D)            6              3             84               25
#> 2                B Biomarker         1353            325           2232              404
#> 3          C Exposure-marker         4499            450           4829              444
#> 4           D Reverse (P->E)           30              4            722               41
#> 5 E Disease-liability (D->P)        12892            469          17999              550`}
        </Code>
        <Code label="One protein, everything, in one request">
{`asgr1 <- jsonlite::fromJSON(file.path(base, "e/protein/ASGR1.json.gz"))
names(asgr1)
#> [1] "mediation_main"    "mr_priority"    "gem_landscape"  "mediation_volcano"
#> [5] "mr_edges"          "exwas_miami"    "expo_protein_assoc"
#> [8] "gxe_assoc"         "intervention_scatter"

head(as.data.frame(asgr1$expo_protein_assoc))`}
        </Code>
        <Code label="A headline number, so nothing is hand-typed">
{`h <- jsonlite::fromJSON(file.path(base, "meta/headline.json.gz"))
h$macros$nProteins$value
#> [1] 2686`}
        </Code>
        <Code label="Discover, then fetch: every section on a page">
{`m <- jsonlite::fromJSON(file.path(base, "manifest.json.gz"))
subset(m$pages, page == "causal")$sections[[1]][, c("section_id", "tier")]

# a sharded table: read the key index, then one key
keys <- jsonlite::fromJSON(file.path(base, "k/assoc_base/_keys.json.gz"))
keys$key_column
#> [1] "Protein"
lep <- as.data.frame(
  jsonlite::fromJSON(file.path(base, "k/assoc_base/LEP.json.gz"))
)`}
        </Code>
        <SourceNote>
          the first three blocks were executed against the live bucket with R 4.4.2 and{' '}
          <Mono>jsonlite</Mono> on 2026-08-18; the printed output is the real output.
        </SourceNote>
      </Section>

      <Section title="Python">
        <Code label="Standard library only">
{`import json, urllib.request

BASE = "https://storage.googleapis.com/heap-web-data/web/v1"

def heap(path):
    with urllib.request.urlopen(f"{BASE}/{path}") as r:
        return json.load(r)

motifs = heap("s/mr_motif_counts.json.gz")
list(motifs)
#> ['motif', 'tier1_triads', 'tier1_proteins', 'nominal_triads', 'nominal_proteins']

asgr1 = heap("e/protein/ASGR1.json.gz")
list(asgr1)[:4]
#> ['mediation_main', 'mr_priority', 'gem_landscape', 'mediation_volcano']`}
        </Code>
        <Code label="With pandas">
{`import pandas as pd

# a columnar section is already a DataFrame constructor argument
motifs = pd.DataFrame(heap("s/mr_motif_counts.json.gz"))

# one shard of a sharded table
lep = pd.DataFrame(heap("k/assoc_base/LEP.json.gz"))

# one section inside an entity bundle
assoc = pd.DataFrame(heap("e/protein/ASGR1.json.gz")["expo_protein_assoc"])`}
        </Code>
        <SourceNote>
          the standard-library block was executed against the live bucket on 2026-08-18. If a
          client sets <Mono>Accept-Encoding: gzip</Mono> by hand it must also decompress the
          response itself; leaving the header alone is simpler and is what the block above does.
        </SourceNote>
      </Section>

      <Section title="curl">
        <Code>
{`curl -s ${BASE}/meta/headline.json.gz | python3 -m json.tool | head

# list what exists, straight from the bucket
curl -s "https://storage.googleapis.com/storage/v1/b/heap-web-data/o?prefix=web/v1/&delimiter=/"`}
        </Code>
      </Section>

      <Section title="Deliberate non-goals, and what does not exist yet">
        <SimpleTable
          head={['Not offered', 'Status', 'Do this instead']}
          rows={[
            [
              'Server-side filtering or query parameters',
              'by design',
              'Fetch the section or the shard and filter locally. Sharded sections exist precisely so that a per-entity slice is a single small object.',
            ],
            [
              <Mono>table/&lt;KEY&gt;.parquet</Mono>,
              <Chip size="small" label="404 — not published" variant="outlined" />,
              <span>Planned in <Mono>WEBSITE_PLAN.md</Mono> §7 but not in the pipeline yet (gap G9). Use the JSON sections.</span>,
            ],
            [
              <Mono>table/&lt;KEY&gt;.tsv</Mono>,
              <Chip size="small" label="404 — not published" variant="outlined" />,
              'Same. The bucket currently holds four prefixes only: the two entry-point objects, and e/, k/, meta/, s/.',
            ],
            [
              <span><Mono>disease/</Mono> and <Mono>triad/</Mono> entity bundles</span>,
              <Chip size="small" label="404 — not published" variant="outlined" />,
              <span>Only <Mono>e/protein/</Mono> and <Mono>e/exposure/</Mono> tiers are built today.</span>,
            ],
          ]}
        />
        <SourceNote>
          each row was checked against the bucket on 2026-08-18; the prefix listing is the
          authoritative answer to what exists.
        </SourceNote>
      </Section>

      <AuthorNote what="Bulk supplementary deposit — not documented here yet.">
        A second prefix on the same bucket stages the full supplementary deposit as gzipped TSVs
        (all five association specifications, the MR edge table, the variance decomposition, the
        mediation results and the per-exposure exposure-score weights). Those URLs resolve today,
        but advertising them is exactly the question left open as blocker B2 — the UK Biobank
        posture on publishing derived summary statistics and score weights. They are left out of
        this page until you confirm.
      </AuthorNote>

      <Section title="Related">
        <P>
          The dataset behind each endpoint, with its schema and build date, is listed in{' '}
          <Mono>catalog.json.gz</Mono>. For what the columns mean, see{' '}
          <Link to="/documentation/methods">Detailed methods</Link> and{' '}
          <Link to="/documentation/models">Specifications</Link>; for how to cite a specific
          build, <Link to="/documentation/cite">How to cite</Link>.
        </P>
      </Section>
    </DocPage>
  );
}
