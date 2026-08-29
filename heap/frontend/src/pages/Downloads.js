import { Link as RouterLink } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip,
  IconButton, Link, Pagination, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SectionCard from '../components/SectionCard';
import { WEB_DATA_BASE } from '../lib/heapdata';

// Downloads = the published data catalog, read from two catalog files that the
// build pipeline writes. Nothing on this page is typed by hand (S8): every
// count, size, row count and column name below comes from
//
//   catalog.json.gz       the 37 active supplementary Table/Data entries of the
//                         manuscript registry (HEAP_manuscript/config/supp_tables.tsv)
//   supp_catalog.json.gz  the exploded supplementary archive: every published
//                         file, its byte size on disk, its transfer size, and
//                         its column schema where it has one
//
// Both are public objects on the same bucket as the payload, so the catalog and
// the files it describes can never drift apart.

// The payload lives at <bucket>/web/v1; the supplementary archive is a sibling
// prefix on the same bucket, named by the archive catalog itself.
//
// The archive is ~866MB and is never built locally, so download links always
// point at the PUBLISHED bucket even when the payload is being read from a
// local preview server. Deriving the root by stripping /web/vN off the payload
// base only works when the payload base actually has that suffix; a preview
// base like http://localhost:3008 has nothing to strip, and every download link
// then silently pointed at a local server that cannot have the files -- a 404
// on every row.
const PUBLIC_BUCKET = 'https://storage.googleapis.com/heap-data';
const BUCKET_ROOT = (
  process.env.REACT_APP_SUPP_DATA_URL
  || (/\/web\/v\d+\/?$/.test(WEB_DATA_BASE)
    ? WEB_DATA_BASE.replace(/\/web\/v\d+\/?$/, '')
    : PUBLIC_BUCKET)
);
const ZIP_NAME = 'HEAP_Supplementary_Data.zip';
const XLSX_NAME = 'HEAP_Supplementary_Tables.xlsx';

const CATALOG_URL = `${WEB_DATA_BASE}/catalog.json.gz`;
const SUPP_CATALOG_URL = `${WEB_DATA_BASE}/supp_catalog.json.gz`;

const fmtInt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString());

function fmtBytes(b) {
  if (b === null || b === undefined || Number.isNaN(Number(b))) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Number(b);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${i === 0 || v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const lc = (s) => String(s === null || s === undefined ? '' : s).toLowerCase();

/** Fetch + parse one JSON object; `url` may be falsy to stay idle. */
function useJSON(url) {
  const [state, setState] = useState({ data: null, loading: Boolean(url), error: null });
  useEffect(() => {
    if (!url) { setState({ data: null, loading: false, error: null }); return undefined; }
    let alive = true;
    setState({ data: null, loading: true, error: null });
    fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText} fetching ${url}`);
        return r.json();
      })
      .then((d) => { if (alive) setState({ data: d, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ data: null, loading: false, error: e }); });
    return () => { alive = false; };
  }, [url]);
  return state;
}

/**
 * Size of an object we have no catalog row for (the two whole-archive bundles),
 * taken from the server's own Content-Length rather than typed in.
 * undefined = still asking, null = the server did not report one.
 */
function useHeadSize(url) {
  const [size, setSize] = useState(undefined);
  useEffect(() => {
    // Idle until the archive catalog names the prefix: fetching a null URL
    // would resolve against the site itself and report the size of index.html.
    if (!url) return undefined;
    let alive = true;
    setSize(undefined);
    fetch(url, { method: 'HEAD' })
      .then((r) => (r.ok ? r.headers.get('content-length') : null))
      .then((v) => { if (alive) setSize(v === null || v === undefined ? null : Number(v)); })
      .catch(() => { if (alive) setSize(null); });
    return () => { alive = false; };
  }, [url]);
  return size;
}

function CopyUrl({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const flash = () => { setCopied(true); setTimeout(() => setCopied(false), 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(flash, flash);
    } else flash();
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Box
        component="code"
        sx={{
          fontSize: 11.5, fontFamily: 'monospace', color: 'text.secondary',
          overflowWrap: 'anywhere', userSelect: 'all',
        }}
      >
        {url}
      </Box>
      <IconButton size="small" onClick={copy} aria-label={`copy URL ${url}`}>
        {copied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
      </IconButton>
    </Box>
  );
}

function Schema({ columns, note }) {
  if (!columns || !columns.length) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        No column schema is published for this file in the catalog — it is not a table.
      </Typography>
    );
  }
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {columns.length} columns{note ? ` · ${note}` : ''}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {columns.map((c) => (
          <Chip key={c} size="small" variant="outlined" label={c} sx={{ fontFamily: 'monospace' }} />
        ))}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------- archive ---

function FileRow({ entry, folder, suppBase, dataset, fallback }) {
  const [open, setOpen] = useState(false);
  const url = `${suppBase}/${entry.path}.gz`;
  const name = folder === '(root)' || !entry.path.startsWith(`${folder}/`)
    ? entry.path
    : entry.path.slice(folder.length + 1);
  // The archive catalog records columns per file; where it does not (the
  // per-exposure weight files), a sibling registry entry publishes the schema of
  // an example file, which the caller passes down rather than the row inventing one.
  const fb = (!entry.columns || !entry.columns.length) && fallback && fallback.match(entry) ? fallback : null;
  const cols = (entry.columns && entry.columns.length) ? entry.columns : (fb ? fb.columns : []);
  return (
    <React.Fragment>
      <TableRow hover>
        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
          {name}
        </TableCell>
        <TableCell align="right">{dataset && dataset.n_rows ? fmtInt(dataset.n_rows) : '—'}</TableCell>
        <TableCell align="right">{cols.length ? cols.length : '—'}</TableCell>
        <TableCell align="right">{fmtBytes(entry.gz_bytes)}</TableCell>
        <TableCell align="right">{fmtBytes(entry.bytes)}</TableCell>
        <TableCell>
          <Link href={url} download>Download</Link>
        </TableCell>
        <TableCell align="right">
          <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Schema + URL'}
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={7} sx={{ bgcolor: '#fafafa' }}>
            <Box sx={{ mb: 1 }}><CopyUrl url={url} /></Box>
            {dataset && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Registry entry <b>{dataset.key}</b> — {dataset.title}
              </Typography>
            )}
            <Schema columns={cols} note={fb ? fb.note : null} />
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}

function FileTable({ files, folder, suppBase, byPath, fallback }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>file</TableCell>
            <TableCell align="right">rows</TableCell>
            <TableCell align="right">cols</TableCell>
            <TableCell align="right">download</TableCell>
            <TableCell align="right">uncompressed</TableCell>
            <TableCell>get</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {files.map((e) => (
            <FileRow
              key={e.path}
              entry={e}
              folder={folder}
              suppBase={suppBase}
              dataset={byPath.get(e.path)}
              fallback={fallback}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const PER_PAGE = 20;

/**
 * pes_weights ships one small folder per exposure, so the flat list is hundreds
 * of rows that all say the same thing. Group by exposure, page the groups, and
 * let the search box find an exposure by name.
 */
function WeightsBrowser({ files, suppBase, registry, query }) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [query]);

  const { top, groups, medianWeights, nWeightFiles } = useMemo(() => {
    const t = [];
    const g = new Map();
    files.forEach((e) => {
      const parts = e.path.split('/');
      if (parts.length < 3) { t.push(e); return; }
      const key = parts[1];
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(e);
    });
    const w = files.filter((e) => e.path.endsWith('_weights.txt')).map((e) => e.bytes).sort((a, b) => a - b);
    return {
      top: t,
      groups: [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      medianWeights: w.length ? w[Math.floor(w.length / 2)] : null,
      nWeightFiles: w.length,
    };
  }, [files]);

  const shown = useMemo(() => {
    if (!query) return groups;
    return groups.filter(([name, entries]) => (
      name.toLowerCase().includes(query)
      || entries.some((e) => e.path.toLowerCase().includes(query)
        || (e.columns || []).some((c) => c.toLowerCase().includes(query)))
    ));
  }, [groups, query]);

  // Schema of a weights file, taken from the registry entry's example_file.
  const fallback = registry && registry.columns && registry.columns.length
    ? {
      match: (e) => e.path.endsWith('_weights.txt'),
      columns: registry.columns,
      note: `schema of the catalog example ${registry.example_file}`,
    }
    : null;

  const nPages = Math.ceil(shown.length / PER_PAGE) || 1;
  const pageGroups = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Chip size="small" label={`${groups.length} exposures`} />
        <Chip size="small" variant="outlined" label={`${nWeightFiles} weight files, median ${fmtBytes(medianWeights)}`} />
        <Chip size="small" variant="outlined" label={`${top.length} folder-level files`} />
        {query && <Chip size="small" color="primary" label={`${shown.length} exposures match`} />}
      </Box>

      {registry && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            Every exposure folder holds a <code>*_weights.txt</code> and a{' '}
            <code>*_metadata.txt</code>. Column schema of the weights file, from catalog
            example <code>{registry.example_file}</code>:
          </Typography>
          <Schema columns={registry.columns} />
        </Box>
      )}

      {top.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Folder-level files</Typography>
          <FileTable files={top} folder="pes_weights" suppBase={suppBase} byPath={new Map()} fallback={fallback} />
        </Box>
      )}

      {shown.length === 0 ? (
        <Alert severity="info">
          No exposure folder in <b>pes_weights</b> matches “{query}”. All {groups.length} exposure
          folders published by the pipeline are listed here, so this is a search miss, not missing data.
        </Alert>
      ) : (
        <>
          {pageGroups.map(([name, entries]) => (
            <Box key={name} sx={{ mb: 1.5 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all' }}>
                {name}
              </Typography>
              <FileTable
                files={entries}
                folder={`pes_weights/${name}`}
                suppBase={suppBase}
                byPath={new Map()}
                fallback={fallback}
              />
            </Box>
          ))}
          {nPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Pagination
                size="small" count={nPages} page={page}
                onChange={(e, p) => setPage(p)}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function FolderCard({ folder, suppBase, byPath, registry, query, expandedOverride, onToggle }) {
  const shown = useMemo(() => folder.files.filter((e) => (
    !query
    || e.path.toLowerCase().includes(query)
    || (e.columns || []).some((c) => c.toLowerCase().includes(query))
  )), [folder.files, query]);

  const nSchema = folder.files.filter((e) => (e.columns || []).length).length;
  const isWeights = folder.name === 'pes_weights';
  const expanded = expandedOverride !== undefined
    ? expandedOverride
    : Boolean(query) && shown.length > 0;

  return (
    <Accordion
      expanded={expanded}
      onChange={() => onToggle(!expanded)}
      disableGutters
      sx={{ mb: 0.5 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{folder.name}</Typography>
          <Chip size="small" label={`${folder.files.length} file${folder.files.length === 1 ? '' : 's'}`} />
          <Chip size="small" variant="outlined" label={`${fmtBytes(folder.gz)} download`} />
          <Chip size="small" variant="outlined" label={`${fmtBytes(folder.raw)} uncompressed`} />
          {query && (
            <Chip
              size="small"
              color={shown.length ? 'primary' : 'default'}
              label={`${shown.length} match`}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {registry.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            {registry.map((d) => (
              <Typography key={d.key} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                <b>{d.tier_label} · {d.key}</b> ({d.zip_path}) — {d.title}
                {d.n_rows ? ` · ${fmtInt(d.n_rows)} rows total` : ''}
              </Typography>
            ))}
          </Box>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Per-file column schemas in the archive catalog: {nSchema} of {folder.files.length}
          {isWeights
            ? '. The weight files take their schema from the registry entry, which publishes the columns of an example file.'
            : '.'}
        </Typography>

        {isWeights ? (
          <WeightsBrowser
            files={shown}
            suppBase={suppBase}
            registry={registry.find((d) => d.key === 'pes_weights')}
            query={query}
          />
        ) : shown.length === 0 ? (
          <Alert severity="info">
            None of the {folder.files.length} files in this folder has a name or column
            matching “{query}”. Every file the pipeline published to this folder is
            catalogued, so this is a search miss, not missing data.
          </Alert>
        ) : (
          <FileTable files={shown} folder={folder.name} suppBase={suppBase} byPath={byPath} />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

// --------------------------------------------------------------- registry ---

function RegistryEntry({ dataset, suppBase, archiveFiles, xlsxUrl }) {
  const [open, setOpen] = useState(false);
  const d = dataset;
  const single = archiveFiles.length === 1 ? archiveFiles[0] : null;
  const url = d.delivery === 'workbook'
    ? xlsxUrl
    : (single ? `${suppBase}/${single.path}.gz` : null);
  return (
    <Box sx={{ py: 1, borderBottom: '1px solid #eee' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
        <Chip
          size="small"
          color={d.tier === 1 ? 'primary' : 'default'}
          label={d.tier_label}
        />
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.key}</Typography>
        {d.sheet && <Chip size="small" variant="outlined" label={`sheet ${d.sheet}`} />}
        {d.zip_path && <Chip size="small" variant="outlined" label={`archive ${d.zip_path}`} />}
      </Box>
      <Typography variant="body2" sx={{ mb: 0.5 }}>{d.title}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {d.n_rows ? `${fmtInt(d.n_rows)} rows × ` : ''}
        {d.n_cols ? `${d.n_cols} columns · ` : ''}
        {d.n_files ? `${fmtInt(d.n_files)} files${d.n_subdirs ? ` in ${fmtInt(d.n_subdirs)} folders` : ''} · ` : ''}
        {fmtBytes(d.size_bytes)} on disk · updated {d.updated}
        {d.split_col ? ` · split by ${d.split_col}` : ''}
        {archiveFiles.length ? ` · ${archiveFiles.length} published file${archiveFiles.length > 1 ? 's' : ''}` : ''}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
        {url && <Link href={url} download>Download</Link>}
        {d.delivery === 'workbook' && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            delivered as a sheet in {XLSX_NAME}
          </Typography>
        )}
        {d.delivery === 'data' && !single && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {archiveFiles.length} files under <code>{d.zip_path}/</code> — listed in the archive above
          </Typography>
        )}
        <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Schema + URL'}
        </Button>
      </Box>
      {open && (
        <Box sx={{ mt: 1, p: 1, bgcolor: '#fafafa' }}>
          {url && <Box sx={{ mb: 1 }}><CopyUrl url={url} /></Box>}
          {!single && d.delivery === 'data' && archiveFiles.length > 1 && (
            <Box sx={{ mb: 1 }}>
              {archiveFiles.slice(0, 8).map((f) => (
                <CopyUrl key={f.path} url={`${suppBase}/${f.path}.gz`} />
              ))}
              {archiveFiles.length > 8 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  … and {archiveFiles.length - 8} more under <code>{d.zip_path}/</code>
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            source: <code>{d.source}</code>
          </Typography>
          <Schema
            columns={d.columns}
            note={d.example_file ? `schema of ${d.example_file}` : null}
          />
        </Box>
      )}
    </Box>
  );
}


// ----------------------------------------------------------------- page -----

export default function Downloads() {
  const [q, setQ] = useState('');
  const [overrides, setOverrides] = useState({});
  const query = q.trim().toLowerCase();
  useEffect(() => { setOverrides({}); }, [query]);

  const cat = useJSON(CATALOG_URL);
  const supp = useJSON(SUPP_CATALOG_URL);

  const suppBase = supp.data ? `${BUCKET_ROOT}/${supp.data.prefix}` : null;
  const zipUrl = suppBase ? `${suppBase}/${ZIP_NAME}` : null;
  const xlsxUrl = suppBase ? `${suppBase}/${XLSX_NAME}` : null;
  const zipSize = useHeadSize(zipUrl);
  const xlsxSize = useHeadSize(xlsxUrl);

  const folders = useMemo(() => {
    if (!supp.data) return [];
    return Object.entries(supp.data.folders)
      .map(([name, files]) => ({
        name,
        files,
        raw: files.reduce((s, e) => s + (e.bytes || 0), 0),
        gz: files.reduce((s, e) => s + (e.gz_bytes || 0), 0),
      }))
      .sort((a, b) => {
        if (a.name === '(root)') return 1;
        if (b.name === '(root)') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [supp.data]);

  const totals = useMemo(() => folders.reduce(
    (acc, f) => ({
      files: acc.files + f.files.length, raw: acc.raw + f.raw, gz: acc.gz + f.gz,
    }),
    { files: 0, raw: 0, gz: 0 },
  ), [folders]);

  const datasets = useMemo(() => (cat.data ? cat.data.datasets : []), [cat.data]);

  // Registry rows keyed by the archive path they land on, so a file row can show
  // the published row count where the registry knows one.
  const byPath = useMemo(() => {
    const m = new Map();
    datasets.forEach((d) => {
      if (!d.zip_path) return;
      m.set(`${d.zip_path}/${d.zip_name || d.key}.tsv`, d);
    });
    return m;
  }, [datasets]);

  const registryByFolder = useMemo(() => {
    const m = new Map();
    datasets.forEach((d) => {
      if (!d.zip_path) return;
      const top = d.zip_path.split('/')[0];
      if (!m.has(top)) m.set(top, []);
      m.get(top).push(d);
    });
    return m;
  }, [datasets]);

  const filesByDataset = useMemo(() => {
    const all = folders.flatMap((f) => f.files);
    const m = new Map();
    datasets.forEach((d) => {
      m.set(d.key, d.zip_path ? all.filter((e) => e.path.startsWith(`${d.zip_path}/`)) : []);
    });
    return m;
  }, [folders, datasets]);

  const nFileMatch = useMemo(() => {
    if (!query) return totals.files;
    return folders.reduce((n, f) => n + f.files.filter((e) => (
      e.path.toLowerCase().includes(query)
      || (e.columns || []).some((c) => c.toLowerCase().includes(query))
    )).length, 0);
  }, [folders, query, totals.files]);

  const dsMatch = useMemo(() => datasets.filter((d) => (
    !query
    || lc(d.key).includes(query) || lc(d.title).includes(query)
    || lc(d.sheet).includes(query) || lc(d.group).includes(query)
    || lc(d.zip_path).includes(query)
    || (d.columns || []).some((c) => c.toLowerCase().includes(query))
  )), [datasets, query]);

  const groups = useMemo(() => {
    if (!cat.data) return [];
    return cat.data.groups.map((g) => ({
      group: g.group,
      entries: g.keys.map((k) => datasets.find((d) => d.key === k)).filter(Boolean),
    }));
  }, [cat.data, datasets]);

  const nWorkbook = datasets.filter((d) => d.delivery === 'workbook').length;
  const nData = datasets.filter((d) => d.delivery === 'data').length;
  const built = datasets.length
    ? datasets.map((d) => d.updated).filter(Boolean).sort().slice(-1)[0]
    : null;

  return (
    <div className="flex p-6">
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold">Downloads</h2>

        <SectionCard loading={cat.loading || supp.loading} error={cat.error || supp.error}>
          {cat.data && supp.data && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, maxWidth: 900 }}>
                Catalog <b>{cat.data.version}</b> · archive prefix <code>{supp.data.prefix}</code> ·
                {' '}{cat.data.n_available} of {cat.data.n_datasets} registry entries available
                ({nWorkbook} workbook sheets, {nData} data deposits) ·
                {' '}{fmtInt(totals.files)} published files in {folders.length} folders,
                {' '}{fmtBytes(totals.gz)} to transfer, {fmtBytes(totals.raw)} on disk ·
                {' '}built {built}. Every number on this page is read from{' '}
                <code>catalog.json.gz</code> and <code>supp_catalog.json.gz</code>; cite the paper,
                not the files.
              </Typography>

              {/* ---------------------------------------------- everything --- */}
              <SectionCard title="Everything, in one file">
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Paper variant="outlined" sx={{ p: 2, flex: '1 1 380px', minWidth: 320 }}>
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>{ZIP_NAME}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      {fmtInt(totals.files)} files · {folders.length} folders ·{' '}
                      {zipSize === undefined ? 'size…' : zipSize === null ? 'size not reported by the server' : fmtBytes(zipSize)}
                      {' '}· {fmtBytes(totals.raw)} once unpacked
                    </Typography>
                    <Link href={zipUrl} download>Download the archive</Link>
                    <Box sx={{ mt: 1 }}><CopyUrl url={zipUrl} /></Box>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2, flex: '1 1 380px', minWidth: 320 }}>
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>{XLSX_NAME}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      {nWorkbook} sheets — the Supplementary Tables of the manuscript ·{' '}
                      {xlsxSize === undefined ? 'size…' : xlsxSize === null ? 'size not reported by the server' : fmtBytes(xlsxSize)}
                    </Typography>
                    <Link href={xlsxUrl} download>Download the workbook</Link>
                    <Box sx={{ mt: 1 }}><CopyUrl url={xlsxUrl} /></Box>
                  </Paper>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    The two catalogs behind this page are public objects as well:
                  </Typography>
                  <CopyUrl url={CATALOG_URL} />
                  <CopyUrl url={SUPP_CATALOG_URL} />
                </Box>
                <Alert severity="info" sx={{ mt: 2 }}>
                  Objects are stored gzipped and served with <code>Content-Encoding: gzip</code>.
                  A browser download, or <code>curl -o name.tsv &lt;url&gt;</code>, writes the plain
                  TSV; <code>curl --compressed</code> keeps the transfer compressed. Both sizes are
                  shown below: <b>download</b> is what crosses the wire, <b>uncompressed</b> is what
                  lands on disk.
                </Alert>
              </SectionCard>

              {/* -------------------------------------------------- search --- */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  size="small" fullWidth
                  placeholder="Search file names and column names — e.g. nie_HR, mediation, smoking, cindex"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  sx={{ maxWidth: 700 }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    color={query ? 'primary' : 'default'}
                    label={`${fmtInt(nFileMatch)} of ${fmtInt(totals.files)} files`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${dsMatch.length} of ${datasets.length} registry entries`}
                  />
                </Box>
                {query && nFileMatch === 0 && dsMatch.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Nothing named “{q.trim()}” appears in any of the {fmtInt(totals.files)} published
                    file names or column schemas, or in the {datasets.length} registry entries. All{' '}
                    {cat.data.n_available} registry entries are available and{' '}
                    {cat.data.n_missing} are missing, so this is a search miss rather than an
                    unpublished dataset.
                  </Alert>
                )}
              </Box>

              {/* ------------------------------------------------- archive --- */}
              <SectionCard
                title="Supplementary data archive"
                subtitle={`${fmtInt(totals.files)} files under ${supp.data.prefix}/, grouped as the archive stores them. Expand a folder for per-file sizes, row counts and column schemas.`}
              >
                {folders.map((f) => (
                  <FolderCard
                    key={f.name}
                    folder={f}
                    suppBase={suppBase}
                    byPath={byPath}
                    registry={registryByFolder.get(f.name) || []}
                    query={query}
                    expandedOverride={overrides[f.name]}
                    onToggle={(v) => setOverrides((o) => ({ ...o, [f.name]: v }))}
                  />
                ))}
              </SectionCard>

              {/* ------------------------------------------------ registry --- */}
              <SectionCard
                title="Manuscript registry"
                subtitle={`The ${cat.data.n_datasets} Supplementary Table and Supplementary Data entries of ${cat.data.config.split('/').slice(-2).join('/')}, in registry order. Workbook entries are sheets of the xlsx; data entries are folders of the archive above.`}
              >
                {groups.map((g) => {
                  const entries = g.entries.filter((d) => dsMatch.includes(d));
                  const expanded = overrides[`g:${g.group}`] !== undefined
                    ? overrides[`g:${g.group}`]
                    : Boolean(query) && entries.length > 0;
                  return (
                    <Accordion
                      key={g.group}
                      disableGutters
                      expanded={expanded}
                      onChange={() => setOverrides((o) => ({ ...o, [`g:${g.group}`]: !expanded }))}
                      sx={{ mb: 0.5 }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{g.group}</Typography>
                          <Chip size="small" label={`${g.entries.length} entr${g.entries.length === 1 ? 'y' : 'ies'}`} />
                          {query && (
                            <Chip
                              size="small"
                              color={entries.length ? 'primary' : 'default'}
                              label={`${entries.length} match`}
                            />
                          )}
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        {entries.length === 0 ? (
                          <Alert severity="info">
                            None of the {g.entries.length} entries in this group matches “{q.trim()}”.
                            All {g.entries.length} are published and available.
                          </Alert>
                        ) : entries.map((d) => (
                          <RegistryEntry
                            key={d.key}
                            dataset={d}
                            suppBase={suppBase}
                            xlsxUrl={xlsxUrl}
                            archiveFiles={filesByDataset.get(d.key) || []}
                          />
                        ))}
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </SectionCard>

            </Box>
          )}

        {/* Downloads was the site's only dead end: everything here is a file to
            take away, so a reader who finished had nowhere to click but Back.
            These are the three places the data is actually interpreted. */}
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            What these tables are behind
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
            <Button component={RouterLink} to="/results/main" variant="outlined"
                    sx={{ textTransform: 'none' }}>
              Variance decomposition
            </Button>
            <Button component={RouterLink} to="/results/causal" variant="outlined"
                    sx={{ textTransform: 'none' }}>
              Causal evidence
            </Button>
            <Button component={RouterLink} to="/documentation/methods" variant="outlined"
                    sx={{ textTransform: 'none' }}>
              How these were computed
            </Button>
          </Box>
        </Box>
        </SectionCard>
      </div>
    </div>
  );
}
