import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { useSection } from '../../lib/useSection';
import { WEB_DATA_BASE } from '../../lib/heapdata';

// ---------------------------------------------------------------------------
// The landing figure: every plasma protein placed by what genetics explains
// against what the exposome explains. Main-manuscript Figure 1b, carrying BOTH
// halves of the paper's claim rather than one.
//
// The cloud is the first half -- the exposome is written across the proteome.
// The named points are the second: of everything above the 1% line, only a
// handful carry Tier-1 Mendelian randomization evidence into disease. Showing
// them together is the whole argument in one picture, and it is why this figure
// headlines the site rather than a category bar chart.
//
// THE COUNT IS NOT ON THE PLOT, deliberately. The stat strip immediately below
// the figure already reads 2,686 proteins, and an "N exposure-responsive"
// annotation on the canvas was cut as clutter (2026-10-05).
//
// WHAT THE NAMED SET IS. meta/hero_causal.json.gz: proteins with at least one
// protein -> disease edge at Tier 1, either pQTL arm, cis or trans. That is NOT
// the manuscript's mediator-motif count (six triads across three proteins),
// which constrains all six edges of the motif. Do not relabel it as such.
//
// HAND-DRAWN SVG RATHER THAN PLOTLY, ON PURPOSE. This is the first paint of the
// site; pulling the charting bundle in to draw 2,686 circles would delay it.
// Hover is a linear nearest-point scan over the same array -- 2,686 distance
// tests per mousemove, which is far cheaper than the bundle would have been.
// Plotly still arrives in the background (prefetchCharts) for the results pages.
//
// Axes are square-root scaled. Both components are concentrated near zero, and
// on a linear axis the whole proteome collapses into the bottom-left corner.
// ---------------------------------------------------------------------------

const W = 460;
const H = 280;
const PAD = 40;
const THR = 0.01;          // the exposure-responsive line, as the paper draws it
const X_MAX = 0.70;
const Y_MAX = 0.17;
const LABEL = ['LEP', 'FABP4', 'CFH'];
const HIT = 14;            // px: how close the cursor must be to pick a protein

const sx = (v) => PAD + Math.sqrt(Math.min(v, X_MAX) / X_MAX) * (W - PAD - 14);
const sy = (v) => H - PAD - Math.sqrt(Math.min(v, Y_MAX) / Y_MAX) * (H - PAD - 18);
const pct = (v) => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`;

export default function ExposomeScatter() {
  const theme = useTheme();
  const h = theme.palette.heap;
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [causal, setCausal] = useState(null);
  const { data, loading, error } = useSection('geno_vs_expo_arch');

  // 0.3 KB. Fetched rather than derived in the browser: the tier table it comes
  // from is 20,064 rows, which the front door is not going to download.
  useEffect(() => {
    let alive = true;
    fetch(`${WEB_DATA_BASE}/meta/hero_causal.json.gz`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setCausal(d); })
      .catch(() => {});       // the figure is correct without the layer
    return () => { alive = false; };
  }, []);

  const pts = useMemo(() => {
    if (!data || !data.omic) return null;
    const out = [];
    for (let i = 0; i < data.omic.length; i += 1) {
      const g = data.Genetic_plot ? data.Genetic_plot[i] : null;
      const e = data.Exposome_plot ? data.Exposome_plot[i] : null;
      if (g === null || e === null || g === undefined || e === undefined) continue;
      out.push({ p: data.omic[i], g, e, resp: e >= THR, x: sx(g), y: sy(e) });
    }
    return out;
  }, [data]);

  // Nearest point to the cursor, in SVG user units. The viewBox maps 1:1 to the
  // drawing, so a client offset scales by the rendered width.
  const pick = useCallback((evt) => {
    const svg = svgRef.current;
    if (!svg || !pts) return;
    const r = svg.getBoundingClientRect();
    const k = W / r.width;
    const mx = (evt.clientX - r.left) * k;
    const my = (evt.clientY - r.top) * k;
    let best = null;
    let bestD = HIT * HIT;
    for (let i = 0; i < pts.length; i += 1) {
      const d = (pts[i].x - mx) ** 2 + (pts[i].y - my) ** 2;
      if (d < bestD) { bestD = d; best = pts[i]; }
    }
    setHover(best);
  }, [pts]);

  const open = useCallback(() => {
    if (hover) navigate(`/results/associations?protein=${encodeURIComponent(hover.p)}`);
  }, [hover, navigate]);

  if (loading || error || !pts || !pts.length) {
    // No skeleton and no error card: the page reads perfectly without the figure,
    // and a broken-looking box on the front door is worse than none.
    return <Box sx={{ minHeight: { xs: 0, md: 220 } }} />;
  }

  // Four of the named proteins sit within a few pixels of each other at low
  // genetic R², and their labels collided into each other on first render.
  // Labels are pushed apart vertically inside an x-bucket and given a leader
  // line back to their point when they move.
  const place = (entries) => {
    const GAP = 11;
    const buckets = new Map();
    entries.forEach((e) => {
      const k = Math.round(e.y0 / 1) && Math.floor(e.x0 / 56);
      const b = buckets.get(k) || [];
      b.push(e); buckets.set(k, b);
    });
    const out = [];
    buckets.forEach((b) => {
      b.sort((a, c) => a.y0 - c.y0);
      let last = -Infinity;
      b.forEach((e) => {
        const y = Math.max(e.y0, last + GAP);
        last = y;
        out.push({ ...e, y, moved: Math.abs(y - e.y0) > 1.5 });
      });
    });
    return out;
  };

  const responsive = pts.filter((d) => d.resp);
  const plain = pts.filter((d) => !d.resp);
  const labels = LABEL.map((name) => pts.find((d) => d.p === name)).filter(Boolean);
  const marked = (causal?.proteins || [])
    .map((r) => ({ ...r, pt: pts.find((d) => d.p === r.protein) }))
    .filter((r) => r.pt);
  const placed = place([
    ...marked.map((r) => ({ key: r.protein, text: r.protein, bold: true, x0: r.pt.x, y0: r.pt.y })),
    ...labels.map((d) => ({ key: d.p, text: d.p, bold: false, x0: d.x, y0: d.y })),
  ]);

  return (
    <figure style={{ margin: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Every plasma protein placed by genetic against exposomic variance explained. Proteins with Tier-1 causal evidence on disease are named."
        style={{ display: 'block', cursor: hover ? 'pointer' : 'default', touchAction: 'manipulation' }}
        onMouseMove={pick}
        onMouseLeave={() => setHover(null)}
        onClick={open}
      >
        <line x1={PAD} y1={H - PAD} x2={W - 8} y2={H - PAD} stroke={h.ink} strokeWidth={1} />
        <line x1={PAD} y1={12} x2={PAD} y2={H - PAD} stroke={h.ink} strokeWidth={1} />

        {/* the 1% line the paper draws */}
        <line
          x1={PAD} y1={sy(THR)} x2={W - 8} y2={sy(THR)}
          stroke={h.soft} strokeWidth={1} strokeDasharray="3 3" opacity={0.7}
        />

        {plain.map((d) => (
          <circle key={d.p} cx={d.x} cy={d.y} r={1.5} fill={h.soft} opacity={0.42} />
        ))}
        {responsive.map((d) => (
          <circle key={d.p} cx={d.x} cy={d.y} r={1.9} fill={h.accent} opacity={0.75} />
        ))}

        {/* The minority with causal evidence: a ring, so they read against the
            cloud without a second hue competing with the teal. */}
        {marked.map((r) => (
          <g key={r.protein}>
            <circle cx={r.pt.x} cy={r.pt.y} r={5.2} fill="none" stroke={h.paper} strokeWidth={2.4} />
            <circle cx={r.pt.x} cy={r.pt.y} r={5.2} fill="none" stroke={h.ink} strokeWidth={1.5} />
            <circle cx={r.pt.x} cy={r.pt.y} r={2} fill={h.ink} />
          </g>
        ))}

        {placed.map((l) => (
          <g key={l.key}>
            {l.moved && (
              <line
                x1={l.x0 + 4} y1={l.y0} x2={l.x0 + 7.5} y2={l.y - 2.5}
                stroke={l.bold ? h.ink : h.soft} strokeWidth={0.8} opacity={0.6}
              />
            )}
            <text
              x={l.x0 + 9} y={l.y + 3}
              fontSize={l.bold ? 9.5 : 9}
              fontWeight={l.bold ? 700 : 400}
              fill={l.bold ? h.ink : h.soft}
              stroke={h.paper} strokeWidth={2.6} paintOrder="stroke"
            >
              {l.text}
            </text>
          </g>
        ))}

        {hover && (
          <g pointerEvents="none">
            <circle cx={hover.x} cy={hover.y} r={4.5} fill="none" stroke={h.ink} strokeWidth={1.5} />
            <text
              x={Math.min(hover.x + 9, W - 150)} y={Math.max(hover.y - 9, 20)}
              fontSize={10.5} fontWeight={600} fill={h.ink}
              stroke={h.paper} strokeWidth={3} paintOrder="stroke"
            >
              {hover.p} — exposome {pct(hover.e)}, genetics {pct(hover.g)}
            </text>
          </g>
        )}

        <text
          x={PAD - 8} y={20} fontSize={9.5} fill={h.soft}
          transform={`rotate(-90 ${PAD - 8} 20)`} textAnchor="end"
        >
          exposomic R²
        </text>
        <text x={(W + PAD) / 2} y={H - 10} fontSize={9.5} fill={h.soft} textAnchor="middle">
          genetic R²
        </text>
      </svg>

      <Typography
        component="figcaption" variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontStyle: 'italic' }}
      >
        Each dot is one plasma protein. Named proteins carry Tier-1 Mendelian
        randomization evidence on disease. Hover for a protein; click to open it.
      </Typography>
    </figure>
  );
}
