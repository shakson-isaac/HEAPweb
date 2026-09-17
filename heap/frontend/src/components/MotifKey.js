import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, Tooltip } from '@mui/material';
import { motifColor } from '../lib/palette';

// ---------------------------------------------------------------------------
// The MR reading key: main Figure 4a (the six directed relationships) beside
// main Figure 4b (which combination of them defines each motif, and how many
// triads carry it).
//
// This sits at the TOP of the causal page because the triad explorer below is
// unreadable without it. The two halves share one numbering -- edge 2 in the
// DAG is column 2 in the matrix -- which is the whole point of showing them
// together, so hovering either half highlights the other.
//
// The matrix is not decoration: clicking a motif row filters everything below
// it on the page. The explainer IS the navigation.
//
// Signatures and counts both come from the payload (mr_edge_key, mr_motif_key),
// which is derived from the R-built supplementary triad table. Nothing here
// recomputes a motif -- see tools/build_motif_browse.py for why that matters.
// ---------------------------------------------------------------------------

// Same triangle geometry as TriadDAG.js / mr_diagram.R, so the schematic at the
// top and the per-triad diagram further down are visibly the same picture.
const S = 46;
const XMIN = -1.6; const XMAX = 11.6;
const YMIN = -1.5; const YMAX = 4.3;
const W = (XMAX - XMIN) * S;
const H = (YMAX - YMIN) * S;
const X = (x) => (x - XMIN) * S;
const Y = (y) => (YMAX - y) * S;
const NODE_RX = 1.28; const NODE_RY = 0.62;

const NODES = {
  E: { x: 0, y: 0, label: 'Exposure' },
  P: { x: 5, y: 3, label: 'Protein' },
  D: { x: 10, y: 0, label: 'Disease' },
};

// curve = perpendicular bow, so the two directions of a pair never overlap.
const EDGE_GEOM = {
  1: { from: 'E', to: 'P', curve: 0.55 },
  2: { from: 'P', to: 'D', curve: 0.55 },
  3: { from: 'E', to: 'D', curve: 0.42 },
  4: { from: 'P', to: 'E', curve: 0.55 },
  5: { from: 'D', to: 'P', curve: 0.55 },
  6: { from: 'D', to: 'E', curve: 0.42 },
};

// Stop the arrow on the node's ellipse rather than at its center.
function trim(x0, y0, x1, y1) {
  const dx = x1 - x0; const dy = y1 - y0;
  const t = Math.hypot(dx / NODE_RX, dy / NODE_RY);
  if (!t) return { x: x1, y: y1 };
  return { x: x1 - (dx / t) * 1.02, y: y1 - (dy / t) * 1.02 };
}

function edgePath(num) {
  const g = EDGE_GEOM[num];
  const a = NODES[g.from]; const b = NODES[g.to];
  const s = trim(b.x, b.y, a.x, a.y);
  const e = trim(a.x, a.y, b.x, b.y);
  const mx = (s.x + e.x) / 2; const my = (s.y + e.y) / 2;
  const dx = e.x - s.x; const dy = e.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  // Bow to the left of travel; reversed edges therefore bow the opposite way.
  const cx = mx - (dy / len) * g.curve;
  const cy = my + (dx / len) * g.curve;
  return {
    d: `M ${X(s.x)} ${Y(s.y)} Q ${X(cx)} ${Y(cy)} ${X(e.x)} ${Y(e.y)}`,
    label: { x: X(cx), y: Y(cy) },
  };
}

const SIG_TITLE = {
  '+': 'must be supported',
  '-': 'must be absent',
  '.': 'unconstrained',
};

/** One cell of the signature matrix: filled = required, x = required absent. */
function SigCell({ sig, color, dim }) {
  const common = { opacity: dim ? 0.28 : 1, transition: 'opacity .12s' };
  if (sig === '+') {
    return (
      <Box component="span" sx={{ ...common, display: 'inline-block', width: 13, height: 13,
        borderRadius: '50%', bgcolor: color }} />
    );
  }
  if (sig === '-') {
    return (
      <Box component="span" sx={{ ...common, display: 'inline-block', width: 13, height: 13,
        position: 'relative', color: 'text.disabled', fontWeight: 700, lineHeight: '13px',
        fontSize: 14, textAlign: 'center' }}>×</Box>
    );
  }
  return (
    <Box component="span" sx={{ ...common, display: 'inline-block', width: 13, height: 13,
      borderRadius: '50%', border: '1.5px solid', borderColor: 'divider' }} />
  );
}

export default function MotifKey({ edges, motifs, selected, onSelect }) {
  const [hoverEdge, setHoverEdge] = useState(null);
  const [hoverMotif, setHoverMotif] = useState(null);

  const edgeList = useMemo(() => {
    if (!edges?.num) return [];
    return edges.num.map((n, i) => ({
      num: String(n),
      code: edges.code[i],
      from: edges.from[i],
      to: edges.to[i],
      label: edges.label[i],
    }));
  }, [edges]);

  const motifList = useMemo(() => {
    if (!motifs?.motif) return [];
    return motifs.motif.map((m, i) => ({
      motif: m,
      name: motifs.name[i],
      label: motifs.label[i],
      sig: [motifs.sig_1_EP[i], motifs.sig_2_PD[i], motifs.sig_3_ED[i],
            motifs.sig_4_PE[i], motifs.sig_5_DP[i], motifs.sig_6_DE[i]],
      n_triads: Number(motifs.n_triads[i]) || 0,
      n_proteins: Number(motifs.n_proteins[i]) || 0,
    }));
  }, [motifs]);

  const maxN = Math.max(1, ...motifList.map((m) => m.n_triads));
  // Log widths: disease-liability is ~2000x the mediator count, so a linear bar
  // would render the mediator row as nothing at all.
  const barW = (n) => (n <= 0 ? 0 : (Math.log10(n) / Math.log10(maxN)) * 100);

  if (!edgeList.length || !motifList.length) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        How to read a triad
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Every exposure–protein–disease triad is tested in all six directions. Which
        of them are supported — and, just as much, which are <em>absent</em> — is
        what names the pattern. Hover an edge to see where it lands in the table;
        click a pattern to filter the page.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
        {/* ---- Fig 4a: the six directed relationships ---- */}
        <Box sx={{ flex: '0 0 auto', minWidth: 0 }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
               style={{ maxWidth: '100%', height: 'auto' }}>
            <defs>
              <marker id="mk-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {edgeList.map((e) => {
              const { d, label } = edgePath(e.num);
              const on = hoverEdge === e.num;
              // An edge is "live" when the hovered motif constrains it either way.
              const inMotif = hoverMotif
                ? motifList.find((m) => m.motif === hoverMotif)?.sig[Number(e.num) - 1]
                : null;
              const emph = on || (inMotif && inMotif !== '.');
              const col = inMotif && inMotif !== '.'
                ? motifColor(hoverMotif) : (on ? '#37474F' : '#90A4AE');
              return (
                <g key={e.num} style={{ color: col, cursor: 'default' }}
                   onMouseEnter={() => setHoverEdge(e.num)}
                   onMouseLeave={() => setHoverEdge(null)}>
                  <path d={d} fill="none" stroke="currentColor"
                        strokeWidth={emph ? 2.6 : 1.5}
                        opacity={hoverMotif && !emph ? 0.22 : 1}
                        markerEnd="url(#mk-arrow)" />
                  {/* fat invisible hit area so thin curves are still hoverable */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                  <circle cx={label.x} cy={label.y} r={9.5}
                          fill="var(--mk-bg, #FFFFFF)" stroke="currentColor"
                          strokeWidth={emph ? 1.8 : 1}
                          opacity={hoverMotif && !emph ? 0.22 : 1} />
                  <text x={label.x} y={label.y + 3.6} textAnchor="middle"
                        fontSize={11} fontWeight={700} fill="currentColor"
                        opacity={hoverMotif && !emph ? 0.22 : 1}>{e.num}</text>
                </g>
              );
            })}
            {Object.entries(NODES).map(([k, n]) => (
              <g key={k}>
                <ellipse cx={X(n.x)} cy={Y(n.y)} rx={NODE_RX * S} ry={NODE_RY * S}
                         fill="#FFFFFF" stroke="#455A64" strokeWidth={1.5} />
                <text x={X(n.x)} y={Y(n.y) + 4.5} textAnchor="middle" fontSize={13}
                      fill="#263238">{n.label}</text>
              </g>
            ))}
          </svg>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
            {edgeList.map((e) => (
              <Box key={e.num} onMouseEnter={() => setHoverEdge(e.num)}
                   onMouseLeave={() => setHoverEdge(null)}
                   sx={{ fontSize: 12, fontFamily: 'monospace', px: 0.5,
                         borderRadius: 0.5, cursor: 'default',
                         bgcolor: hoverEdge === e.num ? 'action.selected' : 'transparent' }}>
                <b>{e.num}</b> {e.from[0]}→{e.to[0]}
              </Box>
            ))}
          </Box>
        </Box>

        {/* ---- Fig 4b: signature matrix + triad counts ---- */}
        <Box sx={{ flex: '1 1 420px', minWidth: 0, overflowX: 'auto' }}>
          <Box sx={{ display: 'grid',
                     gridTemplateColumns: 'minmax(120px,auto) repeat(6, 26px) minmax(120px,1fr)',
                     alignItems: 'center', gap: '2px 4px', minWidth: 420 }}>
            <Box />
            {edgeList.map((e) => (
              <Tooltip key={e.num} title={e.label} arrow>
                <Box onMouseEnter={() => setHoverEdge(e.num)}
                     onMouseLeave={() => setHoverEdge(null)}
                     sx={{ textAlign: 'center', fontSize: 11, fontWeight: 700,
                           cursor: 'default', borderRadius: 0.5,
                           bgcolor: hoverEdge === e.num ? 'action.selected' : 'transparent' }}>
                  {e.num}
                </Box>
              </Tooltip>
            ))}
            <Box sx={{ fontSize: 11, color: 'text.secondary', pl: 1 }}># triads</Box>

            {motifList.map((m) => {
              const isSel = selected === m.motif;
              return (
                <React.Fragment key={m.motif}>
                  <Box
                    onClick={() => onSelect?.(isSel ? null : m.motif)}
                    onMouseEnter={() => setHoverMotif(m.motif)}
                    onMouseLeave={() => setHoverMotif(null)}
                    sx={{ cursor: 'pointer', fontSize: 13, py: 0.4, pl: 0.5,
                          borderRadius: 0.5, whiteSpace: 'nowrap',
                          fontWeight: isSel ? 700 : 500,
                          bgcolor: isSel ? 'action.selected' : 'transparent',
                          '&:hover': { bgcolor: 'action.hover' } }}>
                    <Box component="span" sx={{ fontWeight: 700, color: motifColor(m.motif),
                                                mr: 0.75 }}>{m.motif}</Box>
                    {m.name}
                  </Box>
                  {m.sig.map((s, i) => (
                    <Box key={i} onMouseEnter={() => setHoverEdge(String(i + 1))}
                         onMouseLeave={() => setHoverEdge(null)}
                         sx={{ textAlign: 'center', lineHeight: 0 }}>
                      <Tooltip title={`${edgeList[i]?.label}: ${SIG_TITLE[s]}`} arrow>
                        <span>
                          <SigCell sig={s} color={motifColor(m.motif)}
                                   dim={hoverEdge && hoverEdge !== String(i + 1)} />
                        </span>
                      </Tooltip>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 1,
                             minWidth: 0 }}>
                    <Box sx={{ height: 11, borderRadius: 0.5, flex: '0 0 auto',
                               width: `${barW(m.n_triads)}px`, maxWidth: '100%',
                               bgcolor: motifColor(m.motif),
                               opacity: hoverMotif && hoverMotif !== m.motif ? 0.35 : 1 }} />
                    <Box sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {m.n_triads.toLocaleString()}
                      <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                        ({m.n_proteins} prot)
                      </Box>
                    </Box>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}>
            Filled = the relationship must be supported · × = it must be
            <em> absent</em> · open = either way. Bars are on a log scale. Counts are
            at the Tier-1 evidence bar; because the patterns turn on absences,
            raising the bar does not simply shrink every count.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
