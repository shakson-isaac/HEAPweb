import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { WEB_DATA_BASE } from '../lib/heapdata';

// ---------------------------------------------------------------------------
// One box for the three things a visitor arrives with: a protein, an exposure,
// or a disease.
//
// THE INDEX WAS ALREADY PUBLISHED AND UNUSED. meta/search_index.json.gz has
// carried 2,686 proteins, 169 exposures and 72 diseases since the payload was
// built; nothing on the site read it. It is 14 KB gzipped and fetched once.
//
// WHERE EACH KIND GOES. A hit routes to the page that answers for that kind,
// with the selection in the query string, so the destination opens on the thing
// that was typed rather than on its default:
//
//   protein  -> /results/associations?protein=LEP        which exposures move it
//   exposure -> /results/enrichment?exposure=<id>        what its signature touches
//   disease  -> /results/mediation?disease=<id>          which proteins route into it
//
// That only works because those selectors read their value from the URL. If a
// page is ever rewritten back to plain useState, search will land on it and
// silently show the default instead -- the failure is quiet, so keep the two
// together.
// ---------------------------------------------------------------------------

const INDEX_URL = `${WEB_DATA_BASE}/meta/search_index.json.gz`;
const MAX_OPTIONS = 40;

const ROUTES = {
  // A protein goes to its own page, which lists every view that has something
  // for it. Exposures and diseases still route straight into a view until their
  // entity pages exist.
  protein: (id) => `/explore/protein/${encodeURIComponent(id)}`,
  exposure: (id) => `/results/enrichment?exposure=${encodeURIComponent(id)}`,
  disease: (id) => `/results/mediation?disease=${encodeURIComponent(id)}`,
};

const KIND_LABEL = { protein: 'protein', exposure: 'exposure', disease: 'disease' };

let cache = null;

function load() {
  if (!cache) {
    cache = fetch(INDEX_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => [
        ...(d.proteins || []).map((p) => ({ kind: 'protein', id: p, label: p, sub: '', hay: p.toLowerCase() })),
        // Exposure labels in the index are abbreviated to about twenty
        // characters -- "Alcohol freq.", "Meets activity rec." -- and some are
        // null, so a label-only match finds almost no exposures. The id is the
        // UK Biobank field name and carries the words people type ("smoking",
        // "tobacco", "oily fish"), so both are searched and the id is shown.
        ...(d.exposures || []).map((e) => ({
          kind: 'exposure',
          id: e.id,
          label: e.label || e.id,
          sub: e.broad || e.category || '',
          hay: `${e.label || ''} ${e.id} ${e.broad || ''}`.toLowerCase(),
        })),
        ...(d.diseases || []).map((x) => ({
          kind: 'disease', id: x.id, label: x.label || x.id, sub: '',
          hay: `${x.label || ''} ${x.id}`.toLowerCase(),
        })),
      ])
      .catch(() => { cache = null; return []; });
  }
  return cache;
}

export default function SiteSearch({ width = 300 }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    load().then((d) => alive && setItems(d));
    return () => { alive = false; };
  }, []);

  // Rank by where the match falls: a protein called exactly what was typed
  // first, then prefix matches, then anything containing it. Without this,
  // typing "LEP" offers LEPR and twenty leptin-adjacent labels above LEP.
  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const scored = [];
    for (const it of items) {
      const label = it.label.toLowerCase();
      const inLabel = label.indexOf(needle);
      const inHay = inLabel === -1 ? it.hay.indexOf(needle) : inLabel;
      if (inHay === -1) continue;
      // exact label, then label prefix, then anywhere in the label, then the id
      const rank = label === needle ? 0 : inLabel === 0 ? 1 : inLabel > 0 ? 2 : 3;
      scored.push({ it, rank, len: label.length });
      if (scored.length > 600) break;
    }
    scored.sort((a, b) => a.rank - b.rank || a.len - b.len);
    return scored.slice(0, MAX_OPTIONS).map((s) => s.it);
  }, [items, q]);

  return (
    <Autocomplete
      size="small"
      sx={{ width, ml: 'auto' }}
      options={options}
      filterOptions={(x) => x}          // ranking is ours, above
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
      isOptionEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
      noOptionsText={q.trim().length < 2 ? 'Type two letters…' : 'Nothing matches'}
      onInputChange={(_, v) => setQ(v)}
      onChange={(_, v) => {
        if (v && ROUTES[v.kind]) {
          navigate(ROUTES[v.kind](v.id));
          setQ('');
        }
      }}
      renderOption={(props, o) => (
        <Box component="li" {...props} key={`${o.kind}:${o.id}`} sx={{ gap: 1 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap>{o.label}</Typography>
            {(o.sub || o.kind === 'exposure') && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                {o.kind === 'exposure' ? `${o.sub ? `${o.sub} · ` : ''}${o.id}` : o.sub}
              </Typography>
            )}
          </Box>
          <Chip size="small" variant="outlined" label={KIND_LABEL[o.kind]} />
        </Box>
      )}
      renderInput={(p) => (
        <TextField
          {...p}
          placeholder="Search a protein, exposure or disease"
          InputProps={{
            ...p.InputProps,
            startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} />,
          }}
        />
      )}
    />
  );
}
