import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, Paper, Slider, Typography,
} from '@mui/material';
import Select from 'react-select';
import SectionCard from '../SectionCard';
import { useSection } from '../../lib/useSection';
import { prettyExposure } from '../../lib/palette';

// ---------------------------------------------------------------------------
// Main Figure 2d -- exposure -> biological program -> tissue -- for any of the
// 114 exposures rather than the 10 the printed panel had room for.
//
// THE CAPTION IS THE SPEC
//   "(d) Exemplar exposure pathway program and tissue enrichments (FDR
//    q < 0.05). Exposure->program edges are colored by direction (red,
//    increased; blue, decreased) and weighted by number of enriched pathways.
//    Gray program->tissue edges are weighted by the number of supporting
//    exposures."
//   Every encoding below is that sentence and nothing else: `dir` picks red or
//   blue, `npath` sets the width on the left half, `n_exp` sets the width on the
//   right half, and the right half is grey. Nothing new is invented on the way
//   to the browser -- the only thing this component adds is that the reader may
//   choose the exposures.
//
// WHAT IS LIFTED, AND WHY THAT IS THE POINT
//   The printed panel routes HEAP_TRIPARTITE_EXEMPLARS -- 10 curated exposures
//   with one coherent direction each, 38 edges -- because ten labels is what
//   fits in a column of a figure. The GSEA behind it was never narrowed:
//   enrich_exposure_program carries all 114 exposures and 364 edges. Opening on
//   the exemplars reproduces the paper; swapping any exposure in answers the
//   question a printed panel cannot, which is why those ten and not others.
//
// THE ONE THING A READER CAN GET WRONG HERE
//   The two halves of this picture answer DIFFERENT questions, and the grey half
//   is not about the exposure you picked:
//
//     exposure -> program   per-exposure. Recomputed for the current selection.
//     program  -> tissue    GLOBAL. n_exp counts how many of the 114 exposures
//                           support that program->tissue link across the whole
//                           study, by leading-edge protein overlap (>=3 shared
//                           genes, same NES sign) in
//                           module2_program_tissue_edges.R. It is a property of
//                           the STUDY, not of the selection.
//
//   So the grey backbone does not move when the picker moves. That looks like a
//   bug and is not one: it is the published backbone, drawn as published, and
//   redrawing it per exposure would be a different quantity wearing the same
//   name. The whole middle and right columns are therefore held FIXED -- all
//   nine programs and all eight organs are always on screen, so the reader can
//   watch the coloured edges change against a backbone that visibly does not.
//
//   The genuinely per-exposure tissue signal exists and is a third table
//   (enrich_exposure_tissue, the selected exposure's own GTEx tissue GSEA). It
//   is deliberately NOT drawn as an edge. It is drawn as a badge grid to the
//   right of the organ labels, because an edge would read as "this exposure
//   flows through this program into this tissue" -- a claim neither table makes.
//   Hovering an exposure therefore lights its coloured edges and its badges and
//   dims the whole grey backbone: no grey edge belongs to any one exposure.
// ---------------------------------------------------------------------------

// --- constants copied from HEAP's single source of truth --------------------
// scripts/visualizations/common/program_clusters.R. Keep in sync with that file
// so the site and the manuscript figure order and group things identically.

// HEAP_PROGRAM_LEVELS -- display order for the middle column. NOT alphabetical:
// it runs immune -> structural -> neuronal -> signalling -> metabolic.
const PROGRAM_LEVELS = [
  'Innate immune', 'Adaptive immune', 'ECM / proteoglycan', 'Neuronal / synaptic',
  'Growth-factor / RTK', 'Glycan / lipid metabolism', 'Vascular / hemostasis / RAAS', 'Muscle',
];

// HEAP_TISSUE_LEVELS -- display order for the right column.
const TISSUE_LEVELS = ['Blood', 'Lung', 'Liver', 'Adipose', 'Skin', 'Vascular', 'Brain', 'Muscle'];

// HEAP_PROGRAM_TISSUES -- GTEx tissue -> organ system. Only these 8 groups are
// drawn; the GSEA also hits tissues outside them (testis, thyroid, ...), which
// are counted and named in the footer rather than dropped in silence.
const PROGRAM_TISSUES = {
  Lung: ['lung'],
  Liver: ['liver', 'stomach', 'small_intestine_terminal_ileum', 'colon_transverse',
    'minor_salivary_gland', 'esophagus_mucosa'],
  Blood: ['spleen', 'whole_blood', 'cells_ebv-transformed_lymphocytes'],
  Adipose: ['adipose_subcutaneous', 'adipose_visceral_omentum'],
  Vascular: ['artery_coronary', 'artery_aorta', 'artery_tibial'],
  Skin: ['skin_not_sun_exposed_suprapubic', 'skin_sun_exposed_lower_leg', 'cells_cultured_fibroblasts'],
  Brain: ['brain_amygdala', 'brain_hippocampus', 'brain_anterior_cingulate_cortex_ba24',
    'brain_caudate_basal_ganglia', 'brain_cortex', 'brain_frontal_cortex_ba9',
    'brain_nucleus_accumbens_basal_ganglia', 'brain_hypothalamus', 'nerve_tibial',
    'brain_putamen_basal_ganglia', 'pituitary', 'brain_substantia_nigra',
    'brain_cerebellar_hemisphere', 'brain_cerebellum'],
  Muscle: ['muscle_skeletal', 'heart_left_ventricle', 'heart_atrial_appendage'],
};

const TISSUE_ORGAN = new Map();
Object.entries(PROGRAM_TISSUES).forEach(([organ, list]) => {
  list.forEach((t) => TISSUE_ORGAN.set(t, organ));
});

// HEAP_TRIPARTITE_EXEMPLARS -- the curated ten the printed panel draws, harmful
// first then protective. The short labels are the figure's, kept so the default
// view can be checked against the paper line for line.
const EXEMPLARS = [
  { id: 'pack_years_of_smoking_f20161_0_0', short: 'Smoking', grp: 'Harmful' },
  { id: 'no2_mean', short: 'Air pollution (NO₂)', grp: 'Harmful' },
  { id: 'index_of_multiple_deprivation_england_f26410_0_0', short: 'Deprivation', grp: 'Harmful' },
  { id: 'processed_meat_intake_f1349_0_0', short: 'Processed meat', grp: 'Harmful' },
  { id: 'beef_intake_f1369_0_0', short: 'Red meat', grp: 'Harmful' },
  { id: 'oily_fish_intake_f1329_0_0', short: 'Oily fish', grp: 'Protective' },
  { id: 'usual_walking_pace_f924_0_0', short: 'Walking pace', grp: 'Protective' },
  { id: 'summed_days_activity_f22033_0_0', short: 'Active days/wk', grp: 'Protective' },
  { id: 'cereal_intake_f1458_0_0', short: 'Cereal / fiber', grp: 'Protective' },
  { id: 'dried_fruit_intake_f1319_0_0', short: 'Dried fruit', grp: 'Protective' },
];
const EXEMPLAR_IDS = EXEMPLARS.map((e) => e.id);
const EXEMPLAR_SHORT = new Map(EXEMPLARS.map((e) => [e.id, e.short]));

// Two-line program labels, straight from `plab` in build_module2_fig3_composite.R.
const PROGRAM_LINES = {
  'Innate immune': ['Innate', 'immune'],
  'Adaptive immune': ['Adaptive', 'immune'],
  'ECM / proteoglycan': ['ECM /', 'proteoglycan'],
  'Neuronal / synaptic': ['Neuronal /', 'synaptic'],
  'Growth-factor / RTK': ['Growth-factor', '/ RTK'],
  'Glycan / lipid metabolism': ['Glycan / lipid', 'metabolism'],
  'Vascular / hemostasis / RAAS': ['Vascular /', 'hemostasis / RAAS'],
  Muscle: ['Muscle'],
  Other: ['Other /', 'unclustered'],
};

// --- encodings, in step with the plotter ------------------------------------
// The printed panel's RED/BLU. Direction is the direction of the enrichment:
// red = the program is increased under the exposure, blue = decreased.
const RED = '#B2182B';
const BLU = '#2166AC';
const GREY = '#9E9E9E';
const dirColor = (d) => (d === 'down' ? BLU : RED);

// The published backbone floor. The printed panel draws program->tissue edges
// with n_exp >= 4; the slider opens that up rather than hard-coding it, but it
// opens at 4 so the default view is the figure.
const DEFAULT_MIN_EXP = 4;

// More than a dozen exposures in the left column turns a readable comparison
// into a hairball and pushes the badge grid off the page. The printed panel
// used ten.
const MAX_SEL = 12;

// --- geometry ---------------------------------------------------------------
// Hand-placed columns, exactly as InterventionNetwork.js and TriadDAG.js place
// theirs. The left-to-right reading order exposure -> program -> tissue IS the
// argument; a force-directed layout would reshuffle on every render and delete
// it. Same selection in, same picture out.
const M = { top: 74, bottom: 30 };
const X_EXP = 300;          // exposure node dot / right edge of its label
const X_PROG = 668;         // program label box center
const PROG_HALF = 84;       // half-width of that box
const X_TISS = 1000;        // organ node dot
const BADGE_X = 1112;       // left edge of the per-exposure tissue badge grid
const BADGE_W = 15;
const BADGE_H = 15;
const EXP_PITCH = 30;
const MIN_W = 1200;

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

const fmtQ = (v) => (v === null ? '—' : Number(v).toPrecision(2));

// Horizontal-tangent cubic: leaves each column flat so a bundle of edges reads
// as a flow rather than as a starburst out of the node.
const link = (x0, y0, x1, y1) => {
  const dx = (x1 - x0) * 0.45;
  return `M${x0},${y0} C${x0 + dx},${y0} ${x1 - dx},${y1} ${x1},${y1}`;
};

// Evenly spread n rows across the drawing area, first and last inset by half a
// slot so the column is centered the way the printed panel's is.
const spread = (n, top, h) => Array.from({ length: n }, (_, i) => top + ((i + 0.5) * h) / n);

// A flared wedge, the same width key the printed panel draws under the
// tripartite: thin on the left is fewer, thick on the right is more.
function WidthKey({ color, max, unit }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <svg width="54" height="14" aria-hidden="true">
        <polygon points="1,7.5 1,6.5 52,2 52,12" fill={color} />
      </svg>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {`1 → ${max} ${unit}`}
      </Typography>
    </Box>
  );
}

export default function EnrichTripartite() {
  const { data: epData, loading: epLoading, error: epError } = useSection('enrich_exposure_program');
  const { data: ptData, loading: ptLoading, error: ptError } = useSection('enrich_program_tissue');
  const { data: etData, loading: etLoading, error: etError } = useSection('enrich_exposure_tissue');

  // Open on the curated ten: the default view IS main Figure 2d, so a reader
  // arrives at a picture they can hold against the paper before changing it.
  const [selected, setSelected] = useState(EXEMPLAR_IDS);
  const [minExp, setMinExp] = useState(DEFAULT_MIN_EXP);
  // The printed panel filters to HEAP_PROGRAM_LEVELS, so heap_program_cluster's
  // catch-all "Other" bucket never reaches it. Off by default, which makes the
  // opening view exactly Fig 2d (38 edges over the exemplars, as published);
  // one click brings the remainder back rather than dropping it in silence.
  const [showOther, setShowOther] = useState(false);
  const [hover, setHover] = useState(null);     // {kind: exposure|program|organ, id}
  const [openEdge, setOpenEdge] = useState(null); // {exposure, program}

  // --- parse the three columnar sections ------------------------------------
  const parsed = useMemo(() => {
    if (!epData?.exposure || !ptData?.program || !etData?.exposure) return null;

    // 1. exposure -> program. Per-exposure; this is what the picker drives.
    const byExposure = new Map();
    for (let i = 0; i < epData.exposure.length; i += 1) {
      const id = epData.exposure[i];
      const paths = String(epData.pathways?.[i] || '').split('; ').filter(Boolean);
      if (!byExposure.has(id)) byExposure.set(id, []);
      byExposure.get(id).push({
        exposure: id,
        program: epData.program[i],
        npath: num(epData.npath?.[i]) || 0,
        nUp: num(epData.n_up?.[i]) || 0,
        nDn: num(epData.n_dn?.[i]) || 0,
        // A SUM of NES over the enriched pathways, not a mean effect size: it
        // grows with npath. Labeled as a sum everywhere it is shown, and never
        // used for colour or width -- `dir` and `npath` do that, as the caption
        // says.
        netNes: num(epData.net_nes?.[i]),
        dir: epData.dir?.[i] === 'down' ? 'down' : 'up',
        pathways: paths,
      });
    }

    // 2. program -> tissue. GLOBAL: n_exp is a count over all 114 exposures, so
    // nothing here is keyed on the selection and nothing here is recomputed.
    const backbone = [];
    for (let i = 0; i < ptData.program.length; i += 1) {
      backbone.push({
        program: ptData.program[i],
        organ: ptData.organ[i],
        nExp: num(ptData.n_exp?.[i]) || 0,
        nUp: num(ptData.n_up?.[i]) || 0,
        nDn: num(ptData.n_dn?.[i]) || 0,
      });
    }

    // 3. exposure -> tissue. Per-exposure, and a different signal from (2): the
    // exposure's own GTEx tissue GSEA. Bucketed into the 8 organ groups; hits
    // outside those groups are kept aside to be named, not discarded.
    const tissueBy = new Map();
    for (let i = 0; i < etData.exposure.length; i += 1) {
      const id = etData.exposure[i];
      const tissue = etData.tissue[i];
      if (!tissueBy.has(id)) tissueBy.set(id, { byOrgan: new Map(), outside: [] });
      const rec = {
        tissue,
        nes: num(etData.nes?.[i]),
        q: num(etData.q?.[i]),
        dir: etData.dir?.[i] === 'down' ? 'down' : 'up',
        setSize: num(etData.set_size?.[i]),
      };
      const organ = TISSUE_ORGAN.get(tissue);
      const slot = tissueBy.get(id);
      if (!organ) { slot.outside.push(rec); continue; }
      if (!slot.byOrgan.has(organ)) slot.byOrgan.set(organ, []);
      slot.byOrgan.get(organ).push(rec);
    }

    // Programs in HEAP_PROGRAM_LEVELS order, then anything the data carries that
    // the curated list does not name ("Other", the unclustered remainder the
    // printed panel drops). Appended rather than dropped so a rebuilt payload
    // never loses a program in silence.
    const seen = new Set([
      ...[...byExposure.values()].flat().map((e) => e.program),
      ...backbone.map((b) => b.program),
    ]);
    const programs = [
      ...PROGRAM_LEVELS.filter((p) => seen.has(p)),
      ...[...seen].filter((p) => !PROGRAM_LEVELS.includes(p)).sort(),
    ];

    const allEdges = [...byExposure.values()].flat();
    return {
      byExposure,
      backbone,
      tissueBy,
      programs,
      exposures: [...byExposure.keys()].sort(),
      maxNpath: Math.max(1, ...allEdges.map((e) => e.npath)),
      maxNexp: Math.max(1, ...backbone.map((b) => b.nExp)),
      nEdges: allEdges.length,
      nTissueRows: etData.exposure.length,
    };
  }, [epData, ptData, etData]);

  // --- lay out --------------------------------------------------------------
  const view = useMemo(() => {
    if (!parsed) return null;
    const {
      byExposure, backbone, tissueBy, maxNpath, maxNexp,
    } = parsed;

    const programs = showOther
      ? parsed.programs : parsed.programs.filter((p) => PROGRAM_LEVELS.includes(p));
    const inCol = new Set(programs);

    // Selection order is the reader's order (the exemplar preset keeps the
    // figure's harmful-then-protective order), so it is not re-sorted.
    const sel = selected.filter((id) => byExposure.has(id)).slice(0, MAX_SEL);
    const allEp = sel.flatMap((id) => byExposure.get(id));
    const epEdges = allEp.filter((e) => inCol.has(e.program));
    const ptEdges = backbone.filter((b) => b.nExp >= minExp && inCol.has(b.program)
      && TISSUE_LEVELS.includes(b.organ));

    // The middle and right columns are FIXED: every program and every organ is
    // drawn whether or not the current selection reaches it. That is what makes
    // the grey backbone's independence visible instead of merely asserted --
    // change the exposures and the grey half of the picture does not move.
    const expH = Math.max(sel.length, 1) * EXP_PITCH;
    const innerH = Math.max(expH, programs.length * 52, TISSUE_LEVELS.length * 50, 430);
    const H = innerH + M.top + M.bottom;

    const progY = new Map(spread(programs.length, M.top, innerH).map((y, i) => [programs[i], y]));
    const tissY = new Map(spread(TISSUE_LEVELS.length, M.top, innerH).map((y, i) => [TISSUE_LEVELS[i], y]));
    const expTop = M.top + (innerH - expH) / 2;
    const expRows = sel.map((id, i) => ({
      id,
      idx: i + 1,
      // The exemplars keep the figure's short label; anything else gets the
      // site's standard exposure label, which preserves the one-hot level.
      label: EXEMPLAR_SHORT.get(id) || prettyExposure(id),
      full: prettyExposure(id),
      y: expTop + i * EXP_PITCH + EXP_PITCH / 2,
    }));

    // Which programs / organs the selection actually reaches, so unreached ones
    // can be drawn muted rather than removed.
    const reachedProg = new Set(epEdges.map((e) => e.program));
    const reachedOrgan = new Set();
    sel.forEach((id) => {
      const slot = tissueBy.get(id);
      if (slot) [...slot.byOrgan.keys()].forEach((o) => reachedOrgan.add(o));
    });

    // The badge grid: one column per selected exposure, one row per organ.
    const badges = [];
    TISSUE_LEVELS.forEach((organ) => {
      expRows.forEach((row, i) => {
        const hits = parsed.tissueBy.get(row.id)?.byOrgan.get(organ) || [];
        if (!hits.length) return;
        const up = hits.filter((h) => h.dir === 'up');
        const dn = hits.filter((h) => h.dir === 'down');
        badges.push({
          organ,
          exposure: row.id,
          expLabel: row.label,
          x: BADGE_X + i * BADGE_W,
          y: tissY.get(organ) - BADGE_H / 2,
          up: up.length,
          dn: dn.length,
          hits: [...hits].sort((a, b) => Math.abs(b.nes || 0) - Math.abs(a.nes || 0)),
        });
      });
    });

    const outside = sel.reduce((n, id) => n + (tissueBy.get(id)?.outside.length || 0), 0);

    return {
      sel,
      expRows,
      epEdges,
      ptEdges,
      programs,
      progY,
      tissY,
      badges,
      reachedProg,
      reachedOrgan,
      outside,
      H,
      svgW: Math.max(MIN_W, BADGE_X + Math.max(sel.length, 1) * BADGE_W + 24),
      // Two width scales, two different counts. They are never shared and never
      // compared -- see the legend, which says so in words.
      epWidth: (n) => 0.9 + (4.8 * n) / maxNpath,
      ptWidth: (n) => 0.9 + (6.2 * n) / maxNexp,
      maxNpath,
      maxNexp,
      nBackboneAll: backbone.length,
      // Edges the "Other" toggle is currently holding back, stated rather than
      // quietly missing.
      nOtherEp: allEp.length - epEdges.length,
      nOtherPt: backbone.filter((b) => b.nExp >= minExp && !inCol.has(b.program)).length,
    };
  }, [parsed, selected, minExp, showOther]);

  const options = useMemo(() => (parsed ? parsed.exposures.map((id) => ({
    value: id,
    label: EXEMPLAR_SHORT.has(id) ? `${EXEMPLAR_SHORT.get(id)} — ${prettyExposure(id)}` : prettyExposure(id),
  })) : []), [parsed]);

  const selectValue = useMemo(
    () => (view ? view.sel.map((id) => options.find((o) => o.value === id)).filter(Boolean) : []),
    [view, options],
  );

  // --- highlighting ---------------------------------------------------------
  // Hovering a PROGRAM lights its edges both ways: both halves belong to that
  // program, so both are legitimately its.
  // Hovering an EXPOSURE lights only its coloured edges and its own badges, and
  // dims the entire grey backbone -- no grey edge is the property of any one
  // exposure, and lighting one here would invent support that no table claims.
  const epLit = (e) => !hover
    || (hover.kind === 'program' && hover.id === e.program)
    || (hover.kind === 'exposure' && hover.id === e.exposure);
  const ptLit = (b) => (!hover ? true
    : (hover.kind === 'program' && hover.id === b.program)
      || (hover.kind === 'organ' && hover.id === b.organ));
  const progLit = (p) => !hover
    || (hover.kind === 'program' && hover.id === p)
    || (hover.kind === 'exposure' && (view?.epEdges || []).some((e) => e.exposure === hover.id && e.program === p))
    || (hover.kind === 'organ' && (view?.ptEdges || []).some((b) => b.organ === hover.id && b.program === p));
  const organLit = (o) => !hover
    || (hover.kind === 'organ' && hover.id === o)
    || (hover.kind === 'program' && (view?.ptEdges || []).some((b) => b.program === hover.id && b.organ === o))
    // An exposure's own tissue enrichment is the one per-exposure claim on an
    // organ, so an exposure hover lights the organs it enriches -- via the
    // badges, never via the backbone.
    || (hover.kind === 'exposure' && (view?.badges || []).some((g) => g.exposure === hover.id && g.organ === o));
  const expLit = (id) => !hover
    || (hover.kind === 'exposure' && hover.id === id)
    || (hover.kind === 'program' && (view?.epEdges || []).some((e) => e.exposure === id && e.program === hover.id));
  const badgeLit = (g) => !hover
    || (hover.kind === 'exposure' && hover.id === g.exposure)
    || (hover.kind === 'organ' && hover.id === g.organ);

  const open = openEdge && view
    ? view.epEdges.find((e) => e.exposure === openEdge.exposure && e.program === openEdge.program)
    : null;

  const loading = epLoading || ptLoading || etLoading;
  const error = epError || ptError || etError;

  return (
    <SectionCard
      title="Exposure → biological program → tissue, for any exposure"
      subtitle={
        'Main Figure 2d routes ten curated exemplar exposures through the biological program '
        + 'clusters to organ systems. The enrichment behind it was never narrowed to those ten — '
        + 'this is the same panel, drawn for any of the 114 exposures, so the reader can ask why '
        + 'the exemplars were the exemplars. All edges are FDR q < 0.05.'
      }
      loading={loading}
      error={error}
      empty={!loading && !error && !view}
    >
      {view && (
        <>
          {/* --- controls ------------------------------------------------- */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'flex-end', mb: 2 }}>
            <Box sx={{ flex: '1 1 420px', minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                {`Exposures (${view.sel.length} of ${MAX_SEL} drawn, ${parsed.exposures.length} available)`}
              </Typography>
              <Select
                isMulti
                options={options}
                value={selectValue}
                onChange={(v) => {
                  setSelected((v || []).slice(0, MAX_SEL).map((o) => o.value));
                  setOpenEdge(null);
                }}
                isSearchable
                placeholder="Search an exposure…"
                closeMenuOnSelect={false}
                styles={{ menu: (b) => ({ ...b, zIndex: 20 }) }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label="the curated exemplars (Fig 2d)"
                variant={view.sel.join('|') === EXEMPLAR_IDS.join('|') ? 'filled' : 'outlined'}
                color={view.sel.join('|') === EXEMPLAR_IDS.join('|') ? 'primary' : 'default'}
                onClick={() => { setSelected(EXEMPLAR_IDS); setOpenEdge(null); }}
              />
              <Chip size="small" variant="outlined" label="clear" onClick={() => { setSelected([]); setOpenEdge(null); }} />
              <Chip
                size="small"
                variant={showOther ? 'filled' : 'outlined'}
                label={showOther ? 'hide unclustered "Other"' : `show unclustered "Other" (${view.nOtherEp + view.nOtherPt} edges)`}
                onClick={() => { setShowOther((v) => !v); setOpenEdge(null); }}
              />
            </Box>

            <Box sx={{ flex: '1 1 260px', minWidth: 220 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
                {`Backbone floor — program→tissue links with ≥ ${minExp} supporting exposures`}
              </Typography>
              <Slider
                size="small"
                value={minExp}
                min={1}
                max={20}
                onChange={(_, v) => setMinExp(v)}
                valueLabelDisplay="auto"
                marks={[{ value: DEFAULT_MIN_EXP, label: 'Fig 2d' }]}
                sx={{ mx: 1, width: 'calc(100% - 16px)' }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <Chip size="small" variant="outlined" label={`${view.epEdges.length} exposure→program edges drawn of ${parsed.nEdges}`} />
            <Chip size="small" variant="outlined" label={`${view.ptEdges.length} of ${view.nBackboneAll} backbone edges (global)`} />
            <Chip size="small" variant="outlined" label={`${view.badges.length} organ badges from ${parsed.nTissueRows.toLocaleString()} tissue hits`} />
            {!showOther && (view.nOtherEp > 0 || view.nOtherPt > 0) && (
              <Chip
                size="small"
                variant="outlined"
                color="warning"
                label={`+${view.nOtherEp} exposure→program and ${view.nOtherPt} backbone edges in "Other", hidden as in print`}
              />
            )}
          </Box>

          {view.sel.length === 0 && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              No exposure selected — the left column is empty and the coloured edges are gone, but the
              grey backbone is unchanged. That is the point: it is a global count over all 114
              exposures, not a property of the selection.
            </Alert>
          )}
          {selected.length > MAX_SEL && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Only the first {MAX_SEL} of the {selected.length} chosen exposures are drawn. Beyond that
              the left column stops being a comparison and becomes a hairball; the printed panel used ten.
            </Alert>
          )}

          {/* --- the tripartite ------------------------------------------- */}
          <Box sx={{
            width: '100%',
            overflow: 'auto',
            maxHeight: 820,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: '#fff',
          }}
          >
            <svg
              viewBox={`0 0 ${view.svgW} ${view.H}`}
              width={view.svgW}
              height={view.H}
              role="img"
              aria-label={
                `Tripartite flow: ${view.sel.length} exposures on the left, ${view.programs.length} `
                + 'biological program clusters in the middle, and 8 organ systems on the right. '
                + 'Colored edges are per-exposure; the grey program-to-tissue backbone is a global '
                + 'count over all 114 exposures and does not change with the selection.'
              }
              style={{ display: 'block', minWidth: view.svgW, background: '#fff' }}
              onMouseLeave={() => setHover(null)}
            >
              {/* Background hit area, first so it sits behind everything. It
                  releases the highlight when the pointer slides off a node onto
                  empty canvas; without it the picture stays dimmed around
                  whatever was hovered last until the mouse leaves the SVG. */}
              <rect
                x={0}
                y={0}
                width={view.svgW}
                height={view.H}
                fill="#fff"
                onMouseEnter={() => setHover(null)}
              />

              {/* column headers, as in the printed panel */}
              <g fontSize="11" fontWeight="700" fill="#8A8A8A" letterSpacing="0.6">
                <text x={X_EXP} y={30} textAnchor="end">EXPOSURE</text>
                <text x={X_PROG} y={30} textAnchor="middle">PROGRAM</text>
                <text x={X_TISS} y={30} textAnchor="start">TISSUE</text>
              </g>
              <g fontSize="8.5" fill="#9E9E9E">
                <text x={BADGE_X} y={22}>this exposure&apos;s OWN</text>
                <text x={BADGE_X} y={33}>tissue enrichment</text>
                <text x={BADGE_X} y={44} fill="#BDBDBD">(not the backbone)</text>
              </g>

              {/* badge column headers: the index shown beside each exposure */}
              {view.expRows.map((r, i) => (
                <text
                  key={`bh${r.id}`}
                  x={BADGE_X + i * BADGE_W + BADGE_W / 2}
                  y={M.top - 12}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={hover?.kind === 'exposure' && hover.id === r.id ? '#37474F' : '#B0B0B0'}
                >
                  {r.idx}
                </text>
              ))}

              {/* program -> tissue: grey, weighted by supporting exposures.
                  Drawn first so the coloured per-exposure edges sit on top, the
                  way the printed panel layers them. */}
              <g fill="none">
                {view.ptEdges.map((b) => {
                  const y0 = view.progY.get(b.program);
                  const y1 = view.tissY.get(b.organ);
                  if (y0 === undefined || y1 === undefined) return null;
                  const show = ptLit(b);
                  return (
                    <path
                      key={`pt-${b.program}-${b.organ}`}
                      d={link(X_PROG + PROG_HALF, y0, X_TISS - 5, y1)}
                      stroke={GREY}
                      strokeWidth={view.ptWidth(b.nExp)}
                      strokeLinecap="round"
                      opacity={show ? 0.55 : 0.05}
                    >
                      <title>
                        {`${b.program} → ${b.organ}: ${b.nExp} of the 114 exposures support this link `
                          + `(${b.nUp} increased, ${b.nDn} decreased). A global count — it does not `
                          + 'change with the exposures you picked.'}
                      </title>
                    </path>
                  );
                })}
              </g>

              {/* exposure -> program: red increased / blue decreased, weighted
                  by the number of enriched pathways. A transparent fat line sits
                  under each one so a 1-pathway edge is still clickable. */}
              <g fill="none">
                {view.epEdges.map((e) => {
                  const row = view.expRows.find((r) => r.id === e.exposure);
                  const y1 = view.progY.get(e.program);
                  if (!row || y1 === undefined) return null;
                  const show = epLit(e);
                  const isOpen = open && open.exposure === e.exposure && open.program === e.program;
                  const d = link(X_EXP + 5, row.y, X_PROG - PROG_HALF, y1);
                  return (
                    <g
                      key={`ep-${e.exposure}-${e.program}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setOpenEdge(isOpen ? null : { exposure: e.exposure, program: e.program })}
                    >
                      <path d={d} stroke="transparent" strokeWidth={11} />
                      <path
                        d={d}
                        stroke={dirColor(e.dir)}
                        strokeWidth={view.epWidth(e.npath) + (isOpen ? 2 : 0)}
                        strokeLinecap="round"
                        opacity={show ? 0.9 : 0.06}
                      />
                      <title>
                        {`${row.label} → ${e.program}: ${e.npath} enriched pathway`
                          + `${e.npath === 1 ? '' : 's'} (${e.nUp} up, ${e.nDn} down) — `
                          + `${e.dir === 'down' ? 'decreased' : 'increased'}. Click for the pathways.`}
                      </title>
                    </g>
                  );
                })}
              </g>

              {/* exposure column */}
              {view.expRows.map((r) => {
                const show = expLit(r.id);
                return (
                  <g
                    key={r.id}
                    opacity={show ? 1 : 0.2}
                    style={{ cursor: 'default' }}
                    onMouseEnter={() => setHover({ kind: 'exposure', id: r.id })}
                  >
                    <text
                      x={X_EXP - 10}
                      y={r.y + 4}
                      textAnchor="end"
                      fontSize="11.5"
                      fontWeight="700"
                      fill="#37474F"
                    >
                      {`${r.idx}. ${truncate(r.label, 40)}`}
                    </text>
                    <circle cx={X_EXP} cy={r.y} r={3.4} fill="#37474F" />
                    <title>{`${r.full} — column ${r.idx} of the tissue badge grid`}</title>
                  </g>
                );
              })}

              {/* program column: fixed, all clusters, HEAP_PROGRAM_LEVELS order */}
              {view.programs.map((p) => {
                const y = view.progY.get(p);
                const lines = PROGRAM_LINES[p] || [p];
                const show = progLit(p);
                const reached = view.reachedProg.has(p);
                return (
                  <g
                    key={p}
                    opacity={show ? 1 : 0.22}
                    style={{ cursor: 'default' }}
                    onMouseEnter={() => setHover({ kind: 'program', id: p })}
                  >
                    <rect
                      x={X_PROG - PROG_HALF}
                      y={y - 8 - (lines.length - 1) * 7}
                      width={PROG_HALF * 2}
                      height={16 + (lines.length - 1) * 14}
                      rx={4}
                      fill="#fff"
                      stroke={reached ? '#90A4AE' : '#E0E0E0'}
                      strokeWidth={reached ? 1 : 0.8}
                    />
                    {lines.map((ln, k) => (
                      <text
                        key={ln}
                        x={X_PROG}
                        y={y + 4 - (lines.length - 1) * 7 + k * 14}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={reached ? '#263238' : '#B0B0B0'}
                      >
                        {ln}
                      </text>
                    ))}
                    <title>
                      {reached
                        ? `${p} — hover holds its edges on both sides`
                        : `${p} — no selected exposure is enriched for this program; it is kept on `
                          + 'screen so the column does not reshuffle between selections'}
                    </title>
                  </g>
                );
              })}

              {/* tissue column: fixed, HEAP_TISSUE_LEVELS order */}
              {TISSUE_LEVELS.map((t) => {
                const y = view.tissY.get(t);
                const show = organLit(t);
                const own = view.reachedOrgan.has(t);
                return (
                  <g
                    key={t}
                    opacity={show ? 1 : 0.22}
                    style={{ cursor: 'default' }}
                    onMouseEnter={() => setHover({ kind: 'organ', id: t })}
                  >
                    <circle cx={X_TISS} cy={y} r={3.4} fill="#37474F" />
                    <text x={X_TISS + 10} y={y + 4} fontSize="11.5" fontWeight="700" fill="#37474F">
                      {t}
                    </text>
                    <title>
                      {`${t} — GTEx tissues: ${PROGRAM_TISSUES[t].join(', ')}`
                        + `${own ? '' : '; no selected exposure enriches any of them'}`}
                    </title>
                  </g>
                );
              })}

              {/* the badge grid: the selected exposures' OWN tissue enrichment.
                  Deliberately not an edge. A square that touches neither column
                  cannot be misread as "this exposure flows through this program
                  into this tissue" -- a claim neither table makes. */}
              {view.badges.map((g) => {
                const show = badgeLit(g);
                const both = g.up > 0 && g.dn > 0;
                const top = g.hits[0];
                return (
                  <g
                    key={`bg-${g.organ}-${g.exposure}`}
                    opacity={show ? 1 : 0.18}
                    style={{ cursor: 'default' }}
                    onMouseEnter={() => setHover({ kind: 'organ', id: g.organ })}
                  >
                    {both ? (
                      <>
                        <rect x={g.x + 1} y={g.y + 1} width={BADGE_W - 3} height={(BADGE_H - 2) / 2} fill={RED} opacity={0.9} />
                        <rect
                          x={g.x + 1}
                          y={g.y + 1 + (BADGE_H - 2) / 2}
                          width={BADGE_W - 3}
                          height={(BADGE_H - 2) / 2}
                          fill={BLU}
                          opacity={0.9}
                        />
                      </>
                    ) : (
                      <rect
                        x={g.x + 1}
                        y={g.y + 1}
                        width={BADGE_W - 3}
                        height={BADGE_H - 2}
                        fill={g.up > 0 ? RED : BLU}
                        opacity={0.9}
                      />
                    )}
                    <title>
                      {`${g.expLabel} — own GTEx enrichment in ${g.organ}: ${g.hits.length} tissue`
                        + `${g.hits.length === 1 ? '' : 's'} (${g.up} increased, ${g.dn} decreased); `
                        + `strongest ${top.tissue} NES ${top.nes === null ? '—' : top.nes.toFixed(2)}, `
                        + `q ${fmtQ(top.q)}. Independent of the grey backbone.`}
                    </title>
                  </g>
                );
              })}
            </svg>
          </Box>

          {/* --- the pathways behind one edge ----------------------------- */}
          {open && (
            <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderLeft: `4px solid ${dirColor(open.dir)}` }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {`${EXEMPLAR_SHORT.get(open.exposure) || prettyExposure(open.exposure)} → ${open.program}`}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: dirColor(open.dir) }}>
                  {open.dir === 'down' ? 'decreased' : 'increased'}
                </Typography>
                <Chip size="small" variant="outlined" label="close" onClick={() => setOpenEdge(null)} sx={{ ml: 'auto' }} />
              </Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.75 }}>
                {`${open.npath} Reactome pathway${open.npath === 1 ? '' : 's'} at FDR q < 0.05 `
                  + `(${open.nUp} increased, ${open.nDn} decreased) — this count is the edge width. `}
                {/* net_nes is a SUM over the enriched pathways, so it grows with
                    npath: it is not a mean effect size and is never used for
                    colour or width. Named as a sum wherever it appears. */}
                {`Net NES = ${open.netNes === null ? '—' : open.netNes.toFixed(2)}, the SUM of NES over `
                  + 'those pathways (it grows with their number; it is not a mean effect size).'}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, columns: { xs: 1, md: 2 }, columnGap: 3 }}>
                {open.pathways.map((p) => (
                  <Typography key={p} component="li" variant="caption" sx={{ display: 'list-item', breakInside: 'avoid' }}>
                    {p}
                  </Typography>
                ))}
              </Box>
            </Paper>
          )}

          {/* --- legend: every colour, every line, and BOTH width scales --- */}
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center', mb: 1 }}>
              {[[RED, 'exposure → program, increased'], [BLU, 'exposure → program, decreased'],
                [GREY, 'program → tissue backbone (grey, global)']].map(([c, t]) => (
                  <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <svg width="42" height="10" aria-hidden="true">
                      <line x1="1" y1="5" x2="41" y2="5" stroke={c} strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t}</Typography>
                  </Box>
              ))}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <svg width="26" height="14" aria-hidden="true">
                  <rect x="1" y="1" width="11" height="12" fill={RED} opacity="0.9" />
                  <rect x="14" y="1" width="11" height="6" fill={RED} opacity="0.9" />
                  <rect x="14" y="7" width="11" height="6" fill={BLU} opacity="0.9" />
                </svg>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  badge = that exposure&apos;s own GTEx tissue enrichment (split = both directions)
                </Typography>
              </Box>
            </Box>

            {/* The two widths encode DIFFERENT counts. Saying so is not
                pedantry: a reader who assumes one scale will compare a 9-pathway
                edge with an 84-exposure edge and conclude the wrong thing. */}
            <Paper variant="outlined" sx={{ p: 1.25, bgcolor: '#FAFAFA' }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.75 }}>
                Two width scales, two different counts — they are not comparable
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WidthKey color="#7A2430" max={view.maxNpath} unit="enriched pathways" />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    <b>left half</b> — width = pathways behind that exposure→program edge
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WidthKey color="#9E9E9E" max={view.maxNexp} unit="supporting exposures" />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    <b>right half</b> — width = exposures supporting that program→tissue link
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* --- the note the next reader needs ---------------------------- */}
          <Alert severity="info" sx={{ mt: 1.5 }}>
            <b>The grey backbone does not respond to the exposure picker, and that is correct.</b>{' '}
            Its weight, <i>n_exp</i>, counts how many of the 114 exposures support each
            program→tissue link across the whole study — leading-edge protein overlap (≥ 3 shared
            genes, same NES sign) in <code>module2_program_tissue_edges.R</code>. It is a property of
            the study, not of your selection, so it is drawn as published. The per-exposure tissue
            signal does exist and is the badge grid on the right: the selected exposure&apos;s own
            GTEx enrichment. It is drawn as badges rather than edges because an edge would read as
            &ldquo;this exposure reaches this tissue through this program&rdquo;, which neither table
            claims.
            {view.outside > 0 && (
              <>
                {' '}Across the current selection, {view.outside} further significant tissue
                enrichment{view.outside === 1 ? '' : 's'} fall outside the eight organ groups
                (testis, thyroid, kidney and the rest) and so carry no badge.
              </>
            )}
          </Alert>

          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
            Read left to right. Columns are hand-placed rather than force-directed: the order{' '}
            <i>exposure → program → tissue</i> is the argument, and programs and organs keep the
            manuscript&apos;s display order (<code>HEAP_PROGRAM_LEVELS</code>,{' '}
            <code>HEAP_TISSUE_LEVELS</code>), not an alphabetical one. Every program and organ stays
            on screen whatever is selected, so the coloured half of the picture can be seen changing
            against a backbone that does not. Hover a program to hold its edges on both sides, hover
            an exposure to hold its edges and its badges, and click any coloured edge for the
            Reactome pathways behind it.
          </Typography>
        </>
      )}
    </SectionCard>
  );
}
