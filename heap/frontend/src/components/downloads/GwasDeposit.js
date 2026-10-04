import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Chip, IconButton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SectionCard from '../SectionCard';
import { WEB_DATA_BASE } from '../../lib/heapdata';

// ---------------------------------------------------------------------------
// Exposure GWAS summary statistics: 169 files, 51 GB, in a REQUESTER-PAYS
// bucket. The reader names their own Google Cloud project and is billed for the
// transfer; the site owner pays only storage.
//
// WHY THIS PAGE SHOWS COMMANDS AND NOT LINKS. Requester-pays requires an
// authenticated request carrying a billing project, so there is no URL a
// browser can follow and no anonymous listing -- not even of file names. The
// CATALOG is therefore published separately as meta/gwas_manifest.json on the
// public payload (4.4 KB), and this table is rendered from it. Every row knows
// its size before anyone spends anything.
//
// The section hides itself when that catalog is absent, so a payload built
// before the deposit existed shows nothing rather than an empty table.
// ---------------------------------------------------------------------------

const MANIFEST_URL = `${WEB_DATA_BASE}/meta/gwas_manifest.json.gz`;

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip title={done ? 'Copied' : 'Copy command'}>
      <IconButton
        size="small"
        onClick={() => {
          navigator.clipboard?.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }}
      >
        {done ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
      </IconButton>
    </Tooltip>
  );
}

function Command({ children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
      <Box
        component="pre"
        sx={{
          flex: 1, m: 0, p: 1.5, overflowX: 'auto', borderRadius: 1,
          bgcolor: 'action.hover', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5,
        }}
      >
        {children}
      </Box>
      <Copy text={children} />
    </Box>
  );
}

export default function GwasDeposit() {
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setCat(d))
      .catch(() => alive && setCat({ exposures: [] }));
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => cat?.exposures || [], [cat]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => r.exposure_id.toLowerCase().includes(needle)) : rows;
  }, [rows, q]);

  if (!rows.length) return null;

  const bucket = cat.bucket || 'gs://heap-gwas';
  const one = rows[0].exposure_id;

  return (
    <SectionCard
      title="Exposure GWAS summary statistics"
      subtitle="REGENIE step 2 under the base covariate set, one bgzipped file per exposure with a tabix index."
    >
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Chip size="small" color="primary" label={`${cat.n_exposures} exposures`} />
        <Chip size="small" variant="outlined" label={`${cat.total_gb} GB`} />
        <Chip size="small" variant="outlined" label={`${rows[0].n_variants.toLocaleString()} variants each`} />
        <Chip size="small" variant="outlined" label="requester pays" />
      </Box>

      <Alert severity="info" sx={{ mb: 2, maxWidth: 900 }}>
        These files are in a requester-pays bucket: transfer is billed to the Google Cloud
        project you name, at about $0.12 per GB. Storage is ours. A Google Cloud project with
        billing enabled is required, which is why this section lists commands rather than links.
      </Alert>

      <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary' }}>
        One exposure
      </Typography>
      <Command>
        {`gcloud storage cp ${bucket}/${one}.tsv.bgz . --billing-project=YOUR_PROJECT`}
      </Command>

      <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary' }}>
        {`All ${cat.n_exposures} exposures (${cat.total_gb} GB)`}
      </Typography>
      <Command>
        {`gcloud storage cp -r ${bucket}/ . --billing-project=YOUR_PROJECT`}
      </Command>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5, maxWidth: 820 }}>
        Columns follow the GWAS Catalog standard. <code>neg_log10_p_value</code> is REGENIE&apos;s
        exact output; <code>p_value</code> is derived from it and underflows below about 1e-308.
        Each file ships with a <code>.tbi</code> index, so a single locus can be read with tabix
        once the file is local.
      </Typography>

      <TextField
        size="small"
        placeholder="Filter exposures…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 1.5, minWidth: 280 }}
      />

      <TableContainer sx={{ maxHeight: 440 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Exposure</TableCell>
              <TableCell align="right">Variants</TableCell>
              <TableCell align="right">N</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell align="right">Copy</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.exposure_id} hover>
                <TableCell sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                  {r.exposure_id}
                </TableCell>
                <TableCell align="right">{r.n_variants.toLocaleString()}</TableCell>
                <TableCell align="right">{r.n_samples.toLocaleString()}</TableCell>
                <TableCell align="right">{`${r.size_mb} MB`}</TableCell>
                <TableCell align="right">
                  <Copy text={`gcloud storage cp ${bucket}/${r.file} . --billing-project=YOUR_PROJECT`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!shown.length && (
        <Alert severity="info" sx={{ mt: 1.5 }}>{`No exposure matches “${q}”.`}</Alert>
      )}
    </SectionCard>
  );
}
