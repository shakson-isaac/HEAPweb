import React from 'react';
import { Box } from '@mui/material';
import { motifColor } from '../lib/palette';

// ---------------------------------------------------------------------------
// A motif as a small picture: the exposure -> protein -> disease triangle with
// this motif's six edges drawn in their required state.
//
// The point is RECOGNITION. A reader who picks "A · mediator" in the browser
// should meet the same shape in the triad explorer and know without reading
// that they arrived where they meant to. A letter and a name do not do that;
// the picture does.
//
// Geometry is deliberately the same as MotifKey.js and TriadDAG.js, which in
// turn follow heap_plot_triplet_mr_diagram() in mr_diagram.R (main Fig 4e):
// Exposure (0,0), Protein (5,3), Disease (10,0), forward edges bowing one way
// and reverse edges the other so a pair never overlaps. Same picture at three
// sizes, not three drawings of the same idea.
//
// Signature characters come straight from mr_motif_key:
//   '+'  required present    -> solid, in the motif's colour
//   '-'  required ABSENT     -> dashed and faint. An absent edge is data, not
//                               a blank: the motif rules in
//                               summarize_mr_triads.R are defined by which
//                               reverse edges are missing.
//   '.'  unconstrained       -> not drawn at all
// ---------------------------------------------------------------------------

const XMIN = -1.9; const XMAX = 11.9;
const YMIN = -1.4; const YMAX = 4.4;
const NODES = {
  E: { x: 0, y: 0 },
  P: { x: 5, y: 3 },
  D: { x: 10, y: 0 },
};
// Edge order matches the sig_N_XY columns, so index 0 is edge 1 (E->P).
const EDGES = [
  { key: 'sig_1_EP', from: 'E', to: 'P', curve: 0.55 },
  { key: 'sig_2_PD', from: 'P', to: 'D', curve: 0.55 },
  { key: 'sig_3_ED', from: 'E', to: 'D', curve: 0.42 },
  { key: 'sig_4_PE', from: 'P', to: 'E', curve: 0.55 },
  { key: 'sig_5_DP', from: 'D', to: 'P', curve: 0.55 },
  { key: 'sig_6_DE', from: 'D', to: 'E', curve: 0.42 },
];

const NODE_RX = 1.15; const NODE_RY = 0.7;

function trim(x0, y0, x1, y1) {
  const dx = x1 - x0; const dy = y1 - y0;
  const t = Math.hypot(dx / NODE_RX, dy / NODE_RY);
  if (!t) return { x: x1, y: y1 };
  return { x: x1 - (dx / t) * 1.02, y: y1 - (dy / t) * 1.02 };
}

export default function MotifGlyph({ motif, sig, size = 74, title }) {
  const S = size / (XMAX - XMIN);
  const W = (XMAX - XMIN) * S;
  const H = (YMAX - YMIN) * S;
  const X = (x) => (x - XMIN) * S;
  const Y = (y) => (YMAX - y) * S;
  const col = motifColor(motif);
  const aid = `mg-${motif}`;

  return (
    <Box
      component="svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={title || `Motif ${motif}`}
      sx={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <marker id={aid} viewBox="0 0 8 8" refX="6" refY="4"
                markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1 L 7 4 L 0 7 z" fill={col} />
        </marker>
      </defs>

      {EDGES.map((e) => {
        const s = sig?.[e.key];
        if (!s || s === '.') return null;             // unconstrained: not drawn
        const a = NODES[e.from]; const b = NODES[e.to];
        const p0 = trim(b.x, b.y, a.x, a.y);
        const p1 = trim(a.x, a.y, b.x, b.y);
        const mx = (p0.x + p1.x) / 2; const my = (p0.y + p1.y) / 2;
        const dx = p1.x - p0.x; const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const cx = mx - (dy / len) * e.curve;
        const cy = my + (dx / len) * e.curve;
        const present = s === '+';
        // The x on an absent edge is not decoration. At this size a dashed
        // line reads as "faint arrow" and motifs A and B -- three solid arcs
        // each, differing only in WHICH reverse edges are forbidden -- become
        // indistinguishable. The same x the reading key's signature matrix
        // uses, so the two agree symbol for symbol.
        const mid = { x: X((p0.x + 2 * cx + p1.x) / 4), y: Y((p0.y + 2 * cy + p1.y) / 4) };
        const r = Math.max(3, S * 0.34);
        return (
          <g key={e.key}>
            <path
              d={`M ${X(p0.x)} ${Y(p0.y)} Q ${X(cx)} ${Y(cy)} ${X(p1.x)} ${Y(p1.y)}`}
              fill="none"
              stroke={present ? col : '#9e9e9e'}
              strokeWidth={present ? 2.1 : 1.2}
              strokeDasharray={present ? undefined : '2.5 2.5'}
              opacity={present ? 1 : 0.8}
              markerEnd={present ? `url(#${aid})` : undefined}
            />
            {!present && (
              <>
                <circle cx={mid.x} cy={mid.y} r={r} fill="#fff" opacity="0.95" />
                <path
                  d={`M ${mid.x - r * 0.6} ${mid.y - r * 0.6} L ${mid.x + r * 0.6} ${mid.y + r * 0.6}
                      M ${mid.x + r * 0.6} ${mid.y - r * 0.6} L ${mid.x - r * 0.6} ${mid.y + r * 0.6}`}
                  stroke="#777"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </>
            )}
          </g>
        );
      })}

      {Object.entries(NODES).map(([k, n]) => (
        <g key={k}>
          <ellipse
            cx={X(n.x)}
            cy={Y(n.y)}
            rx={NODE_RX * S}
            ry={NODE_RY * S}
            fill="#fff"
            stroke="#555"
            strokeWidth="1"
          />
          <text
            x={X(n.x)}
            y={Y(n.y) + 3.2}
            textAnchor="middle"
            style={{ fontSize: Math.max(8, S * 0.9), fontWeight: 700, fill: '#333' }}
          >
            {k}
          </text>
        </g>
      ))}
    </Box>
  );
}
