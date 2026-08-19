import React, { useId, useMemo, useRef, useState } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { ecatColor } from '../lib/palette';

// ---------------------------------------------------------------------------
// Interactive exposure -> protein -> disease MR triad DAG.
//
// This is the web counterpart of heap_plot_triplet_mr_diagram() in
// HEAP/scripts/visualizations/common/mr_diagram.R (panel e of main Figure 4).
// The visual grammar is deliberately the same: three nodes on a triangle
// (Exposure 0,0 · Protein 5,3 · Disease 10,0), forward edges straight, reverse
// edges bowed outward, arrows shortened by 0.95 units so no arrowhead enters a
// node circle, effect estimates in white boxes drawn on top of the edges, and
// edges that carry evidence solid while the rest fade back.
//
// It draws all SIX directed relationships, not just the forward three: the
// motif rules in HEAP/scripts/analysis_summaries/summarize_mr_triads.R are
// defined by which reverse edges are ABSENT, so an absent edge is data, not a
// blank. Drawn in SVG rather than Plotly because the placement of curves,
// arrowheads and label boxes has to be exact.
// ---------------------------------------------------------------------------

// --- geometry, in the same units mr_diagram.R uses -------------------------
const S = 62;                                   // px per diagram unit
const XMIN = -1.45; const XMAX = 11.45;
const YMIN = -2.80; const YMAX = 4.05;
const W = (XMAX - XMIN) * S;
const H = (YMAX - YMIN) * S;
const X = (x) => (x - XMIN) * S;                // math x -> svg x
const Y = (y) => (YMAX - y) * S;                // math y (up) -> svg y (down)
const NODE_R = 0.88;                            // drawn circle radius
const SHORTEN = 0.95;                           // node_radius in mr_diagram.R

const NODES = {
  E: { x: 0, y: 0, role: 'Exposure' },
  P: { x: 5, y: 3, role: 'Protein' },
  D: { x: 10, y: 0, role: 'Disease' },
};

// One entry per directed relationship. `curve`/`side` reproduce the bow of the
// reverse edges in mr_diagram.R; `off` pushes the label box off the edge.
const EDGES = [
  {
    key: 'EP', from: 'E', to: 'P', dir: 'forward', curve: 0, side: 0, off: 0.45,
    flag: 'pEP', cis: 'EP', name: 'Exposure → Protein',
    meaning: 'the exposure moves the protein',
  },
  {
    key: 'PD', from: 'P', to: 'D', dir: 'forward', curve: 0, side: 0, off: 0.45,
    flag: 'pPD', cis: 'PDcis', trans: 'PDtrans', name: 'Protein → Disease',
    meaning: 'the protein moves disease risk',
  },
  {
    key: 'ED', from: 'E', to: 'D', dir: 'forward', curve: 0, side: 0, off: 0.5,
    flag: 'pED', cis: 'ED', name: 'Exposure → Disease',
    meaning: 'the exposure moves disease risk',
  },
  {
    key: 'PE', from: 'P', to: 'E', dir: 'reverse', curve: 0.34, side: -1, off: 0.35,
    flag: 'pPE', cis: 'PEcis', trans: 'PEtrans', name: 'Protein → Exposure',
    meaning: 'the protein moves the exposure (reverse of E → P)',
  },
  {
    key: 'DP', from: 'D', to: 'P', dir: 'reverse', curve: 0.34, side: -1, off: 0.35,
    flag: 'pDP', cis: 'DP', name: 'Disease → Protein',
    meaning: 'disease liability moves the protein (the protein reports the disease)',
  },
  {
    key: 'DE', from: 'D', to: 'E', dir: 'reverse', curve: 0.24, side: -1, off: 0.28,
    flag: 'pDE', cis: 'DE', name: 'Disease → Exposure',
    meaning: 'disease liability moves the exposure',
  },
];

// --- the evidence ladder ----------------------------------------------------
// Four states, never three. Tier 1 is strictly stricter than an FDR q < 0.05:
// across all 18,780 published triads no edge is in the Tier-1 set without
// q < 0.05, while 2,605 edges clear q < 0.05 and still miss Tier 1. Collapsing
// those into one "not significant" bucket would be wrong, and so would
// collapsing either of them into "not tested" (S7).
const STATES = {
  tier1: {
    id: 'tier1',
    short: 'Tier-1 edge',
    long: 'in the Tier-1 edge set (MR + Steiger significant and forward-oriented)',
    dash: null, width: 0.075, opacity: 1, textOpacity: 1,
  },
  sub: {
    id: 'sub',
    short: 'FDR q < 0.05, below Tier 1',
    long: 'MR estimate passes FDR q < 0.05 but the edge is not in the Tier-1 set',
    dash: '7 5', width: 0.05, opacity: 0.5, textOpacity: 0.85,
  },
  ns: {
    id: 'ns',
    short: 'tested, q ≥ 0.05',
    long: 'tested; the MR estimate does not pass FDR q < 0.05',
    dash: '5 5', width: 0.04, opacity: 0.38, textOpacity: 0.75,
  },
  untested: {
    id: 'untested',
    short: 'not tested',
    long: 'no MR estimate for this direction in this arm',
    dash: '1 6', width: 0.04, opacity: 0.4, textOpacity: 0.7,
  },
};

const DIR_COLOR = { forward: '#1f4e79', reverse: '#b2182b' };
const GRAY = '#8d8d8d';

// Number(null) is 0 and passes Number.isFinite, so every "is this value
// present?" test has to reject null/undefined before converting -- otherwise a
// missing estimate reads as a real zero.
const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

const stateOf = (present, padj) => {
  if (!isNum(padj)) return STATES.untested;
  if (present) return STATES.tier1;
  return Number(padj) < 0.05 ? STATES.sub : STATES.ns;
};

// Colour keeps the direction readable even when the edge fades: Tier-1 edges
// carry the full forward/reverse colour, everything weaker goes gray.
const colorOf = (edge, state) => (state.id === 'tier1' ? DIR_COLOR[edge.dir] : GRAY);

// --- number formatting ------------------------------------------------------
// heap_pstars() from HEAP/scripts/visualizations/common/plot_theme.R.
const stars = (p) => {
  if (!isNum(p)) return '';
  const v = Number(p);
  if (v < 0.001) return '***';
  if (v < 0.01) return '**';
  if (v < 0.05) return '*';
  return '';
};

const fmtBeta = (b) => {
  if (!isNum(b)) return null;
  const v = Number(b);
  const a = Math.abs(v);
  if (a !== 0 && a < 0.001) return v.toExponential(1);
  return v.toFixed(3);
};

const fmtP = (p) => {
  if (!isNum(p)) return '—';
  const v = Number(p);
  return v === 0 ? '< 1e-300' : v.toPrecision(3);
};

const fmtSE = (s) => {
  if (!isNum(s)) return '—';
  const v = Number(s);
  return Math.abs(v) < 0.001 ? v.toExponential(1) : v.toFixed(4);
};

const ci = (b, se) => {
  if (!isNum(b) || !isNum(se)) return '—';
  return `[${fmtBeta(Number(b) - 1.96 * Number(se))}, ${fmtBeta(Number(b) + 1.96 * Number(se))}]`;
};

// Greedy word wrap for node captions; SVG has no text flow of its own.
function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; } else { cur = next; }
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    const dropped = words.join(' ').length > lines.join(' ').length;
    if (dropped) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[ ,;]+$/, '')}…`;
  }
  return lines;
}

// Path, label anchor and the label's own geometry for one directed edge.
function geometry(edge) {
  const a = NODES[edge.from];
  const b = NODES[edge.to];
  const dx = b.x - a.x; const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  const x1 = a.x + (SHORTEN * dx) / L; const y1 = a.y + (SHORTEN * dy) / L;
  const x2 = b.x - (SHORTEN * dx) / L; const y2 = b.y - (SHORTEN * dy) / L;
  const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
  const dx2 = x2 - x1; const dy2 = y2 - y1;
  const L2 = Math.hypot(dx2, dy2);
  const ux = -dy2 / L2; const uy = dx2 / L2;          // left-hand normal
  const bend = edge.curve * edge.side * L2;
  const cx = mx + bend * ux; const cy = my + bend * uy;
  const d = edge.curve === 0
    ? `M ${X(x1)} ${Y(y1)} L ${X(x2)} ${Y(y2)}`
    : `M ${X(x1)} ${Y(y1)} Q ${X(cx)} ${Y(cy)} ${X(x2)} ${Y(y2)}`;
  // Quadratic Bezier midpoint is (chord midpoint + control) / 2.
  const bx = edge.curve === 0 ? mx : (mx + cx) / 2;
  const by = edge.curve === 0 ? my : (my + cy) / 2;
  return { d, lx: bx - edge.off * ux, ly: by - edge.off * uy };
}

const LABEL_FONT = 14;
const labelWidth = (text) => text.length * LABEL_FONT * 0.55 + 16;

export default function TriadDAG({ triad, instrument = 'cis', maxWidth = 900 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const boxRef = useRef(null);
  const [hover, setHover] = useState(null);

  const exposureColor = ecatColor(triad.category);

  // One descriptor per directed relationship: which estimate is on show, what
  // rung of the ladder it sits on, and everything the hover card needs.
  const drawn = useMemo(() => EDGES.map((edge) => {
    const hasTrans = Boolean(edge.trans);
    const shown = hasTrans && instrument === 'trans' ? edge.trans : edge.cis;
    const est = triad.est[shown] || {};
    const state = stateOf(triad.flags[edge.flag], est.padj);
    const beta = fmtBeta(est.beta);
    const g = geometry(edge);
    const text = beta === null ? 'not tested' : `β = ${beta}${stars(est.padj)}`;
    // The line style follows the direction's Tier-1 membership, but the label
    // carries one instrument set's estimate. When a Tier-1 direction is being
    // shown through the instrument set that does not itself clear q < 0.05, the
    // label is styled down so a solid arrow never implies a significant number.
    const sigShown = isNum(est.padj) && Number(est.padj) < 0.05;
    return {
      edge,
      shown,
      est,
      state,
      sigShown,
      mixed: state.id === 'tier1' && !sigShown,
      color: colorOf(edge, state),
      text,
      // The Tier-1 flag is per direction; P → D and P → E pool cis and trans
      // instruments, so a direction can be in the Tier-1 set on the strength of
      // the instrument set that is not currently on show.
      instrumentLabel: hasTrans
        ? `${instrument}-pQTL instruments`
        : (edge.key === 'EP' || edge.key === 'ED' ? 'exposure GWAS instruments' : 'disease GWAS instruments'),
      ...g,
    };
  }), [triad, instrument]);

  const colors = [...new Set(drawn.map((e) => e.color))];

  const onMove = (e) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r) setHover((h) => (h ? { ...h, px: e.clientX - r.left, py: e.clientY - r.top } : h));
  };

  const eLines = wrap(triad.exposureLabel, 20, 4);
  const dLines = wrap(triad.diseaseLabel, 20, 4);
  const symbolFont = triad.protein.length > 6 ? 17 : 22;

  return (
    <Box>
      <Box ref={boxRef} sx={{ position: 'relative', width: '100%' }} onMouseMove={onMove}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={
            `Directed graph of ${triad.exposureLabel}, ${triad.protein} and ${triad.diseaseLabel} `
            + `with its six Mendelian randomization edges`
          }
          style={{ width: '100%', height: 'auto', maxWidth, display: 'block', background: '#fff' }}
        >
          <defs>
            {colors.map((c, i) => (
              <marker
                key={c}
                id={`${uid}-arrow-${i}`}
                viewBox="0 0 10 10"
                refX="9.2"
                refY="5"
                markerWidth="13"
                markerHeight="13"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
              </marker>
            ))}
          </defs>

          {/* edges, drawn first so the node circles and label boxes sit on top */}
          {drawn.map((e) => (
            <g key={e.edge.key} opacity={e.state.opacity}>
              <path
                d={e.d}
                fill="none"
                stroke={e.color}
                strokeWidth={e.state.width * S}
                strokeDasharray={e.state.dash || undefined}
                strokeLinecap={e.state.id === 'untested' ? 'round' : 'butt'}
                markerEnd={`url(#${uid}-arrow-${colors.indexOf(e.color)})`}
              />
            </g>
          ))}

          {/* wide invisible hit areas so thin, faded edges are still hoverable */}
          {drawn.map((e) => (
            <path
              key={`hit-${e.edge.key}`}
              d={e.d}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(ev) => {
                const r = boxRef.current?.getBoundingClientRect();
                setHover({
                  key: e.edge.key,
                  px: r ? ev.clientX - r.left : 0,
                  py: r ? ev.clientY - r.top : 0,
                });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <title>
                {`${e.edge.name} — ${e.text}, ${e.state.short}`}
              </title>
            </path>
          ))}

          {/* nodes */}
          {[
            { k: 'E', ring: exposureColor, lines: eLines, below: true },
            { k: 'D', ring: '#555555', lines: dLines, below: true },
            { k: 'P', ring: '#1f4e79', lines: null, below: false },
          ].map(({ k, ring, lines, below }) => {
            const n = NODES[k];
            return (
              <g key={k}>
                <circle
                  cx={X(n.x)} cy={Y(n.y)} r={NODE_R * S}
                  fill="#ffffff" stroke={ring} strokeWidth={3.4}
                />
                {k === 'P' ? (
                  <>
                    <text
                      x={X(n.x)} y={Y(n.y) - 12} textAnchor="middle"
                      fontSize={12} fill="#666" letterSpacing="1.2"
                    >
                      PROTEIN
                    </text>
                    <text
                      x={X(n.x)} y={Y(n.y) + 14} textAnchor="middle"
                      fontSize={symbolFont} fontWeight="700" fill="#1a1a1a"
                    >
                      {triad.protein}
                    </text>
                  </>
                ) : (
                  <text
                    x={X(n.x)} y={Y(n.y) + 5} textAnchor="middle"
                    fontSize={13} fill="#555" letterSpacing="1.2"
                  >
                    {n.role.toUpperCase()}
                  </text>
                )}
                {below && lines.map((ln, i) => (
                  <text
                    key={ln + i}
                    x={X(n.x)} y={Y(-1.30 - i * 0.40)} textAnchor="middle"
                    fontSize={16} fontWeight={i === 0 ? 700 : 500} fill="#1a1a1a"
                  >
                    {ln}
                  </text>
                ))}
              </g>
            );
          })}

          {/* effect labels, in white boxes on top of everything */}
          {drawn.map((e) => {
            const w = labelWidth(e.text);
            const h = LABEL_FONT + 10;
            const active = hover?.key === e.edge.key;
            return (
              <g
                key={`lab-${e.edge.key}`}
                opacity={e.state.textOpacity}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(ev) => {
                  const r = boxRef.current?.getBoundingClientRect();
                  setHover({
                    key: e.edge.key,
                    px: r ? ev.clientX - r.left : 0,
                    py: r ? ev.clientY - r.top : 0,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={X(e.lx) - w / 2} y={Y(e.ly) - h / 2} width={w} height={h} rx={4}
                  fill="#ffffff"
                  stroke={e.sigShown ? e.color : '#c2c2c2'}
                  strokeDasharray={e.mixed ? '4 3' : undefined}
                  strokeWidth={active ? 2 : 1}
                />
                <text
                  x={X(e.lx)} y={Y(e.ly) + 5} textAnchor="middle"
                  fontSize={LABEL_FONT}
                  fontWeight={e.state.id === 'tier1' && e.sigShown ? 700 : 400}
                  fill={e.state.id === 'tier1' && e.sigShown ? '#1a1a1a' : '#5a5a5a'}
                >
                  {e.text}
                </text>
                <title>{`${e.edge.name} — ${e.state.short}`}</title>
              </g>
            );
          })}
        </svg>

        {hover && (() => {
          const e = drawn.find((x) => x.edge.key === hover.key);
          if (!e) return null;
          return (
            <Paper
              elevation={6}
              data-testid="triad-edge-tooltip"
              sx={{
                position: 'absolute',
                left: hover.px, top: hover.py,
                // Flip below the cursor near the top of the diagram, where a
                // card anchored above would sit off the panel.
                transform: hover.py < 190
                  ? 'translate(-50%, 16px)'
                  : 'translate(-50%, calc(-100% - 14px))',
                p: 1.25, minWidth: 250, maxWidth: 330,
                pointerEvents: 'none', zIndex: 5,
                borderLeft: `4px solid ${e.color}`,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {e.edge.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                {e.edge.meaning} · {e.instrumentLabel}
              </Typography>
              {isNum(e.est.beta) ? (
                <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.2, rowGap: 0.2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>β</Typography>
                  <Typography variant="caption">{fmtBeta(e.est.beta)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>SE</Typography>
                  <Typography variant="caption">{fmtSE(e.est.se)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>95% CI</Typography>
                  <Typography variant="caption">{ci(e.est.beta, e.est.se)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>FDR q</Typography>
                  <Typography variant="caption">{fmtP(e.est.padj)}</Typography>
                </Box>
              ) : (
                <Typography variant="caption">No MR estimate for this direction.</Typography>
              )}
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.75, fontWeight: 600, color: e.color }}
              >
                {e.state.long}
              </Typography>
              {e.mixed && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                  Tier-1 membership is held by the direction, not by this instrument set — the
                  estimate shown does not itself clear q &lt; 0.05.
                </Typography>
              )}
            </Paper>
          );
        })()}
      </Box>

      {/* legend: the ladder, spelled out rather than a single "significant" badge */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mt: 1, mb: 1.5 }}>
        {[
          { st: STATES.tier1, c: DIR_COLOR.forward, t: 'Tier-1 edge (forward)' },
          { st: STATES.tier1, c: DIR_COLOR.reverse, t: 'Tier-1 edge (reverse)' },
          { st: STATES.sub, c: GRAY, t: 'FDR q < 0.05, not Tier 1' },
          { st: STATES.ns, c: GRAY, t: 'tested, q ≥ 0.05' },
          { st: STATES.untested, c: GRAY, t: 'not tested' },
        ].map(({ st, c, t }) => (
          <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <svg width="40" height="10" aria-hidden="true">
              <line
                x1="1" y1="5" x2="39" y2="5"
                stroke={c} strokeWidth={st.width * S} strokeDasharray={st.dash || undefined}
                strokeLinecap={st.id === 'untested' ? 'round' : 'butt'} opacity={st.opacity}
              />
            </svg>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{
            width: 14, height: 14, borderRadius: '50%',
            border: `3px solid ${exposureColor}`, background: '#fff',
          }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            exposure ring = {String(triad.category).replace(/_/g, ' ')}
          </Typography>
        </Box>
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        Stars mark the FDR-adjusted p on the edge label (*** q &lt; 0.001, ** q &lt; 0.01,
        * q &lt; 0.05), the same rule the manuscript figure uses. Solid versus faint is the
        Tier-1 edge set, which is stricter than q &lt; 0.05 — it also requires a Steiger test
        that is significant and forward-oriented, so an edge can clear q &lt; 0.05 and still be
        absent from the motif. Hover any edge or label for β, SE, 95% CI and q.
      </Typography>

      {/* every estimate behind the diagram, including the instrument set not on show.
          Seven columns do not fit a phone, so the table scrolls inside its own box
          rather than pushing the page sideways. */}
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 660, '& td, & th': { fontSize: 12.5 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Direction</TableCell>
            <TableCell>Evidence</TableCell>
            <TableCell>Instruments</TableCell>
            <TableCell align="right">β</TableCell>
            <TableCell align="right">SE</TableCell>
            <TableCell align="right">95% CI</TableCell>
            <TableCell align="right">FDR q</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {EDGES.flatMap((edge) => {
            const sets = edge.trans
              ? [[edge.cis, 'cis-pQTL'], [edge.trans, 'trans-pQTL']]
              : [[edge.cis, edge.key === 'EP' || edge.key === 'ED' ? 'exposure GWAS' : 'disease GWAS']];
            // The evidence label is a property of the direction, so it spans the
            // instrument rows rather than being repeated against each estimate.
            const best = sets
              .map(([col]) => (triad.est[col] || {}).padj)
              .filter((p) => isNum(p))
              .reduce((a, b) => (a === null || Number(b) < Number(a) ? b : a), null);
            const st = stateOf(triad.flags[edge.flag], best);
            return sets.map(([col, instLabel], i) => {
              const est = triad.est[col] || {};
              return (
                <TableRow key={col} hover>
                  {i === 0 && (
                    <TableCell rowSpan={sets.length} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <Box component="span" sx={{ color: DIR_COLOR[edge.dir] }}>
                        {edge.name}
                      </Box>
                    </TableCell>
                  )}
                  {i === 0 && (
                    <TableCell
                      rowSpan={sets.length}
                      sx={{ color: st.id === 'tier1' ? DIR_COLOR[edge.dir] : 'text.secondary' }}
                    >
                      {st.short}
                    </TableCell>
                  )}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{instLabel}</TableCell>
                  <TableCell align="right">{fmtBeta(est.beta) ?? '—'}</TableCell>
                  <TableCell align="right">{fmtSE(est.se)}</TableCell>
                  <TableCell align="right">{ci(est.beta, est.se)}</TableCell>
                  <TableCell align="right">{fmtP(est.padj)}</TableCell>
                </TableRow>
              );
            });
          })}
        </TableBody>
      </Table>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
        Tier-1 membership is recorded per direction, and the protein&rarr;disease and
        protein&rarr;exposure directions pool cis- and trans-pQTL instruments — so both rows of
        such a pair carry the same evidence label while their estimates differ.
      </Typography>
    </Box>
  );
}

export { EDGES, STATES, stateOf, DIR_COLOR };
