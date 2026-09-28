#!/usr/bin/env python3
"""Canonical entity identifiers for the HEAP website.

HEAP's loader deliberately makes protein ids R-safe -- `HEAP_loader.R:870` does
`gsub("-", "_", prot_id)` -- so four proteins reach the figure exports spelled
two different ways depending on which family produced them:

    true HGNC symbol      ERVV-1   HLA-A   HLA-DRA   HLA-E
    R-safe (mangled)      ERVV_1   HLA_A   HLA_DRA   HLA_E

The ExWAS family (fig_expo_protein_assoc, fig_exwas_miami, fig_gxe_assoc) keeps
the true symbol; the mediation/MR family does not. Each family carries exactly
2,686 proteins and the sets are identical once normalized, so this is a spelling
split, not a set difference -- a naive union double-counts and reports 2,690.

The site publishes the TRUE symbol everywhere, because that is what joins to
UniProt, HGNC and every external resource. Underscore forms are kept as aliases
so an incoming request for either spelling resolves.

Composite assay names (AMY1A_AMY1B_AMY1C, EBI3_IL27, ...) legitimately contain
underscores in BOTH families and are left exactly as they are -- only a key
whose normalized form matches a known hyphenated symbol is rewritten.
"""
import json
import os

# The export that carries true HGNC symbols; used to learn the canonical set.
CANONICAL_SOURCE = ("fig_expo_protein_assoc.json", "protein")

_cache = {}


def _norm(key):
    return str(key).replace("-", "_").upper()


def protein_canon(source_dir):
    """{normalized -> true symbol} learned from the ExWAS-family export."""
    if source_dir in _cache:
        return _cache[source_dir]
    fname, col = CANONICAL_SOURCE
    path = os.path.join(source_dir, fname)
    canon = {}
    if os.path.exists(path):
        with open(path) as f:
            for rec in json.load(f):
                v = rec.get(col)
                if v:
                    canon[_norm(v)] = v
    _cache[source_dir] = canon
    return canon


def canonical_protein(key, canon):
    """True symbol for a protein key, or the key unchanged if unknown."""
    return canon.get(_norm(key), key)


def canonicalize_keys(keys, canon):
    """Map a list of protein keys to canonical spellings.

    Returns (mapping, aliases) where mapping is key -> canonical and aliases is
    {mangled: canonical} for the ones that actually changed, so the change is
    reported rather than silent.
    """
    mapping, aliases = {}, {}
    for k in keys:
        c = canonical_protein(k, canon)
        mapping[k] = c
        if c != k:
            aliases[k] = c
    return mapping, aliases
