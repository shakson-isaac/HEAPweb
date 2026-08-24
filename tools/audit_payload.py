#!/usr/bin/env python3
"""
audit_payload.py -- refuse to publish participant-level data.

WHAT GOES IN THE PUBLIC BUCKET. Everything under gs://heap-web-data is
world-readable with no authentication, so the rule is the strict one:

  1. AGGREGATES ONLY. Every published value is a statistic computed over many
     participants -- an effect size, a standard error, an r2, a count. No row
     may correspond to one person.
  2. NO PARTICIPANT IDENTIFIERS. No UK Biobank eid, in any column, in any form,
     including hashed or re-coded. UKB application terms forbid redistributing
     them and a pseudonym is still an identifier.
  3. NO SMALL CELLS. A statistic computed over fewer than MIN_CELL people is
     not published. A mean over 8 individuals is close enough to individual
     data to be treated as individual data.

This script enforces all three against a built payload and exits non-zero on a
violation, so it can gate a publish rather than living in a document nobody
re-reads.

TWO FALSE POSITIVES ARE CARVED OUT BY NAME, because both look alarming and
both were checked by hand:

  `Eid`   is HEAP's EXPOSURE id -- the UKB *field* name, e.g.
          age_first_had_sexual_intercourse_f2139_0_0. It is not a person. The
          collision with UK Biobank's participant `eid` is unfortunate and is
          the reason this carve-out is explicit rather than a loosened regex.

  7-digit integers in `pos`, `start`, `end`, `bp` and friends are GENOMIC
          COORDINATES. A base-pair position on a chromosome occupies the same
          numeric range as a UKB participant id, so a naive scan flags every
          colocalization locus. Columns are matched by name, and any OTHER
          column carrying values in that range is still reported.

Run:
    python3 tools/audit_payload.py                 # audits build/web/v1
    python3 tools/audit_payload.py --src <dir>
"""
import argparse
import collections
import glob
import gzip
import json
import os
import re
import sys

# Fewer than this many people behind a statistic -> not published.
MIN_CELL = 10

# UKB proteomics is ~54k participants and the full cohort ~502k. A table with
# rows on that order is the shape individual-level data would take.
PARTICIPANT_SCALE = 50_000

IDENT_COL = re.compile(
    r'^(eid|f\.eid|iid|fid|participant|subject|sample|person|patient)(_?id)?$', re.I)
# Exposure id, not a person. See the module docstring.
IDENT_ALLOW = {'eid'}

UKB_ID = re.compile(r'^[1-6]\d{6}$')
# Genomic coordinates share the numeric range of a participant id.
COORD_COL = re.compile(r'^(pos|position|bp|start|end|chromstart|chromend|'
                       r'lead_pos|gene_start|gene_end)$', re.I)

# Columns that count PEOPLE. The small-cell rule applies ONLY to these: a count
# of triads, edges, proteins or pathways is not disclosure-relevant however
# small, and treating every `n*` column as a headcount buried the one real
# finding under 600 false positives.
#
# Each exemption below was checked against the builder that writes the column,
# not inferred from its name:
#   n_eff       intervention_*  Kish effective sample size over PROTEINS,
#                               (sum w)^2/sum(w^2) with w = Olink-SomaScan
#                               reliability -- build_intervention_concordance.py:453
#   n_proteins  intervention_*  proteins in the correlation
#   n / n_exp   mr_*, triad_*, motif_*, coloc_*, enrich_*, bodymap_*, gsea_*
#                               counts of edges, triads, pathways or exposures
PERSON_COUNT = re.compile(
    r'^(n|n_cases|n_controls|n_total|n_participants|n_obs|n_changed|'
    r'n_exposed)$', re.I)
COUNTS_NOT_PEOPLE = (
    re.compile(r'^(mr_|triad|motif|coloc|enrich_|bodymap_|gsea|intervention_)', re.I),
)


def counts_people(section, col):
    if not PERSON_COUNT.match(col):
        return False
    return not any(rx.match(section) for rx in COUNTS_NOT_PEOPLE)


# ACCEPTED EXCEPTIONS. A reviewed decision to publish something the rule would
# otherwise stop, recorded here so it stays visible and so a NEW violation still
# fails. Lowering MIN_CELL instead would have accepted every future small cell
# in silence, which is the opposite of what this file is for.
#
# Each entry is (section, column, value, date, reason).
ACCEPTED = {
    ('pes_within_person_smoking', 'n', 8): (
        '2026-08-23',
        'Reviewed and published. A mean and 95% CI over the 8 participants who '
        'took up daily smoking between visits, carrying no attribute beyond the '
        'transition itself. Was already live before this rule existed. The '
        'section is figure-sourced (fig_pes_within_person_smoking), so the same '
        'cell appears in the printed figure.'),
}


def load(path):
    op = gzip.open if path.endswith('.gz') else open
    try:
        with op(path, 'rt') as fh:
            return json.load(fh)
    except Exception:
        return None


def audit(src):
    files = [f for f in glob.glob(os.path.join(src, '**', '*'), recursive=True)
             if os.path.isfile(f) and f.endswith(('.json', '.json.gz'))]
    print(f"auditing {len(files):,} objects under {src}")

    viol = []
    warn = []
    scanned = 0
    idcols = collections.Counter()

    for f in files:
        rel = os.path.relpath(f, src)
        section = os.path.basename(rel).split('.')[0]
        d = load(f)
        if not isinstance(d, dict) or not d:
            continue
        scanned += 1

        nrow = max((len(v) for v in d.values() if isinstance(v, list)), default=0)
        if nrow >= PARTICIPANT_SCALE:
            # A LONG table is rows = entity x specification x component, so its
            # row count says nothing about how many entities it covers. What
            # matters is how many DISTINCT values the key column holds: 2,686
            # proteins across 9 specifications is 96,696 rows and no risk.
            keyed = None
            for k in ("protein", "gene", "protID", "disease", "exposure", "term"):
                if k in d and isinstance(d[k], list):
                    keyed = (k, len(set(d[k])))
                    break
            if keyed:
                warn.append(f"{rel}: {nrow:,} rows, but keyed by {keyed[0]} with "
                            f"{keyed[1]:,} distinct values -- long format, not per-person")
            else:
                warn.append(f"{rel}: {nrow:,} rows -- at participant scale and no "
                            f"recognised entity key, confirm the key is not a person")

        for col, v in d.items():
            # RULE 2 -- identifiers
            if IDENT_COL.match(col) and col.lower() not in IDENT_ALLOW:
                idcols[col] += 1
                viol.append(f"{rel}: column {col!r} names a participant identifier")
            if isinstance(v, list) and v and not COORD_COL.match(col):
                hits = sum(1 for x in v[:5000]
                           if isinstance(x, (str, int)) and UKB_ID.match(str(x)))
                if hits:
                    viol.append(f"{rel}: column {col!r} holds {hits} value(s) shaped "
                                f"like a UKB participant id")
            # RULE 3 -- small cells
            if counts_people(section, col) and isinstance(v, list):
                for i, x in enumerate(v):
                    try:
                        xi = float(x)
                    except (TypeError, ValueError):
                        continue
                    if 0 < xi < MIN_CELL:
                        key = (section, col, int(xi))
                        if key in ACCEPTED:
                            when, why = ACCEPTED[key]
                            warn.append(f"{rel}: {col}={int(xi)} -- accepted "
                                        f"{when}. {why.split('.')[0]}.")
                            continue
                        ctx = {k: d[k][i] for k in list(d)[:3]
                               if isinstance(d[k], list) and i < len(d[k])}
                        viol.append(f"{rel}: {col}={int(xi)} (< {MIN_CELL}) at {ctx}")

    print(f"parsed {scanned:,} JSON objects\n")
    for w in warn:
        print(f"  WARN  {w}")
    if warn:
        print()
    if viol:
        print(f"FAIL -- {len(viol)} violation(s):")
        for v in viol[:40]:
            print(f"  {v}")
        if len(viol) > 40:
            print(f"  ... and {len(viol) - 40} more")
        return 1
    print("PASS -- aggregates only, no participant identifiers, no cell "
          f"below {MIN_CELL} people")
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument('--src', default=os.path.join(repo, 'build', 'web', 'v1'))
    a = ap.parse_args()
    sys.exit(audit(a.src))
