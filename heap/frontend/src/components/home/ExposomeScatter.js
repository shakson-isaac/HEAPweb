import React, { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { useSection } from '../../lib/useSection';

// ---------------------------------------------------------------------------
// The landing figure: every plasma protein placed by what genetics explains
// against what the exposome explains. Main-manuscript Figure 1b, reduced to the
// one thing a visitor should take from the front door.
//
// HAND-DRAWN SVG RATHER THAN PLOTLY, ON PURPOSE. This is the first paint of the
// site; pulling the charting bundle in to draw 2,686 circles would delay it for
// a figure that needs no interaction. Plotly still arrives in the background
// (prefetchCharts) for the results pages.
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

const sx = (v) => PAD + Math.sqrt(Math.min(v, X_MAX) / X_MAX) * (W - PAD - 14);
const sy = (v) => H - PAD - Math.sqrt(Math.min(v, Y_MAX) / Y_MAX) * (H - PAD - 18);

export default function ExposomeScatter() {
  const theme = useTheme();
  const h = theme.palette.heap;
  const { data, loading, error } = useSection('geno_vs_expo_arch');

  const pts = useMemo(() => {
    if (!data || !data.omic) return null;
    const out = [];
    for (let i = 0; i < data.omic.length; i += 1) {
      const g = data.Genetic_plot ? data.Genetic_plot[i] : null;
      const e = data.Exposome_plot ? data.Exposome_plot[i] : null;
      if (g === null || e === null || g === undefined || e === undefined) continue;
      out.push({ p: data.omic[i], g, e, resp: e >= THR });
    }
    return out;
  }, [data]);

  if (loading || error || !pts || !pts.length) {
    // No skeleton and no error card: the page reads perfectly without the figure,
    // and a broken-looking box on the front door is worse than none.
    return <Box sx={{ minHeight: { xs: 0, md: 220 } }} />;
  }

  const responsive = pts.filter((d) => d.resp);
  const labels = LABEL
    .map((name) => pts.find((d) => d.p === name))
    .filter(Boolean);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label={`Each of ${pts.length.toLocaleString()} plasma proteins placed by its genetic and exposomic variance`}>
        <line x1={PAD} y1={H - PAD} x2={W - 12} y2={H - PAD} stroke={h.soft} strokeWidth="1" />
        <line x1={PAD} y1={16} x2={PAD} y2={H - PAD} stroke={h.soft} strokeWidth="1" />
        <line
          x1={PAD} y1={sy(THR)} x2={W - 12} y2={sy(THR)}
          stroke={h.accent} strokeWidth="1" strokeDasharray="4 3" opacity="0.85"
        />
        {pts.filter((d) => !d.resp).map((d) => (
          <circle key={d.p} cx={sx(d.g)} cy={sy(d.e)} r="1.5" fill={h.soft} fillOpacity="0.35" />
        ))}
        {responsive.map((d) => (
          <circle key={d.p} cx={sx(d.g)} cy={sy(d.e)} r="2.4" fill={h.accent} fillOpacity="0.9" />
        ))}
        {labels.map((d) => (
          <text key={d.p} x={sx(d.g) + 7} y={sy(d.e) + 3.5} fontSize="11" fontWeight="600" fill={h.ink}>
            {d.p}
          </text>
        ))}
        <text x={(W + PAD) / 2} y={H - 10} fontSize="11" fill={h.soft} textAnchor="middle">
          genetic R²
        </text>
        <text
          x="14" y={H / 2} fontSize="11" fill={h.soft} textAnchor="middle"
          transform={`rotate(-90 14 ${H / 2})`}
        >
          exposomic R²
        </text>
      </svg>
      {/* NO COUNT OF GREEN DOTS HERE. Counting every protein above the line gives
          721 on this payload, while the paper's exposure-responsive count is 608 --
          the published number is taken over the 2,051 proteins GREML also
          estimated, not over all 2,686. Printing the larger number on the front
          door would contradict Figure 1b. The Main results page states the
          published counts, in their own scope. */}
      <Typography component="figcaption" variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {`Each dot is one of ${pts.length.toLocaleString()} plasma proteins. `}
        Green clears 1% exposomic variance.
      </Typography>
    </figure>
  );
}
