import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useSection } from '../../lib/useSection';
import { WEB_DATA_BASE } from '../../lib/heapdata';

// ---------------------------------------------------------------------------
// The landing figure: every plasma protein placed by what genetics explains
// against what the exposome explains. Main-manuscript Figure 1b, carrying BOTH
// halves of the paper's claim rather than one.
//
// The cloud is the first half -- the exposome is written across the proteome.
// The layer control is the second: among the same proteins, 6 carry Tier-1 MR
// evidence INTO disease while ~500 carry it in the reverse direction, from
// disease or from the exposure. Six against five hundred is the paper's claim,
// and a visitor can switch between the three readings rather than take it on
// trust.
//
// ONE LAYER AT A TIME, NOT THREE COLORS. All six causal proteins are also both
// kinds of reporter, and 384 proteins are both reporter types, so a simultaneous
// three-way coloring is mud. The toggle also sets the default: `causal` opens
// first because 6 named points land immediately, where opening on a 496-protein
// wash would read as decoration.
//
// NAMES ONLY ON THE CAUSAL LAYER. 496 labels is not a figure. The reporter
// layers are a wash and rely on hover for identity.
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

// Plain words on the control, arrow notation in the legend. "D -> P" means
// nothing to someone who has not read the paper; "disease reporters" does.
// One hue per layer, and only one layer is ever drawn, so these never have to
// be told apart inside the plot -- the color ties the marks to the button that
// is pressed. All three are kept well away from the teal of the
// exposure-responsive cloud underneath them, and each clears 3:1 against its
// own page background in both modes (graphical-object minimum).
const LAYERS = [
  { id: 'causal', label: 'Causal intermediates', edge: 'P \u2192 D',
    criterion: 'cis-pQTL colocalized, PP.H4 \u2265 0.8',
    gloss: 'the protein moves disease risk',
    hue: { light: '#a3123f', dark: '#f07aa0' } },
  { id: 'disease_reporter', label: 'Disease reporters', edge: 'D \u2192 P',
    criterion: 'Tier 1',
    gloss: 'disease liability moves the protein',
    hue: { light: '#6a3d9a', dark: '#b894e8' } },
  { id: 'exposome_reporter', label: 'Exposome reporters', edge: 'E \u2192 P',
    criterion: 'Tier 1',
    gloss: 'the exposure moves the protein',
    hue: { light: '#c2570f', dark: '#f0994f' } },
];

const sx = (v) => PAD + Math.sqrt(Math.min(v, X_MAX) / X_MAX) * (W - PAD - 14);
const sy = (v) => H - PAD - Math.sqrt(Math.min(v, Y_MAX) / Y_MAX) * (H - PAD - 18);
const pct = (v) => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`;

/** One legend entry: the mark as it is actually drawn, then its meaning. */
function Key({ color, r = 2, filled, dim, ring, children }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, color }}>
      <Box component="svg" width={14} height={14} sx={{ flex: '0 0 14px' }}>
        {ring ? (
          <>
            <circle cx={7} cy={7} r={4.6} fill="none" stroke="currentColor" strokeWidth={1.4} />
            <circle cx={7} cy={7} r={1.8} fill="currentColor" />
          </>
        ) : (
          <circle cx={7} cy={7} r={r + 1.2} fill={color} opacity={dim ? 0.3 : 0.85} />
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.35 }}>
        {children}
      </Typography>
    </Box>
  );
}

export default function ExposomeScatter() {
  const theme = useTheme();
  const h = theme.palette.heap;
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const litRef = useRef([]);     // the highlighted set, for the hit test
  const [hover, setHover] = useState(null);
  const [causal, setCausal] = useState(null);
  const [layer, setLayer] = useState('causal');
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
  //
  // TWO PASSES, HIGHLIGHTED SET FIRST. RGMA sits on top of ICAM1 (3.6%/2.5%
  // against 3.53%/2.49%) and won a plain nearest-point search by a fraction of
  // a pixel, which made a protein the figure had NAMED impossible to click. A
  // lit point inside the hit radius therefore wins over a closer unlit one.
  const pick = useCallback((evt) => {
    const svg = svgRef.current;
    if (!svg || !pts) return;
    const r = svg.getBoundingClientRect();
    const k = W / r.width;
    const mx = (evt.clientX - r.left) * k;
    const my = (evt.clientY - r.top) * k;
    const nearest = (arr) => {
      let best = null;
      let bestD = HIT * HIT;
      for (let i = 0; i < arr.length; i += 1) {
        const d = (arr[i].x - mx) ** 2 + (arr[i].y - my) ** 2;
        if (d < bestD) { bestD = d; best = arr[i]; }
      }
      return best;
    };
    setHover(nearest(litRef.current) || nearest(pts));
  }, [pts]);

  // A protein with Tier-1 MR evidence is interesting BECAUSE of that evidence,
  // so it opens the triad explorer rather than its exposure associations.
  const open = useCallback(() => {
    if (!hover) return;
    const p = encodeURIComponent(hover.p);
    const isCausal = (causal?.proteins || []).some((r) => r.protein === hover.p);
    navigate(isCausal ? `/results/causal/triads?p=${p}` : `/results/associations?protein=${p}`);
  }, [hover, navigate, causal]);

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
    const GAP = 12.5;           // px between baselines; the glyph box is ~11
    const CHAR = 5.9;           // px per character at the sizes used below
    const OFF = 9;              // px: label sits this far right of its point
    // Estimate each label's box and test for a real intersection. A fixed
    // proximity threshold is a bad proxy for width -- "ADM" and "ALCAM" need
    // very different clearances -- and bucketing by x missed any pair that
    // straddled a bucket edge, which is how ALCAM and PCSK9 printed as
    // "ALCAM CSK9" and ADM ran into FURIN.
    const out = [];
    [...entries].sort((a, c) => a.y0 - c.y0).forEach((e) => {
      const w = e.text.length * CHAR + 6;
      let y = e.y0;
      for (let guard = 0; guard < 60; guard += 1) {
        let moved = false;
        for (let i = 0; i < out.length; i += 1) {
          const o = out[i];
          const ow = o.text.length * CHAR + 6;
          const xHit = e.x0 + OFF < o.x0 + OFF + ow && o.x0 + OFF < e.x0 + OFF + w;
          if (xHit && Math.abs(o.y - y) < GAP) {
            y = o.y + GAP;
            moved = true;
          }
        }
        if (!moved) break;
      }
      out.push({ ...e, y, moved: Math.abs(y - e.y0) > 1.5 });
    });
    return out;
  };

  const active = LAYERS.find((l) => l.id === layer) || LAYERS[0];
  const hue = active.hue[h.mode === 'dark' ? 'dark' : 'light'];
  const counts = {
    causal: causal?.proteins?.length,
    disease_reporter: causal?.disease_reporters?.length,
    exposome_reporter: causal?.exposome_reporters?.length,
  };
  const named = layer === 'causal';
  const litNames = new Set(
    named
      ? (causal?.proteins || []).map((r) => r.protein)
      : (causal?.[layer === 'disease_reporter' ? 'disease_reporters' : 'exposome_reporters'] || []),
  );
  const hasLayer = litNames.size > 0;
  const lit = hasLayer ? pts.filter((d) => litNames.has(d.p)) : [];
  const rest = hasLayer ? pts.filter((d) => !litNames.has(d.p)) : pts;
  litRef.current = lit;
  const labels = LABEL.map((name) => pts.find((d) => d.p === name)).filter(Boolean);
  const hoverCausal = hover
    ? (causal?.proteins || []).find((r) => r.protein === hover.p)
    : null;
  const marked = named
    ? (causal?.proteins || [])
      .map((r) => ({ ...r, pt: pts.find((d) => d.p === r.protein) }))
      .filter((r) => r.pt)
    : [];
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

        {/* Three states, one hue. Gray is below the 1% line; pale teal is
            exposure-responsive, so the headline claim stays visible on every
            layer; full teal is the layer on screen. The first version let the
            layer own the teal, which wiped the responsive cloud off the default
            view and left six rings on a gray field. */}
        {rest.map((d) => (
          <circle
            key={d.p} cx={d.x} cy={d.y}
            r={d.resp ? 1.8 : 1.5}
            fill={d.resp ? h.accent : h.soft}
            opacity={d.resp ? 0.34 : 0.24}
          />
        ))}
        {lit.map((d) => (
          <circle
            key={d.p} cx={d.x} cy={d.y}
            r={named ? 2 : 2.3} fill={hue} opacity={0.95}
          />
        ))}

        {/* The minority with causal evidence: a ring, so they read against the
            cloud without a second hue competing with the teal. */}
        {marked.map((r) => (
          <g key={r.protein}>
            <circle cx={r.pt.x} cy={r.pt.y} r={5.2} fill="none" stroke={h.paper} strokeWidth={2.4} />
            <circle cx={r.pt.x} cy={r.pt.y} r={5.2} fill="none" stroke={hue} strokeWidth={1.6} />
            <circle cx={r.pt.x} cy={r.pt.y} r={2} fill={hue} />
          </g>
        ))}

        {placed.map((l) => (
          <g key={l.key}>
            {l.moved && (
              <line
                x1={l.x0 + 4} y1={l.y0} x2={l.x0 + 7.5} y2={l.y - 2.5}
                stroke={l.bold ? hue : h.soft} strokeWidth={0.8} opacity={0.6}
              />
            )}
            <text
              x={l.x0 + 9} y={l.y + 3}
              fontSize={l.bold ? 9.5 : 9}
              fontWeight={l.bold ? 700 : 400}
              fill={l.bold ? hue : h.soft}
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
              {hoverCausal ? `  ·  PP.H4 ${hoverCausal.pp_h4}${hoverCausal.tier1_cis ? ', Tier 1' : ''}` : ''}
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

      <Box component="figcaption" sx={{ mt: 1 }}>
        <ToggleButtonGroup
          exclusive size="small" value={layer}
          onChange={(_, v) => v && setLayer(v)}
          aria-label="evidence layer"
          sx={{ flexWrap: 'wrap', mb: 1 }}
        >
          {LAYERS.map((l) => (
            <ToggleButton
              key={l.id} value={l.id}
              sx={{
                textTransform: 'none', fontSize: '0.74rem', px: 1.1, py: 0.5,
                // The pressed button wears the layer's color, so the marks on
                // the plot are tied to the control that produced them.
                '&.Mui-selected': {
                  backgroundColor: l.hue[h.mode === 'dark' ? 'dark' : 'light'],
                  color: h.paper,
                  '&:hover': {
                    backgroundColor: l.hue[h.mode === 'dark' ? 'dark' : 'light'],
                    opacity: 0.9,
                  },
                },
              }}
            >
              {l.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* The legend carries what the caption used to say, but keyed to the
            marks actually on screen, and it changes with the layer. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'baseline' }}>
          <Key color={hue} r={2.3} filled>
            <b>{counts[layer] != null ? counts[layer].toLocaleString() : '—'}</b>{' '}
            {active.label.toLowerCase()} ({active.edge}, {active.criterion}) — {active.gloss}
          </Key>
          <Key color={h.accent} r={1.8} filled dim>
            exposure-responsive, no evidence this way
          </Key>
          <Key color={h.soft} r={1.5} filled dim>
            below 1% exposomic variance
          </Key>
          {named && (
            <Key ring color={hue}>
              named above — click opens its triads
            </Key>
          )}
        </Box>
      </Box>
    </figure>
  );
}
