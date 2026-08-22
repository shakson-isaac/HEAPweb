import React, { useMemo, useState } from 'react';
import {
  Alert, AlertTitle, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import Select from 'react-select';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import ColumnarTable from '../ColumnarTable';
import LinkedScatterTable from '../LinkedScatterTable';
import { useKeys, useSection, useShard } from '../../lib/useSection';
import { ecatColor, prettyCategory, prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// The two entry points this page has never offered.
//
// Everything else under Enrichment starts from an EXPOSURE and asks which
// tissues light up. A reader who arrives holding a protein, or holding an
// organ, has had nowhere to begin. Both directions live here behind one mode
// switch, because they are the same question asked from the other end and
// splitting them into two cards would hide that they share a vocabulary.
//
// THE ASYMMETRY, WHICH IS THE ONE THING A READER CAN GET WRONG
//   The two modes use the same 54 GTEx tissue names and are NOT two views of
//   one quantity:
//
//     protein -> tissues   GTEx v10 transcript expression. Is this gene
//                          transcribed in donor samples of this tissue? Nothing
//                          in it involves an exposure, or plasma, or this study.
//     tissue  -> exposures GSEA. Do the plasma proteins associated with an
//                          exposure concentrate in this tissue's expression
//                          signature? Computed over the whole panel, never over
//                          one protein.
//
//   So a protein sitting at the top of the liver profile does not make liver
//   enrich for the exposures that protein responds to, and a tissue that
//   enriches for smoking need not contain whatever protein was looked up a
//   moment earlier. The note above the switch says this on screen rather than
//   trusting the reader to notice; it is deliberately shown in BOTH modes,
//   since the mistake is made by flipping between them.
//
// CONSTANTS THAT LIVE ON EVERY ROW
//   Two of the shipped columns are properties of the PROTEIN, written onto all
//   54 of its rows by tools/build_tissue_views.py: `tau` and the three `hpa_*`
//   fields. Printed as table columns they would read as 54 measurements. They
//   are headlines here and appear nowhere in the per-tissue table. The same
//   trap exists in mode 2: `set_size` is a property of the TISSUE's signature
//   and is identical on every one of its rows, so it is a chip, not a column.
//
// COVERAGE, REPORTED RATHER THAN BLANKED
//   tau covers 2,655 of 2,659 panel proteins. HPA subcellular location covers
//   only 1,799 -- 860 proteins have no annotation at all. An empty cell or a
//   dash there would read as "this protein has no subcellular location", which
//   is a claim about biology. What is true is that nobody has recorded one, so
//   that is what it says.
// ---------------------------------------------------------------------------

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const text = (v) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s === '' ? null : s;
};

// GTEx tissue ids are snake_case and carry a couple of tokens that lower-case
// badly ("ba9" is Brodmann area 9, "ebv" a virus). Display only -- every lookup
// in this file keys on the raw id.
const prettyTissue = (t) => String(t)
  .replace(/_/g, ' ')
  .replace(/\bba(\d+)\b/g, 'BA$1')
  .replace(/\bebv\b/g, 'EBV')
  .replace(/\bc-1\b/g, 'C1')
  .replace(/^\w/, (c) => c.toUpperCase());

// TPM spans five orders of magnitude across this table (0.001 to ~99,000), so
// values are formatted by size rather than to a fixed number of decimals.
const fmtTpm = (v) => {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '0';
  if (v >= 1000) return Math.round(v).toLocaleString();
  if (v >= 10) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(2);
  return v.toExponential(1);
};

// Decade tick labels for the log axis: 0.001 ... 1 ... 10k.
const fmtDecade = (v) => (v >= 1000 ? `${v / 1000}k` : String(v));

// Reading aids for tau, not thresholds from the paper. tau is continuous and
// the paper never cuts it; these bands exist so a bare number ("0.93") arrives
// with an interpretation attached instead of being printed and abandoned.
const TAU_BANDS = [
  {
    max: 0.4,
    word: 'ubiquitous',
    color: '#2C7FB8',
    gloss: 'transcribed at a broadly similar level across the 54 tissues',
  },
  {
    max: 0.7,
    word: 'intermediate',
    color: '#B0A24A',
    gloss: 'transcribed widely, with a clear preference for a few tissues',
  },
  {
    max: Infinity,
    word: 'tissue-restricted',
    color: '#B0653C',
    gloss: 'nearly all of its transcription sits in one or a few tissues',
  },
];
const tauBand = (t) => TAU_BANDS.find((b) => t < b.max) || TAU_BANDS[TAU_BANDS.length - 1];

const DETECTED = '#4F7CA3';
const NOT_DETECTED = '#C4B7A6';

// Fallback colouring for mode 2 when the category join is unavailable. Warm =
// enriched, cool = depleted, matching the diverging scale the heatmaps above
// use for signed NES.
const DIR_COLOR = { up: '#B2182B', down: '#2166AC' };

// The line every point in mode 2 already sits above. Drawn because a volcano
// with no visible threshold invites the reader to supply their own.
const Q_LINE = -Math.log10(0.05);

// ---------------------------------------------------------------------------
// The note that keeps the two modes apart. Shown in both, always.
// ---------------------------------------------------------------------------
function ModeContrast() {
  return (
    <Alert severity="info" icon={false} sx={{ mb: 2 }}>
      <AlertTitle sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
        The two views ask different questions of the same tissue names
      </AlertTitle>
      <Typography variant="body2" component="div">
        <b>From a protein</b> is GTEx v10 transcript expression: is this gene transcribed in
        donor samples of that tissue? No exposure, no plasma, and no result of this study
        enters it.
        <br />
        <b>From a tissue</b> is gene-set enrichment: do the plasma proteins associated with an
        exposure concentrate in that tissue&rsquo;s expression signature? It is computed across
        the whole panel, never for one protein.
        <br />
        Neither answers the other. A protein at the top of the liver profile does not make liver
        enrich for the exposures that protein responds to, and a tissue that enriches for smoking
        need not contain the protein you looked up a moment ago.
      </Typography>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// MODE 1 -- pick a protein, see where its gene is transcribed.
// ---------------------------------------------------------------------------
function ProteinMode() {
  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('protein_tissue_profile');
  // LEP opens the panel because it is the cleanest demonstration of what tau
  // means: adipose-restricted, tau 0.93, and a protein this study already
  // singles out as adiposity-driven. A ubiquitous protein would look like a
  // flat bar chart and teach nothing about the axis.
  const [picked, setPicked] = useState('LEP');
  const [scale, setScale] = useState('tpm');

  const options = useMemo(
    () => (keyIndex ? Object.keys(keyIndex.keys).map((k) => ({ value: k, label: k })) : []),
    [keyIndex],
  );
  // Never ask for a shard the published index does not carry: a rebuilt panel
  // that dropped LEP should open on something rather than on an error.
  const gene = useMemo(() => {
    if (!options.length) return picked;
    return options.some((o) => o.value === picked) ? picked : options[0].value;
  }, [options, picked]);

  const { data, loading, error } = useShard('protein_tissue_profile', gene);

  const rows = useMemo(() => {
    if (!data?.tissue) return [];
    const out = [];
    for (let i = 0; i < data.tissue.length; i += 1) {
      out.push({
        tissue: data.tissue[i],
        label: prettyTissue(data.tissue[i]),
        tpm: num(data.median_tpm?.[i]),
        n: num(data.n_samples?.[i]),
        frac: num(data.frac_of_max?.[i]),
      });
    }
    // Ranked descending, which is also the order the table inherits.
    out.sort((a, b) => (b.tpm ?? -1) - (a.tpm ?? -1));
    return out;
  }, [data]);

  // tau and the HPA fields are constant down the shard by construction, so they
  // are read once off row 0 rather than aggregated.
  const meta = useMemo(() => {
    if (!data?.tissue?.length) return null;
    return {
      tau: num(data.tau?.[0]),
      main: text(data.hpa_main_location?.[0]),
      extra: text(data.hpa_additional_location?.[0]),
      rel: text(data.hpa_reliability?.[0]),
    };
  }, [data]);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const withTpm = rows.filter((r) => r.tpm != null);
    const donors = rows.map((r) => r.n).filter((v) => v != null);
    return {
      top: withTpm[0] || null,
      nZero: withTpm.filter((r) => r.tpm === 0).length,
      // A companion to tau computed inside this shard: how many tissues reach
      // half of the protein's own maximum. One or two means restricted, twenty
      // means ubiquitous, and it is visible in the plot rather than asserted.
      nHalf: rows.filter((r) => r.frac != null && r.frac >= 0.5).length,
      donorLo: donors.length ? Math.min(...donors) : null,
      donorHi: donors.length ? Math.max(...donors) : null,
    };
  }, [rows]);

  const plot = useMemo(() => {
    if (!rows.length) return null;
    const useLog = scale === 'tpm';
    const positives = rows.map((r) => r.tpm).filter((v) => v != null && v > 0);
    if (useLog && !positives.length) return null;

    const hasZero = rows.some((r) => r.tpm === 0);
    const lo = positives.length ? Math.min(...positives) : 0.001;
    const hi = positives.length ? Math.max(...positives) : 1;

    // Zeros cannot be logged. Dropping them would silently shorten a 54-tissue
    // profile, and nudging them to the smallest positive value would print a
    // measurement that was never made. They are given their own floor a full
    // decade below the smallest measured value, their own series in the legend,
    // and a tick underneath them labelled 0.
    const zeroX = Math.max(1e-5, lo / 10);
    const axLo = useLog ? (hasZero ? zeroX / 2.2 : lo / 1.6) : -0.02;
    const axHi = useLog ? hi * 1.6 : 1.03;
    const stemBase = useLog ? axLo : 0;

    const tickvals = [];
    const ticktext = [];
    if (useLog) {
      if (hasZero) { tickvals.push(zeroX); ticktext.push('0'); }
      for (let e = -5; e <= 6; e += 1) {
        const v = 10 ** e;
        if (v >= axLo && v <= axHi) { tickvals.push(v); ticktext.push(fmtDecade(v)); }
      }
    }

    const xOf = (r) => {
      if (!useLog) return r.frac ?? 0;
      return r.tpm != null && r.tpm > 0 ? r.tpm : zeroX;
    };

    // Categorical y runs bottom-up in the order given, so the plot arrays are
    // built ascending to put the strongest tissue at the top. categoryarray is
    // set explicitly because two marker traces share the axis and first-appearance
    // ordering across traces is not something to leave to chance.
    const plotRows = [...rows].reverse();
    const categoryarray = plotRows.map((r) => r.label);

    const nMax = Math.max(...rows.map((r) => r.n ?? 0), 1);
    const sizeOf = (r) => 4 + 9 * Math.sqrt((r.n ?? 0) / nMax);

    const sx = [];
    const sy = [];
    plotRows.forEach((r) => {
      // The gap between stems is opened with a null X and never a null Y: a
      // null on a CATEGORICAL axis is not a gap, it is an unnamed category, and
      // it would quietly add a 55th row to a 54-tissue plot.
      sx.push(stemBase, xOf(r), null);
      sy.push(r.label, r.label, r.label);
    });

    const markers = (subset, name, color) => ({
      type: 'scatter',
      mode: 'markers',
      name,
      x: subset.map(xOf),
      y: subset.map((r) => r.label),
      customdata: subset.map((r) => [
        r.n == null ? '—' : r.n.toLocaleString(),
        r.frac == null ? '—' : `${(r.frac * 100).toFixed(1)}%`,
        r.tpm === 0 ? '0 — not detected' : fmtTpm(r.tpm),
      ]),
      // The plotted x for a zero is the floor, not a measurement, so the hover
      // reports the stored value from customdata and never %{x}.
      hovertemplate: '<b>%{y}</b><br>median TPM %{customdata[2]}'
        + '<br>share of this gene&#39;s maximum %{customdata[1]}'
        + '<br>%{customdata[0]} GTEx donors<extra></extra>',
      marker: {
        size: subset.map(sizeOf),
        color,
        line: { width: 0.5, color: 'rgba(0,0,0,0.30)' },
        opacity: 0.95,
      },
    });

    const detected = plotRows.filter((r) => r.tpm !== 0);
    const absent = plotRows.filter((r) => r.tpm === 0);

    const traces = [{
      type: 'scatter',
      mode: 'lines',
      x: sx,
      y: sy,
      line: { color: 'rgba(120,120,120,0.40)', width: 1 },
      connectgaps: false,
      hoverinfo: 'skip',
      showlegend: false,
    }];
    if (detected.length) traces.push(markers(detected, 'detected', DETECTED));
    if (absent.length) traces.push(markers(absent, 'median TPM = 0 (not detected)', NOT_DETECTED));

    return {
      traces,
      hasZero,
      xaxis: useLog
        ? {
          title: 'GTEx median TPM (log10 scale)',
          type: 'log',
          range: [Math.log10(axLo), Math.log10(axHi)],
          tickmode: 'array',
          tickvals,
          ticktext,
          automargin: true,
        }
        : {
          title: "share of this gene's own maximum across tissues",
          range: [axLo, axHi],
          tickformat: '.0%',
          automargin: true,
        },
      categoryarray,
    };
  }, [rows, scale]);

  const tableData = useMemo(() => {
    if (!rows.length) return null;
    return {
      Tissue: rows.map((r) => r.label),
      'Median TPM': rows.map((r) => r.tpm),
      'Share of gene max': rows.map((r) => r.frac),
      'GTEx donors': rows.map((r) => r.n),
    };
  }, [rows]);

  if (kLoading) return <Typography variant="body2">Loading the protein index…</Typography>;
  if (kError) {
    return (
      <Alert severity="error">
        Could not load the protein index: {String(kError.message || kError)}
      </Alert>
    );
  }

  const band = meta?.tau != null ? tauBand(meta.tau) : null;
  // The four panel proteins with no tau are exactly the four whose gene sits at
  // 0 TPM in all 54 tissues, so the two gaps are one fact and are reported as one.
  const allZero = rows.length > 0 && summary != null && summary.nZero === rows.length;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}>
          <Select
            options={options}
            value={{ value: gene, label: gene }}
            onChange={(o) => setPicked(o.value)}
            isSearchable
            placeholder="Search a protein…"
          />
        </Box>
        <ToggleButtonGroup size="small" exclusive value={scale}
          onChange={(_, v) => v && setScale(v)}>
          <ToggleButton value="tpm" sx={{ textTransform: 'none', px: 1.5 }}>
            Median TPM (log)
          </ToggleButton>
          <ToggleButton value="frac" sx={{ textTransform: 'none', px: 1.5 }}>
            Share of gene max
          </ToggleButton>
        </ToggleButtonGroup>
        <Chip size="small" variant="outlined"
              label={`${options.length.toLocaleString()} panel proteins`} />
      </Box>

      {loading && <Typography variant="body2">Loading {gene}…</Typography>}
      {error && (
        <Alert severity="error">
          Could not load {gene}: {String(error.message || error)}
        </Alert>
      )}

      {!loading && !error && meta && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
            {band ? (
              <Chip
                size="small"
                label={`τ = ${meta.tau.toFixed(2)} — ${band.word}`}
                sx={{ bgcolor: band.color, color: '#fff', fontWeight: 700 }}
              />
            ) : (
              // 4 of 2,659 panel proteins have no tau, and they are the four with
              // no expression anywhere. Name the gap rather than printing a blank.
              <Chip size="small" variant="outlined" label="τ — not defined for this protein" />
            )}
            {summary?.top && (
              <Chip size="small" variant="outlined"
                    label={`highest in ${summary.top.label} (${fmtTpm(summary.top.tpm)} TPM)`} />
            )}
            {summary && (
              <Chip size="small" variant="outlined"
                    label={`${summary.nHalf} of ${rows.length} tissues at ≥50% of its maximum`} />
            )}
            {summary?.nZero > 0 && (
              <Chip size="small" variant="outlined"
                    label={`${summary.nZero} tissues with a median of 0`} />
            )}
          </Box>

          {band && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              τ is tissue specificity across the 54 GTEx tissues, from 0 (the same everywhere)
              to 1 (confined to one tissue). It is a property of the gene, so it is one number
              per protein and not a column of 54. <b>{gene}</b> is {band.word}: {band.gloss}.
              The distinction matters to how a plasma measurement should be read — a ubiquitous
              protein is the kind of broadly secreted product that reports on exposure from
              everywhere at once, whereas a tissue-restricted one carries a plasma signal that is
              closer to a readout of that particular organ.
            </Typography>
          )}

          <Typography variant="body2" sx={{ mt: 1 }}>
            <b>Subcellular location (Human Protein Atlas):</b>{' '}
            {meta.main ? (
              <>
                {meta.main.replace(/;/g, '; ')}
                {meta.extra ? ` (also ${meta.extra.replace(/;/g, '; ')})` : ''}
                {meta.rel ? ` — ${meta.rel.toLowerCase()} reliability` : ''}
              </>
            ) : (
              <Box component="span" sx={{ color: 'text.secondary' }}>
                not annotated in HPA — 860 of the 2,659 panel proteins have no HPA subcellular
                record at all, so this is a gap in the annotation rather than a protein without
                a location.
              </Box>
            )}
          </Typography>
        </Box>
      )}

      {!loading && !error && allZero && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <b>{gene}</b> has a GTEx median of 0 TPM in every one of the {rows.length} tissues.
          Nothing can be placed on a log axis, and τ is undefined for the same reason — there is
          no expression to distribute across tissues. These are the same four panel proteins in
          both counts. The table below still lists every tissue.
        </Alert>
      )}

      {plot && (
        <>
          <PlotPanel
            data={plot.traces}
            height={Math.max(420, rows.length * 16 + 130)}
            layout={{
              xaxis: plot.xaxis,
              yaxis: {
                categoryorder: 'array',
                categoryarray: plot.categoryarray,
                automargin: true,
                ticks: '',
                tickfont: { size: 10 },
              },
              margin: { l: 250, r: 30, t: 46, b: 60 },
              showlegend: true,
              legend: { orientation: 'h', yanchor: 'bottom', y: 1.002, x: 0, font: { size: 10 } },
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            Dot area scales with the number of GTEx donors behind that tissue&rsquo;s median
            {summary?.donorLo != null
              ? ` (${summary.donorLo} to ${summary.donorHi.toLocaleString()} across the ${rows.length} tissues)`
              : ''}
            . A median taken over a dozen donors is a far softer number than one taken over
            several hundred, and the rank order should be read with that in mind.
            {plot.hasZero && scale === 'tpm' && ' A median of exactly 0 cannot be placed on a '
              + 'log axis; those tissues are drawn as their own series on the tick labelled 0, '
              + 'one decade below the smallest measured value, and are not a small measurement.'}
          </Typography>
        </>
      )}

      {tableData && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            All {rows.length} tissues for {gene}
          </Typography>
          <ColumnarTable data={tableData} initialRowsPerPage={10} />
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// MODE 2 -- pick a tissue, see which exposures enrich for it.
// ---------------------------------------------------------------------------
function TissueMode() {
  const { data, loading, error } = useSection('tissue_exposures');
  // tissue_exposures carries no category column, and neither does
  // enrich_exposure_tissue, which holds the same pairs. pes_reads_ci is the
  // published section that maps exposure -> category, so the colour is joined
  // from there. Its failure is not fatal: without it the points fall back to
  // direction colouring and the panel says which one it is showing, rather than
  // inventing a category.
  const { data: cats } = useSection('pes_reads_ci');
  const [picked, setPicked] = useState('lung');

  const catMap = useMemo(() => {
    const m = new Map();
    if (!cats?.exposure_id) return m;
    cats.exposure_id.forEach((e, i) => {
      if (!m.has(e)) m.set(e, text(cats.category?.[i]));
    });
    return m;
  }, [cats]);

  const tissues = useMemo(
    () => (data?.tissue ? [...new Set(data.tissue)].sort() : []),
    [data],
  );
  const tissue = useMemo(() => {
    if (!tissues.length) return null;
    return tissues.includes(picked) ? picked : tissues[0];
  }, [tissues, picked]);

  const byCategory = catMap.size > 0;

  const points = useMemo(() => {
    if (!data?.tissue || !tissue) return [];
    const out = [];
    for (let i = 0; i < data.tissue.length; i += 1) {
      if (data.tissue[i] !== tissue) continue;
      const nes = num(data.nes?.[i]);
      const q = num(data.q?.[i]);
      if (nes == null || q == null || q <= 0) continue;
      const exposure = data.exposure[i];
      const category = catMap.get(exposure) || null;
      const dir = text(data.dir?.[i]) || (nes > 0 ? 'up' : 'down');
      out.push({
        id: exposure,
        label: prettyExposure(exposure),
        x: nes,
        y: -Math.log10(q),
        color: byCategory ? ecatColor(category) : (DIR_COLOR[dir] || '#78909C'),
        meta: { category, nes, q, dir },
      });
    }
    // Ranked by |NES|, so the table under the plot is the ranked list the
    // question asks for while the plot keeps significance on its own axis.
    out.sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
    return out;
  }, [data, tissue, catMap, byCategory]);

  // set_size is the number of panel proteins in this tissue's signature. It is
  // identical on every row for the tissue, so it is stated once here; as a
  // column it would read as 98 different set sizes.
  const setSize = useMemo(() => {
    if (!data?.tissue || !tissue) return null;
    const i = data.tissue.indexOf(tissue);
    return i < 0 ? null : num(data.set_size?.[i]);
  }, [data, tissue]);

  const presentCats = useMemo(() => {
    const s = new Set();
    points.forEach((p) => { if (p.meta.category) s.add(p.meta.category); });
    return [...s].sort();
  }, [points]);

  const nUp = points.filter((p) => p.x > 0).length;
  const nNoCat = points.filter((p) => !p.meta.category).length;

  const options = useMemo(
    () => tissues.map((t) => ({ value: t, label: prettyTissue(t) })),
    [tissues],
  );

  const columns = useMemo(() => [
    { key: 'exposure', label: 'Exposure', from: (p) => p.label },
    {
      key: 'category',
      label: 'Category',
      format: (v) => (v ? prettyCategory(v) : 'no category in the score export'),
    },
    { key: 'nes', label: 'NES', align: 'right', format: (v) => (v == null ? '—' : v.toFixed(2)) },
    {
      key: 'q',
      label: 'q (FDR)',
      align: 'right',
      format: (v) => (v == null ? '—' : v.toExponential(2)),
    },
    { key: 'dir', label: 'Direction' },
  ], []);

  const legendNode = (
    <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', alignItems: 'center' }}>
      {(byCategory ? presentCats : ['up', 'down']).map((c) => (
        <Box key={c} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Box sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: byCategory ? ecatColor(c) : DIR_COLOR[c],
          }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {byCategory ? prettyCategory(c) : c}
          </Typography>
        </Box>
      ))}
    </Box>
  );

  return (
    <SectionCard loading={loading} error={error} empty={!loading && !error && !tissues.length}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 400 }}>
          <Select
            options={options}
            value={tissue ? { value: tissue, label: prettyTissue(tissue) } : null}
            onChange={(o) => setPicked(o.value)}
            isSearchable
            placeholder="Search a tissue…"
          />
        </Box>
        <Chip size="small" label={`${points.length} exposures enriched`} />
        <Chip size="small" variant="outlined"
              label={`${nUp} up · ${points.length - nUp} down`} />
        {setSize != null && (
          <Chip size="small" variant="outlined"
                label={`signature: ${setSize} panel proteins`} />
        )}
        {nNoCat > 0 && byCategory && (
          <Chip size="small" variant="outlined"
                label={`${nNoCat} without a category (gray)`} />
        )}
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        Every pair shown is already FDR q &lt; 0.05, so the question is not whether these
        exposures enrich but how strongly and in which direction. Direction is the sign of NES
        and is therefore the horizontal position — left of the dashed line the exposure&rsquo;s
        proteins are depleted from this tissue&rsquo;s signature, right of it they concentrate
        in it. That leaves colour free to carry the exposure&rsquo;s category.
        {!byCategory && ' The category lookup did not load, so points are coloured by direction '
          + 'instead — warm for enriched, cool for depleted.'}
        {' '}Only {tissues.length} of the 54 GTEx tissues have any exposure enriched at this
        threshold; the rest have none and are not offered in the picker.
      </Typography>

      {!loading && !error && !points.length && tissue && (
        <Alert severity="info">
          No exposure enriches <b>{prettyTissue(tissue)}</b> at FDR q &lt; 0.05.
        </Alert>
      )}

      {points.length > 0 && (
        <LinkedScatterTable
          points={points}
          columns={columns}
          xTitle="normalized enrichment score"
          yTitle="−log10 q (FDR)"
          title={`${prettyTissue(tissue)} — exposures whose proteins enrich this tissue signature`}
          height={480}
          searchPlaceholder="Filter exposures…"
          legend={legendNode}
          rowsVisible={12}
          extraShapes={[
            {
              type: 'line', xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0, y1: 1,
              line: { dash: 'dash', width: 1, color: '#999' },
            },
            {
              type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: Q_LINE, y1: Q_LINE,
              line: { dash: 'dot', width: 1, color: '#bbb' },
            },
          ]}
          extraAnnotations={[{
            xref: 'paper',
            yref: 'y',
            x: 1,
            y: Q_LINE,
            xanchor: 'right',
            yanchor: 'bottom',
            text: 'q = 0.05 — the export is filtered here, so nothing sits below this line',
            showarrow: false,
            font: { size: 9, color: '#999' },
          }]}
        />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
export default function TissueExplorer() {
  const [mode, setMode] = useState('protein');

  return (
    <SectionCard
      title="Start from a protein, or start from a tissue"
      subtitle={
        'The rest of this page runs one way: pick an exposure and see which tissues light up. '
        + 'These two views run the other way — from a protein to where its gene is transcribed, '
        + 'and from a tissue to the exposures whose proteins concentrate in it.'
      }
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={mode}
        onChange={(_, v) => v && setMode(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="protein" sx={{ textTransform: 'none', px: 2 }}>
          From a protein → tissues
        </ToggleButton>
        <ToggleButton value="tissue" sx={{ textTransform: 'none', px: 2 }}>
          From a tissue → exposures
        </ToggleButton>
      </ToggleButtonGroup>

      <ModeContrast />

      {mode === 'protein' ? <ProteinMode /> : <TissueMode />}
    </SectionCard>
  );
}
