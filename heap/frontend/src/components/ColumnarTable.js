import React, { useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, Paper, TextField, Box,
} from '@mui/material';

// Sort / search / paginate a columnar section entirely in the browser.
//
// The server-side TableComponent exists because MediationResults is a 62 MB
// table that cannot be shipped whole. Payload sections are already small --
// the biggest is 39 KB -- so there is no reason to round-trip to Flask and
// Cloud SQL for a sort. This does the same job with no backend at all.

function fmt(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' && !Number.isInteger(v)) {
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(2);
    return String(Math.round(v * 1e4) / 1e4);
  }
  return String(v);
}

export default function ColumnarTable({ data, columns, initialRowsPerPage = 10, maxHeight = 460 }) {
  const [query, setQuery] = useState('');
  const [orderBy, setOrderBy] = useState(null);
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const cols = useMemo(
    () => columns || (data ? Object.keys(data) : []),
    [columns, data]
  );
  const nRows = data && cols.length ? data[cols[0]].length : 0;

  // Work on indices rather than materialized rows: filtering and sorting a
  // 2,000-row section stays allocation-free until the visible page is sliced.
  const view = useMemo(() => {
    let idx = Array.from({ length: nRows }, (_, i) => i);
    const q = query.trim().toLowerCase();
    if (q) idx = idx.filter((i) => cols.some((c) => String(data[c][i] ?? '').toLowerCase().includes(q)));
    if (orderBy && data[orderBy]) {
      const col = data[orderBy];
      const dir = order === 'asc' ? 1 : -1;
      idx.sort((a, b) => {
        const x = col[a];
        const y = col[b];
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;   // nulls last, both directions
        if (y === null || y === undefined) return -1;
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x).localeCompare(String(y)) * dir;
      });
    }
    return idx;
  }, [data, cols, nRows, query, orderBy, order]);

  if (!data || !cols.length) return null;

  const shown = view.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const sortBy = (c) => {
    if (orderBy === c) setOrder(order === 'asc' ? 'desc' : 'asc');
    else { setOrderBy(c); setOrder('asc'); }
    setPage(0);
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <TextField
        size="small" variant="outlined" placeholder="Filter rows…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(0); }}
        sx={{ mb: 1, width: 280 }}
      />
      <TableContainer component={Paper} sx={{ maxHeight, overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {cols.map((c) => (
                <TableCell key={c} sortDirection={orderBy === c ? order : false}>
                  <TableSortLabel
                    active={orderBy === c}
                    direction={orderBy === c ? order : 'asc'}
                    onClick={() => sortBy(c)}
                  >
                    {c}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((i) => (
              <TableRow key={i} hover>
                {cols.map((c) => <TableCell key={c}>{fmt(data[c][i])}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={view.length}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Box>
  );
}
