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

// A triad's edges are evidenced from three sources: UK Biobank (exposures,
// Olink proteins, exposure GWAS), deCODE (SomaScan pQTLs -- alternative protein
// instruments) and FinnGen (disease GWAS).
//
// deCODE is an alternative PROTEIN panel, so every edge with the protein at
// either end can be recomputed there -- E->P and D->P with the protein as the
// outcome, P->D and P->E with it as the exposure. The two edges with no protein
// (E->D, D->E) come from UKB/FinnGen and are identical across panels.
//
// So deCODE corroborates the protein-involving edges; it never classifies a
// triad by itself, because a triad still needs E->D / D->E. The motif stays
// UK Biobank-anchored, which is what the Tier 1+ rung already encodes.
const DECODE_EDGES = new Set(['EP', 'PD', 'PE', 'DP']);

// Which samples each direction pairs, and whether the protein is involved at
// all. `splitSample` marks the case where BOTH sides come from UK Biobank, so
// two-sample MR is achieved by holding out non-overlapping participants rather
// than by using a second cohort.
const PAIRING = {
  EP: { flow: 'UKB exposure GWAS → protein', protein: true, splitSample: true,
        note: 'protein is the outcome, so the platform is the measurement' },
  PD: { flow: 'protein pQTL → FinnGen R12', protein: true, splitSample: false,
        note: 'protein is the exposure, so the platform supplies the instrument' },
  ED: { flow: 'UKB exposure GWAS → FinnGen R12', protein: false, splitSample: false,
        note: 'no protein — identical in both panels' },
  PE: { flow: 'protein pQTL → UKB exposure GWAS', protein: true, splitSample: true,
        note: 'protein is the exposure, so the platform supplies the instrument' },
  DP: { flow: 'FinnGen R12 → protein', protein: true, splitSample: false,
        note: 'protein is the outcome, so the platform is the measurement' },
  DE: { flow: 'FinnGen R12 → UKB exposure GWAS', protein: false, splitSample: false,
        note: 'no protein — identical in both panels' },
};

// mr_tier_final for each (edge, panel) of this triad, so Tier 1+ can be shown
// distinctly. The presence flags the motif rules use are true for Tier1 OR
// Tier1plus, so without this the strongest rung is invisible.
const TIER_LABEL = {
  Tier1plus: 'Tier 1+', Tier1: 'Tier 1', Tier2: 'Tier 2',
  Suggestive: 'Suggestive', Reverse: 'Reverse', Null: 'not significant', '': '—',
};

export default function TriadDAG({
  triad, decode, tiers, instrument = 'cis', maxWidth = 900, showAll = false,
}) {
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
    // The interval is what makes an effect readable at a glance, so it rides on
    // the edge label rather than living only in the table (rule 2).
    const ciText = (isNum(est.beta) && isNum(est.se))
      ? `[${fmtBeta(Number(est.beta) - 1.96 * Number(est.se))}, `
        + `${fmtBeta(Number(est.beta) + 1.96 * Number(est.se))}]`
      : null;
    // The line style follows the direction's Tier-1 membership, but the label
    // carries one instrument set's estimate. When a Tier-1 direction is being
    // shown through the instrument set that does not itself clear q < 0.05, the
    // label is styled down so a solid arrow never implies a significant number.
    const sigShown = isNum(est.padj) && Number(est.padj) < 0.05;
    // deCODE corroboration, protein-origin edges only.
    const dec = decode && DECODE_EDGES.has(edge.key) ? (decode[shown] || null) : null;
    const decSig = dec && isNum(dec.padj) && Number(dec.padj) < 0.05;
    return {
      edge,
      shown,
      est,
      state,
      sigShown,
      dec,
      decSig,
      decText: dec && isNum(dec.beta)
        ? `deCODE β = ${fmtBeta(dec.beta)}${stars(dec.padj)}`
        : (DECODE_EDGES.has(edge.key) ? 'deCODE: not estimated' : null),
      mixed: state.id === 'tier1' && !sigShown,
      color: colorOf(edge, state),
      text,
      ciText,
      // The Tier-1 flag is per direction; P → D and P → E pool cis and trans
      // instruments, so a direction can be in the Tier-1 set on the strength of
      // the instrument set that is not currently on show.
      instrumentLabel: hasTrans
        ? `${instrument}-pQTL instruments`
        : (edge.key === 'EP' || edge.key === 'ED' ? 'exposure GWAS instruments' : 'disease GWAS instruments'),
      ...g,
    };
  }), [triad, instrument, decode]);

  // Rule 2, after main Figure 4e: the diagram shows the SUPPORTED edges and
  // states their interval. Non-significant edges are not drawn -- they would
  // trade the figure's readability for information the table already carries in
  // full (rule 3). `showAll` restores them for anyone who wants the full graph.
  const visible = showAll ? drawn : drawn.filter((e) => e.state.id === 'tier1' || e.sigShown);

  const colors = [...new Set(visible.map((e) => e.color))];

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
          {visible.map((e) => (
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
          {visible.map((e) => (
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
          {visible.map((e) => {
            const w = Math.max(labelWidth(e.text), e.ciText ? labelWidth(e.ciText) : 0);
            const h = LABEL_FONT + (e.ciText ? 22 : 10);
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
                  x={X(e.lx)} y={Y(e.ly) + (e.ciText ? 0 : 5)} textAnchor="middle"
                  fontSize={LABEL_FONT}
                  fontWeight={e.state.id === 'tier1' && e.sigShown ? 700 : 400}
                  fill={e.state.id === 'tier1' && e.sigShown ? '#1a1a1a' : '#5a5a5a'}
                >
                  {e.text}
                </text>
                {e.ciText && (
                  <text
                    x={X(e.lx)} y={Y(e.ly) + 12} textAnchor="middle"
                    fontSize={LABEL_FONT - 2} fill="#6a6a6a"
                  >
                    {e.ciText}
                  </text>
                )}
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
      <Table size="small" sx={{ minWidth: 640, '& td, & th': { fontSize: 12.5 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Panel</TableCell>
            <TableCell>Instruments</TableCell>
            <TableCell align="right">β&nbsp;[95%&nbsp;CI]</TableCell>
            <TableCell align="right">FDR q</TableCell>
            <TableCell>Evidence</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {EDGES.map((edge) => {
            // One group per direction. The sample pairing is a property of the
            // DIRECTION, so it is stated once in the header instead of being
            // repeated on every estimate; the rows underneath differ only by
            // which panel and which instrument class produced them.
            const pairing = PAIRING[edge.key];
            // Instrument label by ORIGIN, not by the source table's "polygenic",
            // which reads as a polygenic score. These are genome-wide significant
            // SNPs for whichever trait sits at the tail of the arrow.
            const gwasLabel = edge.from === 'E' ? 'exposure GWAS' : 'disease GWAS';
            const sets = edge.trans
              ? [[edge.cis, 'cis-pQTL'], [edge.trans, 'trans-pQTL']]
              : [[edge.cis, gwasLabel]];
            const best = sets
              .map(([col]) => (triad.est[col] || {}).padj)
              .filter((p) => isNum(p))
              .reduce((a, b) => (a === null || Number(b) < Number(a) ? b : a), null);
            const st = stateOf(triad.flags[edge.flag], best);

            const rows = [];
            sets.forEach(([col, cls]) => {
              rows.push({ col, cls, panel: 'UKB', est: triad.est[col] || {} });
              if (DECODE_EDGES.has(edge.key)) {
                rows.push({ col, cls, panel: 'deCODE', est: (decode || {})[col] || {} });
              }
            });

            return [
              <TableRow key={`h-${edge.key}`} sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={5} sx={{ py: 0.75 }}>
                  <Box component="span" sx={{ fontWeight: 700, color: DIR_COLOR[edge.dir] }}>
                    {edge.name}
                  </Box>
                  <Box component="span" sx={{ color: 'text.secondary', ml: 1 }}>
                    {pairing.flow}
                  </Box>
                  <Box component="span" sx={{ color: 'text.disabled', ml: 1 }}>
                    · {pairing.note}
                  </Box>
                  <Box component="span" sx={{ float: 'right', color: st.id === 'tier1' ? DIR_COLOR[edge.dir] : 'text.secondary', fontWeight: 600 }}>
                    {st.short}
                  </Box>
                </TableCell>
              </TableRow>,
              ...rows.map(({ col, cls, panel, est }) => {
                const plat = panel === 'UKB' ? 'Olink' : 'SomaScan';
                const split = pairing.splitSample && panel === 'UKB';
                const b = isNum(est.beta) ? fmtBeta(est.beta) : null;
                const ci = (isNum(est.beta) && isNum(est.se))
                  ? `[${fmtBeta(Number(est.beta) - 1.96 * Number(est.se))}, ${fmtBeta(Number(est.beta) + 1.96 * Number(est.se))}]`
                  : null;
                const sig = isNum(est.padj) && Number(est.padj) < 0.05;
                return (
                  <TableRow key={`${edge.key}-${col}-${panel}`} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {pairing.protein ? (
                        <>
                          <b>{plat}</b>
                          <Typography component="span" variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                            {panel === 'UKB' ? 'UK Biobank' : 'deCODE'}
                            {split ? ' · split-sample' : ' · two-cohort'}
                          </Typography>
                        </>
                      ) : (
                        <Box component="span" sx={{ color: 'text.secondary' }}>no protein</Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{cls}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: sig ? 600 : 400 }}>
                      {b === null ? (
                        <Box component="span" sx={{ color: 'text.disabled' }}>not estimated</Box>
                      ) : (
                        <>
                          {b}{stars(est.padj)}
                          {ci && (
                            <Typography component="span" variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                              {ci}
                            </Typography>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell align="right">{b === null ? '—' : fmtP(est.padj)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {(() => {
                        const t = tiers ? tiers[`tier_${col}_${panel === 'UKB' ? 'UKB' : 'DECODE'}`] : null;
                        if (!t) return <Box component="span" sx={{ color: 'text.disabled' }}>{b === null ? '—' : (sig ? 'q < 0.05' : 'n.s.')}</Box>;
                        const best = t === 'Tier1plus';
                        return (
                          <Box component="span" sx={{
                            fontWeight: best ? 700 : (t === 'Tier1' ? 600 : 400),
                            color: best ? '#1b7837' : (t === 'Tier1' ? 'text.primary' : 'text.disabled'),
                          }}>
                            {TIER_LABEL[t] || t}
                            {best && (
                              <Typography component="span" variant="caption" sx={{ display: 'block', color: '#1b7837' }}>
                                replicated in both panels
                              </Typography>
                            )}
                          </Box>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              }),
            ];
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
