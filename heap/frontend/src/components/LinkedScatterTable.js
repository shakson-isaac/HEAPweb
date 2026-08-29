import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Chip, InputAdornment, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PlotPanel from './PlotPanel';

// ---------------------------------------------------------------------------
// A scatter and its table, wired to each other.
//
// Every panel on this site plots a few hundred points and then, somewhere far
// below, prints the same numbers as a table nobody can align with the plot. The
// question a reader actually has -- "which point is that?" and its inverse,
// "where does this row sit?" -- went unanswered in both directions.
//
// Here they are one component. Hovering or clicking a point highlights its row
// and scrolls it into view; hovering a row highlights the point. Selection
// survives filtering, and the search box filters both halves at once, so the
// table is always showing the points that are plotted.
//
// Error bars are drawn whenever a series supplies xlo/xhi or ylo/yhi. Intervals
// are the reason to prefer this over a bare scatter: a point without its
// interval invites reading rank order that the data does not support.
// ---------------------------------------------------------------------------

const HILITE = '#111';

/**
 * @param points  [{ id, x, y, xlo?, xhi?, ylo?, yhi?, label, color?, meta? }]
 * @param columns [{ key, label, align?, format?, from? }] -- `from` reads off
 *                the point, defaulting to point.meta[key]
 */
export default function LinkedScatterTable({
  points,
  columns,
  xTitle,
  yTitle,
  title,
  height = 460,
  searchPlaceholder = 'Filter…',
  legend = null,
  emptyNote = 'Nothing to plot.',
  initialSelected = null,
  rowsVisible = 12,
  extraShapes = [],
  extraAnnotations = [],
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [hovered, setHovered] = useState(null);
  const [query, setQuery] = useState('');
  const rowRefs = useRef({});

  useEffect(() => { setSelected(initialSelected); }, [initialSelected]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return points;
    const terms = q.split(/\s+/).filter(Boolean);
    return points.filter((p) => {
      const hay = `${p.label} ${Object.values(p.meta || {}).join(' ')}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [points, query]);

  const active = hovered || selected;

  // Bring the selected row into view, but only when the plot drove the
  // selection -- scrolling the table because someone moused over its own rows
  // would fight the reader.
  useEffect(() => {
    if (!selected) return;
    const el = rowRefs.current[selected];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const traces = useMemo(() => {
    if (!shown.length) return [];
    const has = (k) => shown.some((p) => p[k] !== undefined && p[k] !== null);
    const err = (lo, hi, val) => (has(lo) && has(hi) ? {
      type: 'data',
      symmetric: false,
      array: shown.map((p) => (p[hi] != null ? p[hi] - p[val] : 0)),
      arrayminus: shown.map((p) => (p[lo] != null ? p[val] - p[lo] : 0)),
      thickness: 1,
      width: 0,
      color: 'rgba(120,120,120,0.40)',
    } : undefined);

    const base = {
      // scatter, not scattergl: the SVG renderer is the one that draws error bars
      type: 'scatter',
      mode: 'markers',
      x: shown.map((p) => p.x),
      y: shown.map((p) => p.y),
      text: shown.map((p) => p.label),
      customdata: shown.map((p) => p.id),
      error_x: err('xlo', 'xhi', 'x'),
      error_y: err('ylo', 'yhi', 'y'),
      hovertemplate: '<b>%{text}</b><br>' + (xTitle || 'x') + ' %{x:.3f}<br>'
        + (yTitle || 'y') + ' %{y:.3f}<extra></extra>',
      marker: {
        // A per-point `size` (in px) is honoured when supplied, so area can
        // carry a third variable; the active point still grows so selection
        // stays visible whatever the encoding. Points with no size fall back to
        // the default rather than collapsing -- a vanishing marker reads as "a
        // very small value" when it usually means "not measured".
        size: shown.map((p) => {
          const base = Number.isFinite(p.size) ? p.size : 8;
          return p.id === active ? base + 5 : base;
        }),
        color: shown.map((p) => p.color || '#5B7FA6'),
        opacity: shown.map((p) => (active && p.id !== active ? 0.35 : 0.9)),
        line: {
          width: shown.map((p) => (p.id === active ? 2 : 0.4)),
          color: shown.map((p) => (p.id === active ? HILITE : 'rgba(0,0,0,0.25)')),
        },
      },
      showlegend: false,
    };
    return [base];
  }, [shown, active, xTitle, yTitle]);

  const onPointClick = useCallback((pt) => {
    const id = pt.customdata;
    setSelected((cur) => (cur === id ? null : id));
  }, []);

  const cellValue = (p, c) => {
    const raw = c.from ? c.from(p) : (p.meta ? p.meta[c.key] : undefined);
    return c.format ? c.format(raw, p) : (raw === undefined || raw === null || raw === '' ? '—' : raw);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
        <TextField
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          sx={{ minWidth: 240, flex: '0 1 320px' }}
          InputProps={{
            startAdornment: <InputAdornment position="start">⌕</InputAdornment>,
          }}
        />
        <Chip size="small" variant="outlined"
              label={`${shown.length.toLocaleString()} of ${points.length.toLocaleString()} shown`} />
        {active && (
          <Chip
            size="small"
            onDelete={() => { setSelected(null); setHovered(null); }}
            label={points.find((p) => p.id === active)?.label || active}
          />
        )}
        {legend}
      </Box>

      {!shown.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>{emptyNote}</Typography>
      ) : (
        <>
          <PlotPanel
            data={traces}
            height={height}
            onPointClick={onPointClick}
            layout={{
              xaxis: { title: xTitle },
              yaxis: { title: yTitle },
              title: title ? { text: title, font: { size: 13 } } : undefined,
              showlegend: false,
              shapes: extraShapes,
              annotations: extraAnnotations,
              hovermode: 'closest',
            }}
          />

          <TableContainer sx={{ maxHeight: rowsVisible * 34 + 40, mt: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map((c) => (
                    <TableCell key={c.key} align={c.align || 'left'}
                               sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map((p) => (
                  <TableRow
                    key={p.id}
                    ref={(el) => { rowRefs.current[p.id] = el; }}
                    hover
                    selected={p.id === active}
                    onMouseEnter={() => setHovered(p.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected((cur) => (cur === p.id ? null : p.id))}
                    sx={{ cursor: 'pointer' }}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} align={c.align || 'left'}
                                 sx={{ whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                        {cellValue(p, c)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Click a point or a row to lock the highlight; the search box filters both.
          </Typography>
        </>
      )}
    </Box>
  );
}
