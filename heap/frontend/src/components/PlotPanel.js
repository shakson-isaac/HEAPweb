import React from 'react';
import Plot from 'react-plotly.js';

// One Plotly wrapper so every chart on the site shares a layout, font and
// mode bar. White background and no gridlines, matching the manuscript figures.
const BASE_LAYOUT = {
  paper_bgcolor: 'white',
  plot_bgcolor: 'white',
  font: { family: 'Inter, Arial, sans-serif', size: 12, color: '#222' },
  margin: { l: 70, r: 20, t: 30, b: 60 },
  hovermode: 'closest',
  xaxis: { showgrid: false, zeroline: false, ticks: 'outside', linecolor: '#333' },
  yaxis: { showgrid: false, zeroline: false, ticks: 'outside', linecolor: '#333' },
  legend: { bgcolor: 'rgba(0,0,0,0)' },
};

// Plotly mutates the layout object it is given -- it writes resolved values
// such as `xaxis.type` and `xaxis.range` straight back into it. A shallow copy
// of BASE_LAYOUT would hand every chart the *same* nested xaxis/yaxis objects,
// so the first categorical bar chart would stamp `type: 'category'` onto the
// shared constant and every later numeric chart would inherit it. Deep-copy the
// base so no chart can reach another chart's layout.
function merge(base, over) {
  const out = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v)
      && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])
      ? { ...out[k], ...v }
      : v;
  }
  return out;
}

// plotly.js 3.x dropped the `title: 'text'` shorthand -- a title given as a
// bare string is silently ignored, so axis and colorbar labels just vanish.
// Rewrite every string title to {text} rather than relying on 17 call sites
// getting it right.
function withTitleObjects(value) {
  if (Array.isArray(value)) {
    // Data arrays hold primitives and can be tens of thousands long; there is
    // no title inside them, so return them as-is instead of rebuilding them.
    if (!value.length || typeof value[0] !== 'object' || value[0] === null) return value;
    return value.map(withTitleObjects);
  }
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = k === 'title' && typeof v === 'string' ? { text: v } : withTitleObjects(v);
  }
  return out;
}

export default function PlotPanel({ data, layout, height = 420, config, onPointClick }) {
  return (
    <Plot
      data={withTitleObjects(data)}
      layout={withTitleObjects(merge(BASE_LAYOUT, { height, ...layout }))}
      config={{ displaylogo: false, responsive: true, ...config }}
      style={{ width: '100%' }}
      useResizeHandler
      onClick={onPointClick ? (ev) => {
        const p = ev?.points?.[0];
        if (p) onPointClick(p);
      } : undefined}
    />
  );
}
