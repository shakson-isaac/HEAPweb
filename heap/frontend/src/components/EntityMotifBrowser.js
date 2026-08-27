import React, { useMemo, useState } from 'react';
import {
  Autocomplete, Box, Chip, Paper, TextField, ToggleButton, ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ColumnarTable from './ColumnarTable';
import MotifGlyph from './MotifGlyph';
import { useSection } from '../lib/useSection';
import { motifColor, ecatColor, prettyExposure, prettyDisease } from '../lib/palette';

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
//
// TWO WAYS IN, because people arrive with different questions.
//
//   "by entity"  -- I study LEP; what does it do?  Pick it, see the split over
//                   A-E, then click a bar to get the ACTUAL TRIADS rather than
//                   just a count. Clicking used to set a filter and show
//                   nothing, which left the reader to go and find the payoff
//                   somewhere else.
//
//   "by motif"   -- I care about causal intermediates; which proteins are
//                   they?  Pick a motif and get the list straight away. This
//                   matters most for the rare ones: only 3 proteins carry
//                   motif A and 4 carry D, and there was previously no way to
//                   see which.
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
  // The full triad list, so a motif click can show the rows behind the count.
  // Already fetched by the triad explorer, so this is a cache hit in practice.
  const { data: triads } = useSection('mr_triads');
  const [type, setType] = useState('protein');
  const [mode, setMode] = useState('entity');

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

  // The triads behind the selected bar: this entity, this motif. The payoff a
  // bar click used to promise and not deliver.
  const lookup = useMemo(() => {
    if (!triads?.motif || !current || !selectedMotif) return null;
    const col = { exposure: 'Exposure', protein: 'Protein', disease: 'Disease' }[type];
    const out = { Exposure: [], Protein: [], Disease: [] };
    for (let i = 0; i < triads.motif.length; i += 1) {
      if (triads.motif[i] !== selectedMotif) continue;
      if (triads[col]?.[i] !== current.id && triads[col]?.[i] !== current.label) continue;
      out.Exposure.push(prettyExposure(triads.Exposure[i]));
      out.Protein.push(triads.Protein[i]);
      out.Disease.push(prettyDisease(triads.Disease[i], triads.Disease_UKB?.[i]));
    }
    return out.Protein.length ? out : { Exposure: [], Protein: [], Disease: [] };
  }, [triads, current, selectedMotif, type]);

  // Everything of the chosen type that carries a motif, biggest first. For the
  // rare motifs this is the whole answer: 3 proteins carry A, 4 carry D.
  const carriers = useMemo(() => {
    if (!index || !selectedMotif) return null;
    const rows = [...index[type].values()]
      .map((e) => ({ e, n: e.byMotif[selectedMotif]?.n_triads || 0 }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);
    const label = { exposure: 'Exposure', protein: 'Protein', disease: 'Disease' }[type];
    const out = {
      [label]: rows.map((r) => (type === 'exposure' ? prettyExposure(r.e.label) : r.e.label)),
      Triads: rows.map((r) => r.n),
    };
    // ecat is an exposure attribute. Including it for proteins or diseases
    // renders an entirely blank column, which is worse than no column.
    if (type === 'exposure') {
      out.Category = rows.map((r) => (r.e.ecat || '').replace(/_/g, ' '));
    }
    return out;
  }, [index, selectedMotif, type]);

  const motifNames = useMemo(() => {
    const m = {};
    if (motifs?.motif) motifs.motif.forEach((k, i) => { m[k] = motifs.name[i]; });
    return m;
  }, [motifs]);

  // The six signature characters per motif, for the glyph. Same source the
  // reading key uses, so the picture here and the picture there agree.
  const motifSigs = useMemo(() => {
    const m = {};
    if (!motifs?.motif) return m;
    const keys = ['sig_1_EP', 'sig_2_PD', 'sig_3_ED', 'sig_4_PE', 'sig_5_DP', 'sig_6_DE'];
    motifs.motif.forEach((k, i) => {
      m[k] = Object.fromEntries(keys.map((c) => [c, motifs[c]?.[i]]));
    });
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
        the filter down into the explorer, or click a bar for the triads behind it.
      </Typography>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={mode}
        onChange={(_, v) => v && setMode(v)}
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="entity" sx={{ textTransform: 'none', px: 1.5 }}>
          Start from an entity
        </ToggleButton>
        <ToggleButton value="motif" sx={{ textTransform: 'none', px: 1.5 }}>
          Start from a motif
        </ToggleButton>
      </ToggleButtonGroup>

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

      {mode === 'motif' && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {MOTIF_ORDER.map((m) => {
              const nCarry = [...index[type].values()]
                .filter((e) => (e.byMotif[m]?.n_triads || 0) > 0).length;
              const isSel = selectedMotif === m;
              return (
                <Box
                  key={m}
                  onClick={() => onSelectMotif?.(isSel ? null : m)}
                  sx={{
                    cursor: 'pointer', p: 1, borderRadius: 1, textAlign: 'center',
                    border: '2px solid',
                    borderColor: isSel ? motifColor(m) : 'divider',
                    bgcolor: isSel ? 'action.selected' : 'transparent',
                    minWidth: 132,
                    '&:hover': { borderColor: motifColor(m) },
                  }}
                >
                  <MotifGlyph motif={m} sig={motifSigs[m]} size={112}
                              title={`Motif ${m} — ${motifNames[m] || ''}`} />
                  <Box sx={{ fontSize: 13, fontWeight: 700, color: motifColor(m), mt: 0.5 }}>{m}</Box>
                  <Box sx={{ fontSize: 12 }}>{motifNames[m] || m}</Box>
                  <Box sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {`${nCarry} ${type}${nCarry === 1 ? '' : 's'}`}
                  </Box>
                </Box>
              );
            })}
          </Box>
          {selectedMotif && carriers ? (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <b>{carriers.Triads.length.toLocaleString()}</b>
                {` ${type}${carriers.Triads.length === 1 ? '' : 's'} carry motif ${selectedMotif}`}
                {motifNames[selectedMotif] ? ` — ${motifNames[selectedMotif]}` : ''}
              </Typography>
              <ColumnarTable data={carriers} initialRowsPerPage={10} />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Pick a pattern above. The number on each chip is how many {type}s carry it.
            </Typography>
          )}
        </Box>
      )}
      {mode === 'entity' && !current && (
        <Typography variant="body2" color="text.secondary">
          Nothing selected. The list is ordered by how many triads each{' '}
          {type} appears in.
        </Typography>
      )}

      {mode === 'entity' && current && (
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

          {selectedMotif && lookup && lookup.Protein.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <MotifGlyph motif={selectedMotif} sig={motifSigs[selectedMotif]} size={86}
                            title={`Motif ${selectedMotif}`} />
                <Box>
                  <Box sx={{ fontWeight: 700 }}>
                    {`${lookup.Protein.length.toLocaleString()} triad${lookup.Protein.length === 1 ? '' : 's'}`}
                  </Box>
                  <Box sx={{ fontSize: 13, color: 'text.secondary' }}>
                    {`Motif ${selectedMotif}${motifNames[selectedMotif] ? ' — ' + motifNames[selectedMotif] : ''}`}
                  </Box>
                </Box>
              </Box>
              <ColumnarTable data={lookup} initialRowsPerPage={10} />
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}
