import React, { useMemo, useState } from 'react';
import { Box, Chip, Collapse, Paper, Typography, Button } from '@mui/material';

// Live trace of one triad through the decision path that produces its motif.
//
// The path is six decisions deep and, until now, lived only in prose:
//   1. estimate every directed edge (IVW / Wald ratio)
//   2. adjust within edge direction (BH), then tier the edge
//   3. read PRESENCE at the Tier-1 bar -- which directions cleared it
//   4. match the motif rules, which turn on ABSENCES as much as presences
//
// Step 4 is why a triad can be surprising: motif A requires three edges present
// AND three absent, so a triad fails it either by missing support or by having
// too much. Showing which clause failed is the whole point of this component --
// "not motif A" is useless; "not motif A because D->P also reached Tier 1" is
// an explanation.
//
// Rules transcribed verbatim from summarize_mr_triads.R (which copies them from
// fig_mr_motif_overview.R:80-85). Any change there must be mirrored here.
const FLAGS = [
  ['pEP', 'E → P', 'exposure moves the protein'],
  ['pPD', 'P → D', 'protein moves disease risk'],
  ['pED', 'E → D', 'exposure moves disease risk'],
  ['pPE', 'P → E', 'protein moves the exposure (reverse)'],
  ['pDP', 'D → P', 'disease moves the protein (reverse)'],
  ['pDE', 'D → E', 'disease moves the exposure (reverse)'],
];

const RULES = [
  { id: 'A', name: 'Mediator (E→P→D)',
    need: ['pEP', 'pPD', 'pED'], forbid: ['pPE', 'pDP', 'pDE'],
    reading: 'the exposure acts on disease through the protein' },
  { id: 'B', name: 'Biomarker',
    need: ['pEP', 'pED', 'pDP'], forbid: ['pPD', 'pPE', 'pDE'],
    reading: 'the protein marks both exposure and disease without carrying the effect' },
  { id: 'C', name: 'Exposure-marker',
    need: ['pEP', 'pED'], forbid: ['pPD', 'pPE', 'pDP'],
    reading: 'the protein reports the exposure only' },
  { id: 'D', name: 'Reverse (P→E)',
    need: ['pPE'], forbid: ['pEP'],
    reading: 'the protein acts on the exposure, not the other way round' },
  { id: 'E', name: 'Disease-liability (D→P)',
    need: ['pDP', 'pDE'], forbid: [],
    reading: 'disease liability moves the protein' },
];

const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

function Flag({ on, children }) {
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      color: on ? '#1b7837' : '#b2182b', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {on ? '✓' : '✗'} {children}
    </Box>
  );
}

export default function MotifTrace({ triad, tiers, tierTable }) {
  const [open, setOpen] = useState(true);
  const flags = useMemo(() => {
    const f = {};
    FLAGS.forEach(([k]) => { f[k] = isTrue(triad.flags?.[k]); });
    return f;
  }, [triad]);

  const verdicts = useMemo(() => RULES.map((r) => {
    const missing = r.need.filter((k) => !flags[k]);
    const present = r.forbid.filter((k) => flags[k]);
    return { ...r, missing, present, matched: !missing.length && !present.length };
  }), [flags]);

  const matched = verdicts.filter((v) => v.matched);

  return (
    <Paper variant="outlined" sx={{ p: 2, my: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          How this triad was classified
        </Typography>
        {matched.length
          ? matched.map((m) => (
              <Chip key={m.id} size="small" color="primary"
                    label={`motif ${m.id} — ${m.name}`} />
            ))
          : <Chip size="small" variant="outlined" label="no motif at the Tier-1 bar" />}
        <Button size="small" onClick={() => setOpen(!open)} sx={{ ml: 'auto' }}>
          {open ? 'Hide the steps' : 'Show the steps'}
        </Button>
      </Box>

      <Collapse in={open}>
        <Box sx={{ mt: 2 }}>
          <Step n={1} title="Estimate every directed edge">
            Inverse-variance-weighted (or Wald ratio for a single instrument), in
            each pQTL panel that can produce that edge. Six directions; the two
            with no protein are identical across panels.
          </Step>

          <Step n={2} title="Adjust, then tier">
            p-values are BH-adjusted <i>within</i> edge direction, then each edge is
            placed on the ladder. Tier&nbsp;1 additionally requires a Steiger test
            that is significant <i>and</i> forward-oriented; Tier&nbsp;1+ requires
            cis-anchoring, colocalization and replication across both panels.
            {tierTable && (
              <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries(tierTable)
                  .filter(([, v]) => v && v !== 'Null')
                  .map(([k, v]) => {
                    const [, suf, panel] = k.split('_');
                    const best = v === 'Tier1plus';
                    return (
                      <Chip key={k} size="small"
                            color={best ? 'success' : 'default'}
                            variant={best ? 'filled' : 'outlined'}
                            label={`${suf} · ${panel === 'UKB' ? 'Olink' : 'SomaScan'} · ${
                              v === 'Tier1plus' ? 'Tier 1+' : v}`} />
                    );
                  })}
              </Box>
            )}
            {tierTable && Object.values(tierTable).some((v) => v === 'Tier1plus') && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#1b7837' }}>
                Tier&nbsp;1+ edges here are cis-anchored, colocalized <b>and</b> replicated
                across both pQTL panels &mdash; the strongest rung HEAP assigns.
              </Typography>
            )}
          </Step>

          <Step n={3} title="Read presence at the Tier-1 bar">
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
              {FLAGS.map(([k, label, meaning]) => (
                <Box key={k} sx={{ minWidth: 190 }}>
                  <Flag on={flags[k]}>{label}</Flag>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    {meaning}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Step>

          <Step n={4} title="Match the motif rules — absences count">
            <Box sx={{ mt: 0.5 }}>
              {verdicts.map((v) => (
                <Box key={v.id} sx={{
                  py: 0.75, borderTop: '1px solid', borderColor: 'divider',
                  opacity: v.matched ? 1 : 0.72,
                }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <b>{v.matched ? '✓' : '✗'} motif {v.id}</b>
                    <span>{v.name}</span>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {v.reading}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 2 }}>
                    needs {v.need.join(', ')}
                    {v.forbid.length ? ` · requires ${v.forbid.join(', ')} absent` : ''}
                  </Typography>
                  {!v.matched && (
                    <Typography variant="caption" sx={{ display: 'block', ml: 2, color: '#b2182b' }}>
                      fails because
                      {v.missing.length ? ` ${v.missing.join(', ')} did not reach Tier 1` : ''}
                      {v.missing.length && v.present.length ? ', and' : ''}
                      {v.present.length ? ` ${v.present.join(', ')} reached Tier 1 but must be absent` : ''}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Step>

          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
            Rules transcribed from <code>summarize_mr_triads.R</code>, which is the
            same code path that builds supplementary sheet <code>S_mr_triads</code>.
            Because the rules turn on absences, motif counts are <b>recomputed</b> at
            each evidence bar rather than filtered — they are not monotonic across tiers.
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}

function Step({ n, title, children }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 1.75 }}>
      <Box sx={{
        flex: '0 0 24px', height: 24, borderRadius: '50%', bgcolor: 'primary.main',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
      }}>{n}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography component="div" variant="body2" sx={{ color: 'text.secondary' }}>
          {children}
        </Typography>
      </Box>
    </Box>
  );
}
