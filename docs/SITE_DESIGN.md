# SITE_DESIGN — how heap.bio should be organized

Opened 2026-08-26. A design argument, not a task list; the tasks it generates go
to `SITE_CHECKLIST.md`. Written after the first browser-driven audits, which
found 14 of 24 routes unreachable by clicking and 12,139 rendered words.

---

## 1. The diagnosis: the site is paper-shaped

The results section is organized by **analysis module**:

> Main Results · Lifestyle Categories · Associations · Interactions ·
> Disease Links · Interventions · Tissues & Pathways · Causal Evidence ·
> PES · GWAS

That is the manuscript's table of contents. It is the right structure for a
reader going through the argument once, front to back — and the wrong structure
for almost everyone who will actually arrive.

Nobody lands on a resource site wanting "module 3". They arrive with

- **an entity** — a protein they study, an exposure they care about, a disease
  they work on; or
- **a question** — "is there causal evidence for this link?", "how do I cite
  this?", "where is the table?"

Neither maps onto a module. A visitor who studies LEP must currently guess
which of ten pages mentions LEP, then find it again on each of the others,
with no way to link to what they found.

**The test:** a good resource lets a stranger reach what they came for without
knowing how the analysis was subdivided. HEAP currently requires them to know.

---

## 2. What comparable resources converge on

These are conventions the major biological resources have arrived at
independently, which is the main reason to take them seriously.

**Entity-first, search-forward.** UniProt, the Human Protein Atlas and gnomAD
all put a search box at the centre of the front door and treat the entity page
as the atomic unit. Browsing is secondary to looking something up.

**Stable, citable URLs per entity.** A UniProt accession resolves to a page
that can be cited in a paper and will still resolve later. This is the single
convention HEAP most clearly lacks — see §4.

**One entity, consistent sections.** HPA shows each protein across several
"atlases" with the same tabs every time. The visitor learns the layout once.
GTEx does the same with gene × tissue as two axes into one dataset.

**Evidence stacked by provenance, and scored.** Open Targets is the closest
conceptual analogue to HEAP: it assembles target–disease associations from many
sources, shows each source's evidence separately, and makes the tiering
explicit rather than collapsing everything to one number. HEAP already has this
shape — variance partition, association, mediation, MR/coloc, PES are five
evidence types over the same protein–exposure–disease triangle.

**Dataset version as a first-class, in-URL control.** gnomAD makes the release
(v2 / v4) a prominent selector, because results depend on it. **HEAP's exact
analogue is the covariate specification.** Five specs already exist and change
every number on the page; they belong in the URL for the same reason a gnomAD
version does.

**Downloads, API and documentation live in the persistent header.** In UniProt
and the GWAS Catalog these are never more than one click away, from anywhere.
On HEAP they are currently unreachable by clicking at all.

---

## 3. HEAP's entities, and what the payload already supports

This is not aspirational — the sharded payload is already keyed this way.
22 sections are per-key (tier K):

| entity | sharded sections keyed by it |
|---|---|
| **protein** | 11 — the five `assoc_*` specs, `mr_priority`, `gem_landscape`, `mediation_proportion`, `mr_pd_effects`, `protein_tissue_profile`, `med_drivers` |
| **exposure** | 6 — `intervention_scatter`, `gxe_assoc`, `pes_disease`, `intervention_concordance` (+full), `bodymap_leading_edge` |
| **disease** | 3 — `intervention_network_nodes`, `..._edges`, `med_dz_links` |
| **locus** | 2 — `mr_coloc_locus`, `mr_coloc_genes` |

**A protein page is already buildable.** Eleven sections resolve by protein at
roughly 1–2 KB each; the whole page is a handful of small fetches, not a
2 MB download.

### The blocker, stated precisely

Those 11 protein-keyed sections use **four different key column names** —
`Protein` (5), `protID` (4), `protein` (1), `gene` (1). Any unified entity page
has to reconcile them first. There is a second, known trap on top: four HGNC
symbols are spelled two ways across export families (`HLA-A` vs `HLA_A` and
three others), so a naive join silently misses.

Fixing the key namespace is the real prerequisite for entity pages. It is
invisible work that unblocks the most visible feature.

---

## 4. Practical use cases

The set the design should be judged against. Current status measured
2026-08-26.

| # | someone arrives wanting… | today |
|---|---|---|
| 1 | everything HEAP knows about **one protein** | ✗ scattered over ~6 pages, no per-protein view above the fold |
| 2 | which proteins report **one exposure** | ~ partly, per page |
| 3 | causal evidence for **protein → disease** | ~ on `/results/causal`, not reachable from a protein |
| 4 | the **table**, to reanalyse themselves | ✓ `/downloads` (but it is a dead end) |
| 5 | **how it was computed** | ✗ `/documentation/methods` orphaned |
| 6 | **how to cite** | ✗ `/documentation/cite` orphaned |
| 7 | what **Tier 1** means | ✗ `/documentation/evidence-tiers` orphaned |
| 8 | to **send a colleague this exact view** | ✗ only Mediation has URL state |
| 9 | to see a result **under a different specification** | ~ per-page selectors, not in the URL, not consistent |

Five of nine fail outright. Four of those five are one navigation change.

---

## 5. Proposed structure

### Persistent header — from anywhere

```
[HEAP]  search: protein / exposure / disease      Browse ▾  Documentation ▾  Downloads  API
```

`Browse ▾` holds the current results pages, which remain useful as
*overviews* — they answer "what does the whole proteome look like", which an
entity page cannot. `Documentation ▾` holds the eleven orphans.

This alone fixes use cases 5, 6 and 7, and un-strands three results pages.

### Entity pages — the new layer

`/protein/LEP` with the same sections in the same order for every protein:

1. **What varies it** — variance partition, this protein's row
2. **What it reports** — top exposure associations
3. **Where it leads** — mediation to disease
4. **Is it causal** — MR tier, coloc
5. **Is it used** — PES panel membership
6. **Downloads** — this protein's rows from every table

Each section is a small fetch from an existing shard. Sections with no data say
so plainly — a protein with no cis/trans variants is a real zero, not a bug.

`/exposure/<id>` and `/disease/<id>` follow the same pattern on their own
entities.

### Specification as a global control

One selector, in the header or pinned per page, written to the URL
(`?spec=base_bmi`) so a shared link carries it. `useUrlState` already does
this; `lib/covariateSpecs.js` already holds the five specs and both id spaces.

---

## 6. What NOT to copy

These resources are built by teams over years. Copying their *surface* while
having one maintainer produces a site that looks abandoned within a year.

- **No faceted-search engine.** 2,686 proteins is a dropdown, not Elasticsearch.
- **No per-entity permalink registry / DOI minting.** A stable path is enough.
- **No user accounts, saved searches or baskets.** Nothing here needs identity.
- **Do not multiply entity types.** Protein, exposure, disease. Tissue and
  pathway stay as views, not entities, until something demands otherwise.
- **Do not put every module on the entity page.** Six sections is the budget;
  the overview pages absorb the rest.

The honest constraint: every feature here has to survive being unmaintained for
six months. Static shards and plain URLs do. Anything with a server does not —
which is also the argument for retiring Cloud Run rather than building on it.

---

## 7. Sequencing

Ordered so each step is useful on its own and the risky work comes last.

1. **Header navigation.** Fixes 14 orphans and 3 use cases. No data work, no
   prose decisions. Do this first.
2. **URL state everywhere.** 19 remaining pickers onto `useUrlState`. Makes
   every view linkable — the prerequisite for anything being citable.
3. **Reconcile the protein key namespace.** `Protein` / `protID` / `protein` /
   `gene` → one, plus the HLA alias map. Invisible, unblocks step 5.
4. **Specification in the URL**, one control, consistent across pages.
5. **`/protein/<symbol>`.** The first entity page. Judge it on use case 1
   before building `/exposure` or `/disease`.
6. **Search box** on the front door, once entity pages exist to search into.

Steps 1 and 2 are worth doing regardless of whether entity pages ever happen.

---

## 8. Open questions

- Do the overview pages keep their current names? "Lifestyle Categories" and
  "Disease Links" are the site's words; "Main Results" is the paper's. A
  stranger cannot tell what "Main Results" contains.
- Does `/results/summary` survive entity pages, or become the exposure browse?
- Is the front door a search box, or the current cards? Resource convention
  says search; the counter-argument is that HEAP has a *claim* to make, and a
  search box makes no argument.
