import React, { useMemo } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Autocomplete, Box, Button, Paper, TextField, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ColumnarTable from './ColumnarTable';
import MotifGlyph from './MotifGlyph';
import { useSection } from '../lib/useSection';
import { useUrlState } from '../lib/useUrlState';
import { motifColor, prettyExposure, prettyDisease } from '../lib/palette';

// ---------------------------------------------------------------------------
// Compose a triad, then open it.
//
// A triad has three slots -- Exposure -> Protein -> Disease -- and the browser
// used to let you fill exactly ONE. Anyone after "smoking-related triads
// involving FURIN" had to pick one, travel to the explorer, and type the other
// into its search box, which is the work this section exists to save.
//
// Each slot is optional and the lists are CROSS-FILTERED, so an empty result
// cannot be composed: choosing FURIN drops the exposure list from 79 to 23 and
// the disease list from 55 to 7, because those are the ones FURIN actually
// appears with.
//
// Filling one slot reproduces the old single-entity behaviour exactly, which is
// why this replaces that mode rather than sitting beside it.
//
// The slots travel as separate URL params (?e= ?p= ?d=) and are matched
// EXACTLY. The explorer's own search box splits on whitespace and asks only
// that every word appear somewhere in the row, so "smoking FURIN" as free text
// also matches past_tobacco_smoking. "Exposure is this exposure" has no such
// ambiguity. ?q= remains for typing.
// ---------------------------------------------------------------------------

const MOTIF_ORDER = ['A', 'B', 'C', 'D', 'E'];
const SIG_KEYS = ['sig_1_EP', 'sig_2_PD', 'sig_3_ED', 'sig_4_PE', 'sig_5_DP', 'sig_6_DE'];
const CAP = 400;   // rows handed to the table; the count above is never capped

export default function TriadBuilder({ triadsPath }) {
  const { data, loading, error } = useSection('mr_triads');
  const { data: motifKey } = useSection('mr_motif_key');
  const { search } = useLocation();

  const [e, setE] = useUrlState('e', '');
  const [p, setP] = useUrlState('p', '');
  const [d, setD] = useUrlState('d', '');
  const [motif, setMotif] = useUrlState('motif', 'all');

  const meta = useMemo(() => {
    if (!motifKey?.motif) return { names: {}, sigs: {} };
    const names = {}; const sigs = {};
    motifKey.motif.forEach((k, i) => {
      names[k] = motifKey.name[i];
      sigs[k] = Object.fromEntries(SIG_KEYS.map((c) => [c, motifKey[c]?.[i]]));
    });
    return { names, sigs };
  }, [motifKey]);

  // One pass, reused by every list and by the match set below. `skip` lets a
  // slot exclude ITSELF, so its own dropdown still offers every value that is
  // reachable given the OTHER two -- otherwise picking a value would collapse
  // its own list to that one value.
  const matches = useMemo(() => {
    if (!data?.Protein) return null;
    const n = data.Protein.length;
    const test = (i, skip) => (
      (skip === 'e' || !e || data.Exposure[i] === e)
      && (skip === 'p' || !p || data.Protein[i] === p)
      && (skip === 'd' || !d || data.Disease[i] === d)
    );
    const all = []; const forE = new Set(); const forP = new Set(); const forD = new Set();
    for (let i = 0; i < n; i += 1) {
      if (test(i, null)) all.push(i);
      if (test(i, 'e')) forE.add(data.Exposure[i]);
      if (test(i, 'p')) forP.add(data.Protein[i]);
      if (test(i, 'd')) forD.add(data.Disease[i]);
    }
    return { all, forE: [...forE], forP: [...forP], forD: [...forD] };
  }, [data, e, p, d]);

  const split = useMemo(() => {
    if (!data || !matches) return {};
    const c = {};
    for (const i of matches.all) {
      const k = String(data.motif[i]).charAt(0);
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [data, matches]);

  const shown = useMemo(() => {
    if (!data || !matches) return null;
    const keep = motif === 'all'
      ? matches.all
      : matches.all.filter((i) => String(data.motif[i]).charAt(0) === motif);
    const rows = keep.slice(0, CAP);
    return {
      n: keep.length,
      table: {
        Exposure: rows.map((i) => prettyExposure(data.Exposure[i])),
        Protein: rows.map((i) => data.Protein[i]),
        Disease: rows.map((i) => prettyDisease(data.Disease[i], data.Disease_UKB?.[i])),
        Motif: rows.map((i) => String(data.motif[i]).charAt(0)),
      },
    };
  }, [data, matches, motif]);

  if (loading) return <Typography variant="body2">Loading…</Typography>;
  if (error) return <Typography variant="body2" color="error">{String(error)}</Typography>;
  if (!data || !matches) return null;

  const total = matches.all.length;
  const anySlot = Boolean(e || p || d);

  const slot = (label, value, setValue, opts, pretty) => (
    <Autocomplete
      size="small"
      sx={{ flex: '1 1 240px', minWidth: 220 }}
      options={[...opts].sort((a, b) => pretty(a).localeCompare(pretty(b)))}
      value={value || null}
      onChange={(_, v) => setValue(v || '')}
      getOptionLabel={pretty}
      renderInput={(props) => (
        <TextField
          {...props}
          label={label}
          placeholder="any"
          // The count goes in helper text, not the placeholder: MUI shows a
          // placeholder only on focus, and this number IS the affordance --
          // watching 79 drop to 23 is how you learn the lists are narrowing.
          helperText={`${opts.length} available`}
        />
      )}
    />
  );

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      {/* No heading here: the viewpoint above already says "Build a triad",
          and saying it twice on one screen is the duplication this redesign
          keeps removing. The component is used inside a titled page. */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Fill any combination of the three. Each list only offers values that
        actually occur with what you have already chosen.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        {slot('Exposure', e, setE, matches.forE, prettyExposure)}
        {slot('Protein', p, setP, matches.forP, (x) => x)}
        {slot('Disease', d, setD, matches.forD, (x) => prettyDisease(x, null))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {total.toLocaleString()}
          {` triad${total === 1 ? '' : 's'} match`}
        </Typography>
        {anySlot && (
          <Button size="small" onClick={() => { setE(''); setP(''); setD(''); }}
                  sx={{ textTransform: 'none' }}>
            Clear slots
          </Button>
        )}
      </Box>

      {/* The motif split, as pictures. This is the section's own question --
          which patterns does this combination carry -- answered before the
          reader navigates anywhere. */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {MOTIF_ORDER.map((m) => {
          const n = split[m] || 0;
          const isSel = motif === m;
          return (
            <Box
              key={m}
              onClick={() => n && setMotif(isSel ? 'all' : m)}
              sx={{
                p: 0.75, borderRadius: 1, textAlign: 'center', minWidth: 104,
                border: '2px solid',
                borderColor: isSel ? motifColor(m) : 'divider',
                bgcolor: isSel ? 'action.selected' : 'transparent',
                cursor: n ? 'pointer' : 'default',
                opacity: n ? 1 : 0.4,
                '&:hover': n ? { borderColor: motifColor(m) } : {},
              }}
            >
              <MotifGlyph motif={m} sig={meta.sigs[m]} size={86}
                          title={`Motif ${m} — ${meta.names[m] || ''}`} />
              <Box sx={{ fontSize: 12, fontWeight: 700, color: motifColor(m) }}>{m}</Box>
              <Box sx={{ fontSize: 11, color: 'text.secondary' }}>{meta.names[m] || m}</Box>
              <Box sx={{ fontSize: 13, fontWeight: 700 }}>{n.toLocaleString()}</Box>
            </Box>
          );
        })}
      </Box>

      <Button
        component={RouterLink}
        to={`${triadsPath}${search}`}
        variant="contained"
        endIcon={<ArrowForwardIcon />}
        disabled={!shown?.n}
        sx={{ textTransform: 'none', mb: 2 }}
      >
        {shown?.n
          ? `Open ${shown.n === 1 ? 'it' : `the first of ${shown.n.toLocaleString()}`} in the triad explorer`
          : 'Nothing to open'}
      </Button>

      {shown?.n > 0 && (
        <>
          {shown.n > CAP && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {`Showing the first ${CAP} of ${shown.n.toLocaleString()}. Narrow a slot to see the rest.`}
            </Typography>
          )}
          <ColumnarTable data={shown.table} initialRowsPerPage={10} />
        </>
      )}
    </Paper>
  );
}
