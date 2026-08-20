import React, { useMemo, useState } from 'react';
import {
  Autocomplete, Box, Chip, Paper, TextField, ToggleButton, ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useSection } from '../lib/useSection';
import { motifColor, ecatColor, prettyExposure } from '../lib/palette';

// ---------------------------------------------------------------------------
// The middle layer of the causal page: between the reading key (what the
// patterns mean) and the triad explorer (one triad in full detail).
//
// Pick any exposure, protein or disease and see how its triads distribute over
// the five patterns. This is the step that was missing -- the explorer answers
// "what is going on in THIS triad", but not "what does this protein do across
// everything it was tested against", which is the question most people arrive
// with.
//
// Counts come from mr_entity_motifs (built by tools/build_motif_browse.py from
// the R-built supplementary triad table). The ALL row is precomputed rather
// than summed in the browser, because a triad can be counted once per entity
// and summing the motif rows would be correct only by coincidence.
// ---------------------------------------------------------------------------

const TYPES = [
  { key: 'exposure', label: 'Exposure' },
  { key: 'protein', label: 'Protein' },
  { key: 'disease', label: 'Disease' },
];

// Which two partner counts are meaningful depends on what you selected: a
// protein's triads span exposures and diseases, and saying "601 proteins" back
// to someone who just picked a protein is noise.
const PARTNERS = {
  exposure: [['n_proteins', 'proteins'], ['n_diseases', 'diseases']],
  protein: [['n_exposures', 'exposures'], ['n_diseases', 'diseases']],
  disease: [['n_exposures', 'exposures'], ['n_proteins', 'proteins']],
};

const MOTIF_ORDER = ['A', 'B', 'C', 'D', 'E'];

export default function EntityMotifBrowser({ motifs, selectedMotif, onSelectMotif,
                                             onPick, picked }) {
  const { data, loading, error } = useSection('mr_entity_motifs');
  const [type, setType] = useState('protein');

  // rows -> { type: { id: { label, ecat, byMotif } } }
  const index = useMemo(() => {
    if (!data?.entity_id) return null;
    const out = { exposure: new Map(), protein: new Map(), disease: new Map() };
    for (let i = 0; i < data.entity_id.length; i += 1) {
      const t = data.entity_type[i];
      if (!out[t]) continue;
      const id = data.entity_id[i];
      if (!out[t].has(id)) {
        out[t].set(id, {
          id,
          label: data.entity_label[i],
          ecat: data.ecat[i] || '',
          byMotif: {},
        });
      }
      out[t].get(id).byMotif[data.motif[i]] = {
        n_triads: Number(data.n_triads[i]) || 0,
        n_exposures: Number(data.n_exposures[i]) || 0,
        n_proteins: Number(data.n_proteins[i]) || 0,
        n_diseases: Number(data.n_diseases[i]) || 0,
      };
    }
    return out;
  }, [data]);

  const options = useMemo(() => {
    if (!index) return [];
    return [...index[type].values()]
      .sort((a, b) => (b.byMotif.ALL?.n_triads || 0) - (a.byMotif.ALL?.n_triads || 0));
  }, [index, type]);

  const current = picked?.type === type && index ? index[type].get(picked.id) : null;

  const motifNames = useMemo(() => {
    const m = {};
    if (motifs?.motif) motifs.motif.forEach((k, i) => { m[k] = motifs.name[i]; });
    return m;
  }, [motifs]);

  if (loading) return <Typography variant="body2">Loading…</Typography>;
  if (error) return <Typography variant="body2" color="error">{String(error)}</Typography>;
  if (!index) return null;

  const total = current?.byMotif.ALL?.n_triads || 0;
  const maxMotif = Math.max(1, ...MOTIF_ORDER.map((m) => current?.byMotif[m]?.n_triads || 0));

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Start from one exposure, protein or disease
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        How do its triads split across the five patterns? Pick a pattern to carry
        the filter down into the explorer.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={type}
          onChange={(_, v) => { if (v) { setType(v); onPick?.(null); } }}>
          {TYPES.map((t) => (
            <ToggleButton key={t.key} value={t.key} sx={{ textTransform: 'none', px: 1.5 }}>
              {t.label}
              <Box component="span" sx={{ ml: 0.75, color: 'text.secondary', fontSize: 12 }}>
                {index[t.key].size}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Autocomplete
          size="small"
          sx={{ minWidth: 300, flex: '1 1 300px' }}
          options={options}
          value={current || null}
          onChange={(_, v) => onPick?.(v ? { type, id: v.id } : null)}
          getOptionLabel={(o) => (type === 'exposure' ? prettyExposure(o.label) : o.label)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderOption={(props, o) => (
            <Box component="li" {...props} key={o.id}
                 sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <span>{type === 'exposure' ? prettyExposure(o.label) : o.label}</span>
              <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                {(o.byMotif.ALL?.n_triads || 0).toLocaleString()}
              </Box>
            </Box>
          )}
          renderInput={(p) => (
            <TextField {...p} label={`Search ${type}s`} placeholder="type to search…" />
          )}
        />
      </Box>

      {!current && (
        <Typography variant="body2" color="text.secondary">
          Nothing selected. The list is ordered by how many triads each{' '}
          {type} appears in.
        </Typography>
      )}

      {current && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {type === 'exposure' ? prettyExposure(current.label) : current.label}
            </Typography>
            {current.ecat && (
              <Chip size="small" label={current.ecat.replace(/_/g, ' ')}
                    sx={{ bgcolor: ecatColor(current.ecat), color: '#fff', height: 20 }} />
            )}
            <Typography variant="body2" color="text.secondary">
              {total.toLocaleString()} triad{total === 1 ? '' : 's'}
              {PARTNERS[type].map(([k, name]) => (
                <React.Fragment key={k}>
                  {' · '}{(current.byMotif.ALL?.[k] || 0).toLocaleString()} {name}
                </React.Fragment>
              ))}
            </Typography>
          </Box>

          <Box sx={{ display: 'grid',
                     gridTemplateColumns: 'minmax(130px,auto) 1fr minmax(90px,auto)',
                     alignItems: 'center', gap: '3px 8px' }}>
            {MOTIF_ORDER.map((m) => {
              const n = current.byMotif[m]?.n_triads || 0;
              const isSel = selectedMotif === m;
              return (
                <React.Fragment key={m}>
                  <Box
                    onClick={() => n && onSelectMotif?.(isSel ? null : m)}
                    sx={{ fontSize: 13, py: 0.3, pl: 0.5, borderRadius: 0.5,
                          whiteSpace: 'nowrap',
                          cursor: n ? 'pointer' : 'default',
                          opacity: n ? 1 : 0.45,
                          fontWeight: isSel ? 700 : 400,
                          bgcolor: isSel ? 'action.selected' : 'transparent',
                          '&:hover': n ? { bgcolor: 'action.hover' } : {} }}>
                    <Box component="span"
                         sx={{ fontWeight: 700, color: motifColor(m), mr: 0.75 }}>{m}</Box>
                    {motifNames[m] || m}
                  </Box>
                  <Box sx={{ height: 12, bgcolor: 'action.hover', borderRadius: 0.5,
                             overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${(n / maxMotif) * 100}%`,
                               bgcolor: motifColor(m), opacity: n ? 1 : 0,
                               transition: 'width .2s' }} />
                  </Box>
                  <Box sx={{ fontSize: 12, textAlign: 'right',
                             color: n ? 'text.primary' : 'text.disabled' }}>
                    {n.toLocaleString()}
                    <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                      {total ? `${Math.round((n / total) * 100)}%` : ''}
                    </Box>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>

          <Typography variant="caption" color="text.secondary"
                      sx={{ display: 'block', mt: 1.25 }}>
            Bars are scaled within this {type}, not across the whole dataset, so
            the shape shows how <em>this</em> one splits rather than how big it is.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
