import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Chip, Paper, Slider, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import Select from 'react-select';
import SectionCard from '../SectionCard';
import { useKeys, useShard } from '../../lib/useSection';
import {
  ecatColor, prettyCategory, prettyDisease, prettyExposure,
} from '../../lib/palette';

// ---------------------------------------------------------------------------
// The "shared language" network (main Figure 5d), for ANY disease the reader
// picks.
//
// WHAT THE PRINTED FIGURE ARGUES, AND WHY THE LAYOUT IS FIXED
//   fig_m4_shared_network.R draws a tripartite graph read strictly left to
//   right: lifestyle exposures and trials (1) move a shared set of plasma
//   proteins (2), and those proteins split into a MINORITY that is genetically
//   causal for disease and a MAJORITY that are downstream reporters of it (3).
//   The reading order IS the argument. A force-directed layout would rearrange
//   itself on every render, mix the three roles into one blob, and delete the
//   left-to-right narrative -- so the geometry here is hand-placed, exactly as
//   TriadDAG.js hand-places the MR triad, and is a pure function of the data.
//   Same node run in, same picture out.
//
//   The print figure is hardcoded to four cardiometabolic endpoints
//   (build_shared_language_network.R filters to T2D / obesity / lipid disorder
//   / hypertension) and four curated exposure exemplars. The payload built by
//   tools/build_intervention_network.py ships the ingredients for all 44
//   diseases that carry any edge, so the picker below reaches every one of
//   them rather than the four that fit on a printed page.
//
// THE THREE PROTEIN CLASSES, AND WHY THERE ARE THREE AND NOT TWO
//   causal    forward protein->disease MR whose cis instrument clears the
//             Tier-1 gate AND colocalizes. This is the manuscript's causal set.
//   reporter  reverse disease->protein MR only. The record of the disease.
//   forward   a forward protein->disease edge that does NOT clear the Tier-1
//             cis gate -- trans-instrumented, or a cis edge demoted to Tier 2
//             by LD confounding. Calling it causal would smuggle back the
//             LD-confounded cis edges the manuscript explicitly demotes;
//             calling it a reporter would be wrong about the direction of the
//             evidence. It gets its own block, its own color and its own
//             wording, because it is a hedge and has to look like one.
//   Any other `class` value a future rebuild emits is drawn in its own OTHER
//   block rather than being silently dropped.
//
// SCALE
//   Obesity carries 336 proteins and ~9,900 observational edges; T2D 327.
//   Drawing that unfiltered is a hairball, so every view is filtered and the
//   header states how many nodes and edges are shown out of how many exist.
//   Nothing is ever truncated silently. The cap is spent on REPORTERS only --
//   the causal/forward minority is never cut away by it, because that minority
//   is the whole point of the picture.
// ---------------------------------------------------------------------------

// --- encodings, kept in step with fig_m4_shared_network.R -------------------

// Edge color = the direction the edge pushes the node it points at. Same two
// hex values the printed figure uses (`rk` in the plotter).
const SIGN_COLOR = { 1: '#B2182B', '-1': '#2166AC' };
const SIGN_WORD = { 1: 'raises', '-1': 'lowers' };
const NO_SIGN = '#9E9E9E';

// Exposome-R2 fill ramp, matching scale_fill_gradient(low, high) in the plotter.
const R2_LO = [237, 248, 233];
const R2_HI = [27, 120, 55];

const CLASS_ORDER = ['causal', 'forward', 'reporter'];

const CLASS_META = {
  causal: {
    color: '#B2182B',
    header: 'CAUSAL INTERMEDIATES',
    note: 'protein → disease, Tier-1 colocalized cis-pQTL MR',
    long: 'Genetically causal for this disease: a forward protein→disease MR edge whose '
      + 'cis instrument clears the Tier-1 gate and colocalizes (PP.H4 ≥ 0.8). This is the '
      + 'minority the figure exists to isolate.',
  },
  forward: {
    color: '#7B3FA0',
    header: 'FORWARD, BELOW THE CIS GATE',
    note: 'protein → disease, but trans-instrumented or a cis edge demoted by LD confounding',
    long: 'A forward protein→disease MR edge that does NOT clear the Tier-1 cis gate — '
      + 'either trans-instrumented, or a cis edge demoted to Tier 2 by LD confounding. Not '
      + 'called causal (that would readmit the cis edges the manuscript demotes) and not called '
      + 'a reporter (the evidence points forward). Read it as unresolved, not as weak causation.',
  },
  reporter: {
    color: '#546E7A',
    header: 'DISEASE REPORTERS',
    note: 'disease → protein, reverse MR: the protein carries the record of the disease',
    long: 'A reverse disease→protein MR edge only: disease liability moves the protein. '
      + 'A downstream marker, not an intermediate — and the majority class for nearly every '
      + 'disease in the payload.',
  },
};

const classMeta = (c) => CLASS_META[c] || {
  color: '#9E9E9E',
  header: String(c || 'unclassified').toUpperCase(),
  note: 'class value not recognized by this component',
  long: 'This protein carries a `class` value the site does not have wording for. It is drawn '
    + 'in its own block rather than dropped, so a rebuilt payload never loses nodes silently.',
};

// Tier strings the builder emits for a forward edge, in evidence order. The
// first two are what make a protein `causal`; the rest are the hedge.
const COLOC_TIERS = new Set(['colocalized', 'cis (coloc pending)']);

// Trials are drawn in the printed figure's orange; observational exposures take
// their exposure-category color from the shared palette.
const RCT_COLOR = '#CC7722';
const DISEASE_COLOR = '#37474F';

// --- geometry ---------------------------------------------------------------
// Fixed pixel columns. The SVG keeps its natural width and scrolls inside its
// own box on a narrow screen rather than shrinking protein labels to nothing.
const W = 1200;
const M = { top: 52, bottom: 30 };
const X_EXP_LAB = 250;     // right edge of the exposure labels
const X_EXP_OUT = 258;     // where exposure edges leave the left column
const X_PROT = 632;        // protein circle center
const X_DZ = 964;          // disease hub left edge
const DZ_W = 214;

const EXP_PITCH = 24;
const BLOCK_GAP = 26;
const BLOCK_HEAD = 18;

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const r2Fill = (v, max) => {
  if (v === null || !(max > 0)) return '#E8E8E8';
  const t = clamp(v / max, 0, 1);
  const c = R2_LO.map((lo, i) => Math.round(lo + (R2_HI[i] - lo) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

const fmtP = (v) => {
  if (v === null) return '—';
  if (v === 0) return '< 1e-300';
  return Number(v).toPrecision(2);
};

const fmtW = (v) => (v === null ? '—' : Math.abs(v).toFixed(3));

// Greedy word wrap; SVG has no text flow of its own (same helper as TriadDAG).
function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; } else { cur = next; }
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[ ,;]+$/, '')}…`;
  }
  return lines;
}

const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

// Diseases the picker prefers to open on, best first. T2D is the richest
// network that is also one of the four the printed figure draws, so the reader
// arrives at a picture they can check against the paper. Verified against the
// payload key list rather than assumed -- if the keys are renamed the picker
// falls back to the first key instead of showing an empty panel.
const DEFAULT_KEYS = [
  'finngen_R12_T2D', 'finngen_R12_E4_OBESITY', 'finngen_R12_T2D_WIDE',
];

// The builder's own bar for "worth drawing" (MIN_PROTEINS / MIN_GENETIC_EDGES in
// tools/build_intervention_network.py). Thin diseases stay in the payload on
// purpose, so the panel says a network is thin instead of pretending it is not.
const MIN_PROTEINS = 5;
const MIN_GENETIC_EDGES = 8;

// Above this many drawn lines the picture stops being a network and starts
// being a texture. It is still drawn -- the reader asked for it -- but with a
// nudge toward the filters that make it legible again.
const HAIRBALL = 2500;

const CAP_PROT = [20, 40, 80, 0];   // 0 = no cap
const CAP_EXP = [6, 12, 24, 0];
const capLabel = (v) => (v === 0 ? 'all' : String(v));

const SUPPORTS = [
  ['any', 'any'],
  ['Both', 'both panels'],
  ['UKB only', 'UKB only'],
  ['DECODE only', 'deCODE only'],
];

const GEN_FILTERS = [
  ['all', 'all forward edges'],
  ['coloc', 'colocalized cis only'],
  ['cis', 'cis-instrumented only'],
];

const TYPE_BUTTONS = [
  ['obs', 'lifestyle'],
  ['interv', 'trial'],
  ['gen_fwd', 'forward'],
  ['gen_rev', 'reverse'],
];

// Labels for the disease picker. The authoritative, readable disease label
// lives INSIDE each shard (the `disease` node's label), so it is unknown until
// that shard has been fetched. Rather than firing 44 requests to populate a
// dropdown, the picker shows the prettified FinnGen code and upgrades an entry
// to its real label once that disease has been looked at in this session.
const labelCache = new Map();

function Ctl({ label, grow, children }) {
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
      flex: grow ? '1 1 260px' : '0 0 auto',
      minWidth: 0,
    }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, lineHeight: 1.1 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default function InterventionNetwork() {
  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('intervention_network_nodes');

  const [disease, setDisease] = useState(null);
  const [protCap, setProtCap] = useState(40);
  const [expCap, setExpCap] = useState(12);
  const [minBreadth, setMinBreadth] = useState(0);
  const [types, setTypes] = useState(['obs', 'interv', 'gen_fwd', 'gen_rev']);
  const [genFilter, setGenFilter] = useState('all');
  const [support, setSupport] = useState('any');
  const [focus, setFocus] = useState(null);
  const [hover, setHover] = useState(null);

  const boxRef = useRef(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const { data: nodes, loading: nLoading, error: nError } = useShard('intervention_network_nodes', disease);
  const { data: edges, loading: eLoading, error: eError } = useShard('intervention_network_edges', disease);

  const keys = useMemo(
    () => (keyIndex?.keys ? Object.keys(keyIndex.keys) : []),
    [keyIndex],
  );

  // Open on the richest network available rather than whatever sorts first.
  useEffect(() => {
    if (disease || !keys.length) return;
    setDisease(DEFAULT_KEYS.find((k) => keys.includes(k)) || keys[0]);
  }, [keys, disease]);

  // A breadth floor tuned on one disease is meaningless on the next (breadth
  // tops out at 97 for T2D and at 3 for some of the thin endpoints), so it
  // resets with the disease instead of silently emptying the new network.
  useEffect(() => {
    setMinBreadth(0);
    setFocus(null);
    setHover(null);
  }, [disease]);

  // --- parse the two shards into node/edge records --------------------------
  // Columnar: data.id[i] is row i. The shard key column (`disease`) is not
  // repeated inside the shard, so nothing here reads it.
  const parsed = useMemo(() => {
    if (!nodes?.id || !edges?.from) return null;

    const proteins = new Map();
    const expObs = new Map();
    const rcts = [];
    let dzLabel = null;
    let icd = '';

    for (let i = 0; i < nodes.id.length; i += 1) {
      const kind = nodes.kind[i];
      const id = nodes.id[i];
      if (kind === 'protein') {
        proteins.set(id, {
          id,
          label: nodes.label[i] || id,
          cls: nodes.class[i] || '',
          breadth: num(nodes.breadth?.[i]) || 0,
          breadthEid: num(nodes.breadth_eid?.[i]),
          r2: num(nodes.R2_E?.[i]),
        });
      } else if (kind === 'exp_obs') {
        expObs.set(id, {
          id,
          label: nodes.label[i] || prettyExposure(id),
          category: nodes.category?.[i] || 'Other',
        });
      } else if (kind === 'exp_rct') {
        rcts.push({ id, label: nodes.label[i] || id });
      } else if (kind === 'disease') {
        dzLabel = nodes.label[i] || null;
        icd = nodes.category?.[i] || '';
      }
    }

    const all = { obs: [], interv: [], gen_fwd: [], gen_rev: [] };
    for (let i = 0; i < edges.from.length; i += 1) {
      const etype = edges.etype[i];
      if (!all[etype]) continue;
      const gen = etype === 'gen_fwd' || etype === 'gen_rev';
      all[etype].push({
        i,
        etype,
        from: edges.from[i],
        to: edges.to[i],
        // A genetic edge hangs off the protein whichever way it points; every
        // other column below is about that protein's evidence.
        protein: etype === 'gen_rev' ? edges.to[i] : edges.from[i],
        tier: edges.tier?.[i] || '',
        sign: num(edges.sign?.[i]),
        weight: num(edges.weight?.[i]),
        edgeClass: edges.edge_class?.[i] || '',
        support: edges.mr_support?.[i] || '',
        padj: gen ? num(edges.padj_edge?.[i]) : null,
        nExp: gen ? num(edges.n_exposures?.[i]) : null,
        term: edges.term?.[i] || '',
      });
    }

    if (dzLabel) labelCache.set(disease, dzLabel);

    return { proteins, expObs, rcts, all, dzLabel, icd };
  }, [nodes, edges, disease]);

  // --- filter, order and lay out -------------------------------------------
  const view = useMemo(() => {
    if (!parsed) return null;
    const { proteins, expObs, rcts, all } = parsed;

    const on = new Set(types);
    const supportOk = (e) => support === 'any' || e.support === support;
    const forwardOk = (e) => {
      if (genFilter === 'coloc') return COLOC_TIERS.has(e.tier);
      if (genFilter === 'cis') return e.edgeClass === 'cis';
      return true;
    };

    // 1. genetic edges first: they decide which proteins are worth a row.
    const genFwd = on.has('gen_fwd')
      ? all.gen_fwd.filter((e) => supportOk(e) && forwardOk(e)) : [];
    // The forward-evidence filter is about forward edges; applying it to the
    // reverse ones would quietly delete the reporter half of the picture,
    // which is the half the paper says is the majority.
    const genRev = on.has('gen_rev') ? all.gen_rev.filter(supportOk) : [];

    const byProtein = new Map();
    const touch = (pid, key, e) => {
      if (!proteins.has(pid)) return;
      if (!byProtein.has(pid)) {
        byProtein.set(pid, { fwd: [], rev: [], obs: [], interv: [] });
      }
      byProtein.get(pid)[key].push(e);
    };
    genFwd.forEach((e) => touch(e.protein, 'fwd', e));
    genRev.forEach((e) => touch(e.protein, 'rev', e));
    if (on.has('obs')) all.obs.forEach((e) => touch(e.to, 'obs', e));
    if (on.has('interv')) all.interv.forEach((e) => touch(e.to, 'interv', e));

    // 2. protein-level filters. The breadth floor is applied to every class,
    // including causal -- it is an explicit instruction from the reader, so it
    // is obeyed; the header then says how many causal/forward proteins it hid,
    // which is the honest version of quietly exempting them.
    const eligible = [...proteins.values()].filter((p) => {
      const b = byProtein.get(p.id);
      return p.breadth >= minBreadth && b
        && (b.fwd.length || b.rev.length || b.obs.length || b.interv.length);
    });
    const hiddenMinority = [...proteins.values()]
      .filter((p) => p.cls !== 'reporter' && p.breadth < minBreadth).length;

    // 3. rank inside each class by breadth (how many exposures read the
    // protein) and cap the REPORTER block only. Capping the causal block would
    // cut away the minority the panel exists to show.
    const rank = (a, b) => b.breadth - a.breadth || a.label.localeCompare(b.label);
    const classes = [];
    const seenClasses = [...new Set(eligible.map((p) => p.cls))]
      .sort((a, b) => {
        const ia = CLASS_ORDER.indexOf(a);
        const ib = CLASS_ORDER.indexOf(b);
        return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
      });
    let cappedAway = 0;
    seenClasses.forEach((cls) => {
      const items = eligible.filter((p) => p.cls === cls).sort(rank);
      const capped = (cls === 'reporter' && protCap > 0 && items.length > protCap)
        ? items.slice(0, protCap) : items;
      cappedAway += items.length - capped.length;
      classes.push({ cls, items: capped, nEligible: items.length });
    });

    const kept = new Map();
    classes.forEach((c) => c.items.forEach((p) => kept.set(p.id, p)));

    // 4. exposures, ranked by how many DRAWN proteins each one reaches. That is
    // a property of the current view, so the left column re-ranks when the
    // protein filters move -- which is what makes the cap meaningful.
    const obsEdges = on.has('obs') ? all.obs.filter((e) => kept.has(e.to)) : [];
    const reach = new Map();
    obsEdges.forEach((e) => reach.set(e.from, (reach.get(e.from) || 0) + 1));
    const expRanked = [...reach.entries()]
      .map(([id, n]) => ({ ...(expObs.get(id) || { id, label: prettyExposure(id), category: 'Other' }), n }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
    const expKept = expCap > 0 ? expRanked.slice(0, expCap) : expRanked;
    const expSet = new Set(expKept.map((e) => e.id));

    const drawnObs = obsEdges.filter((e) => expSet.has(e.from));
    // Trials are never subject to the exposure cap: there are at most two of
    // them and the observational/interventional contrast is the panel's spine.
    const rctKept = on.has('interv')
      ? rcts.filter((r) => all.interv.some((e) => e.from === r.id && kept.has(e.to)))
      : [];
    const rctSet = new Set(rctKept.map((r) => r.id));
    const drawnInterv = on.has('interv')
      ? all.interv.filter((e) => kept.has(e.to) && rctSet.has(e.from)) : [];
    const drawnFwd = genFwd.filter((e) => kept.has(e.protein));
    const drawnRev = genRev.filter((e) => kept.has(e.protein));

    // --- geometry ---------------------------------------------------------
    const nProt = kept.size;
    const pitch = nProt <= 45 ? 18 : (nProt <= 90 ? 14 : 11.5);
    const rMax = Math.min(8, pitch * 0.42);
    const maxBreadth = Math.max(1, ...[...kept.values()].map((p) => p.breadth));
    const maxR2 = Math.max(0.0001, ...[...kept.values()].map((p) => p.r2 || 0));

    let y = 0;
    const blocks = [];
    classes.forEach((c) => {
      if (!c.items.length) return;
      const y0 = y;
      y += BLOCK_HEAD;
      c.items.forEach((p) => {
        p.y = y;
        p.r = 2.5 + rMax * Math.sqrt(p.breadth / maxBreadth);
        p.fill = r2Fill(p.r2, maxR2);
        y += pitch;
      });
      blocks.push({ cls: c.cls, y0, y1: y, n: c.items.length, nEligible: c.nEligible });
      y += BLOCK_GAP;
    });
    const protH = Math.max(0, y - BLOCK_GAP);

    let ey = 0;
    expKept.forEach((e) => { e.y = ey; ey += EXP_PITCH; });
    if (rctKept.length) ey += 18;              // gap before the interventional block
    rctKept.forEach((r) => { r.y = ey; ey += EXP_PITCH; });
    const expH = ey;

    const innerH = Math.max(protH, expH, 300);
    const H = innerH + M.top + M.bottom;
    const protOff = M.top + (innerH - protH) / 2;
    const expOff = M.top + (innerH - expH) / 2;
    [...kept.values()].forEach((p) => { p.sy = protOff + p.y + 8; });
    expKept.forEach((e) => { e.sy = expOff + e.y + 8; });
    rctKept.forEach((r) => { r.sy = expOff + r.y + 8; });
    blocks.forEach((b) => { b.sy0 = protOff + b.y0; b.sy1 = protOff + b.y1; });

    // The disease hub. Forward arrows land on the upper half of its left edge
    // and reverse arrows leave from the lower half, spread by the target's rank
    // so hundreds of reporter edges read as a fan rather than one thick line.
    // That banding is the single-hub version of the printed figure's "causes
    // feed in, markers branch out".
    const dzLines = wrap(parsed.dzLabel || prettyDisease(disease), 24, 4);
    const dzH = Math.max(96, 30 + dzLines.length * 16);
    const dzTop = M.top + innerH / 2 - dzH / 2;
    const dzMid = dzTop + dzH / 2;
    const band = (rankIdx, n, lo, hi) => (n <= 1 ? (lo + hi) / 2
      : lo + ((hi - lo) * rankIdx) / (n - 1));

    // Ordered by the protein's own row so the fan is monotone: taking the
    // edge list's order instead would braid hundreds of reporter lines over
    // each other for no reason.
    const byRow = (a, b) => kept.get(a).y - kept.get(b).y;
    const fwdOrder = [...new Set(drawnFwd.map((e) => e.protein))].sort(byRow);
    const revOrder = [...new Set(drawnRev.map((e) => e.protein))].sort(byRow);
    const fwdAt = new Map(fwdOrder.map((p, i) => [p, band(i, fwdOrder.length, dzTop + 10, dzMid - 6)]));
    const revAt = new Map(revOrder.map((p, i) => [p, band(i, revOrder.length, dzMid + 6, dzTop + dzH - 10)]));

    return {
      kept,
      blocks,
      expKept,
      rctKept,
      // Edge rendering resolves its endpoints by id; with up to ~10k
      // observational edges a linear .find() per edge is the difference
      // between a responsive panel and a locked tab.
      expById: new Map(expKept.map((e) => [e.id, e])),
      rctById: new Map(rctKept.map((r) => [r.id, r])),
      drawnObs,
      drawnInterv,
      drawnFwd,
      drawnRev,
      fwdAt,
      revAt,
      dzLines,
      dzTop,
      dzH,
      H,
      maxR2,
      maxBreadth,
      hiddenMinority,
      cappedAway,
      counts: {
        proteins: [kept.size, parsed.proteins.size],
        exposures: [expKept.length, parsed.expObs.size],
        obs: [drawnObs.length, all.obs.length],
        interv: [drawnInterv.length, all.interv.length],
        gen_fwd: [drawnFwd.length, all.gen_fwd.length],
        gen_rev: [drawnRev.length, all.gen_rev.length],
      },
      breadthCeiling: Math.max(1, ...[...parsed.proteins.values()].map((p) => p.breadth)),
      nGenTotal: all.gen_fwd.length + all.gen_rev.length,
    };
  }, [parsed, types, genFilter, support, minBreadth, protCap, expCap, disease]);

  // --- highlighting ---------------------------------------------------------
  // One id drives both hover and click-to-focus. A focus that no longer exists
  // in the current view (because a filter moved) is treated as no focus, so the
  // graph can never be left permanently dimmed around an invisible node.
  const activeId = hover?.nodeId
    || (view && focus && view.kept.has(focus) ? focus : null);

  const neighbours = useMemo(() => {
    if (!view || !activeId) return null;
    const s = new Set([activeId]);
    const add = (e, a, b) => { if (e.from === activeId) s.add(b); if (e.to === activeId) s.add(a); };
    view.drawnObs.forEach((e) => add(e, e.from, e.to));
    view.drawnInterv.forEach((e) => add(e, e.from, e.to));
    view.drawnFwd.forEach((e) => add(e, e.from, e.to));
    view.drawnRev.forEach((e) => add(e, e.from, e.to));
    return s;
  }, [view, activeId]);

  const lit = (a, b) => !neighbours || neighbours.has(a) || neighbours.has(b);
  const nodeLit = (id) => !neighbours || neighbours.has(id);

  const options = useMemo(() => keys.map((k) => ({
    value: k,
    label: labelCache.get(k) || prettyDisease(k),
  })), [keys]);

  // Cursor position is kept in the OUTER box's coordinates, which do not scroll,
  // so the card follows the mouse even when the SVG is scrolled sideways. `bw`
  // is the box width, carried along so the card can be kept on screen without
  // measuring the DOM again on every frame.
  const onMove = (ev) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r) setHover((h) => (h ? { ...h, px: ev.clientX - r.left, py: ev.clientY - r.top } : h));
  };
  const enter = (payload) => (ev) => {
    const r = boxRef.current?.getBoundingClientRect();
    setHover({
      ...payload,
      px: r ? ev.clientX - r.left : 0,
      py: r ? ev.clientY - r.top : 0,
      bw: r ? r.width : W,
    });
  };
  const leave = () => setHover(null);

  if (kLoading) return <Typography variant="body2">Loading the disease list…</Typography>;
  if (kError) return <Alert severity="error">Could not load the network key index: {String(kError.message || kError)}</Alert>;

  const shardLoading = nLoading || eLoading;
  const shardError = nError || eError;
  const dzName = parsed?.dzLabel || prettyDisease(disease || '');
  const drawnEdges = view
    ? view.drawnObs.length + view.drawnInterv.length + view.drawnFwd.length + view.drawnRev.length
    : 0;
  const focused = view && focus && view.kept.has(focus) ? view.kept.get(focus) : null;

  return (
    <SectionCard
      title="The shared language, for any disease"
      subtitle={
        'Lifestyle exposures and trials move a shared set of plasma proteins, which split '
            + 'into a minority genetically causal for the disease and a majority that merely '
            + 'reports it. Any of the 44 diseases in the payload — Figure 5d shows four.'
      }
    >
      {/* --- controls ------------------------------------------------------ */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'flex-end', mb: 1.5 }}>
        <Ctl label="Disease" grow>
          <Select
            options={options}
            value={options.find((o) => o.value === disease) || null}
            onChange={(o) => setDisease(o.value)}
            isSearchable
            placeholder="Search a disease…"
            menuPortalTarget={null}
            styles={{ menu: (b) => ({ ...b, zIndex: 20 }) }}
          />
        </Ctl>

        <Ctl label="Reporters drawn">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={protCap}
            onChange={(_, v) => v !== null && setProtCap(v)}
          >
            {CAP_PROT.map((v) => (
              <ToggleButton key={v} value={v} sx={{ textTransform: 'none', px: 1.3 }}>
                {capLabel(v)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Ctl>

        <Ctl label="Exposures drawn">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={expCap}
            onChange={(_, v) => v !== null && setExpCap(v)}
          >
            {CAP_EXP.map((v) => (
              <ToggleButton key={v} value={v} sx={{ textTransform: 'none', px: 1.3 }}>
                {capLabel(v)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Ctl>

        <Ctl label="Edges">
          <ToggleButtonGroup
            size="small"
            value={types}
            onChange={(_, v) => v.length && setTypes(v)}
          >
            {TYPE_BUTTONS.map(([v, lab]) => (
              <ToggleButton key={v} value={v} sx={{ textTransform: 'none', px: 1.2 }}>
                {lab}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Ctl>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'flex-end', mb: 2 }}>
        <Ctl label={`Minimum breadth — exposures the protein responds to (≥ ${minBreadth})`} grow>
          <Slider
            size="small"
            value={minBreadth}
            min={0}
            max={view?.breadthCeiling || 1}
            onChange={(_, v) => setMinBreadth(v)}
            valueLabelDisplay="auto"
            sx={{ mx: 1, width: 'calc(100% - 16px)' }}
          />
        </Ctl>

        <Ctl label="Forward evidence">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={genFilter}
            onChange={(_, v) => v && setGenFilter(v)}
          >
            {GEN_FILTERS.map(([v, lab]) => (
              <ToggleButton key={v} value={v} sx={{ textTransform: 'none', px: 1.2 }}>
                {lab}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Ctl>

        <Ctl label="pQTL platform support">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={support}
            onChange={(_, v) => v && setSupport(v)}
          >
            {SUPPORTS.map(([v, lab]) => (
              <ToggleButton key={v} value={v} sx={{ textTransform: 'none', px: 1.2 }}>
                {lab}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Ctl>
      </Box>

      {shardLoading && <Typography variant="body2">Loading {dzName}…</Typography>}
      {shardError && (
        <Alert severity="error">
          Could not load the network for {dzName}: {String(shardError.message || shardError)}
        </Alert>
      )}

      {/* --- what is on screen, out of what exists ------------------------- */}
      {view && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
          <Chip
            size="small"
            label={`${view.counts.proteins[0]} of ${view.counts.proteins[1]} proteins`}
            color={view.counts.proteins[0] < view.counts.proteins[1] ? 'warning' : 'default'}
            variant={view.counts.proteins[0] < view.counts.proteins[1] ? 'filled' : 'outlined'}
          />
          <Chip size="small" variant="outlined" label={`${view.counts.exposures[0]} of ${view.counts.exposures[1]} exposures`} />
          <Chip size="small" variant="outlined" label={`${drawnEdges} of ${view.counts.obs[1] + view.counts.interv[1] + view.nGenTotal} edges`} />
          <Chip size="small" variant="outlined" label={`lifestyle ${view.counts.obs[0]}/${view.counts.obs[1]}`} />
          <Chip size="small" variant="outlined" label={`trial ${view.counts.interv[0]}/${view.counts.interv[1]}`} />
          <Chip
            size="small"
            sx={{ borderColor: CLASS_META.causal.color, color: CLASS_META.causal.color }}
            variant="outlined"
            label={`forward ${view.counts.gen_fwd[0]}/${view.counts.gen_fwd[1]}`}
          />
          <Chip
            size="small"
            sx={{ borderColor: CLASS_META.reporter.color, color: CLASS_META.reporter.color }}
            variant="outlined"
            label={`reverse ${view.counts.gen_rev[0]}/${view.counts.gen_rev[1]}`}
          />
        </Box>
      )}

      {view && view.counts.proteins[1] < MIN_PROTEINS && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          <b>{dzName}</b> carries only {view.counts.proteins[1]} protein
          {view.counts.proteins[1] === 1 ? '' : 's'} and {view.nGenTotal} genetic edges — below the
          bar the payload builder uses for a drawable network ({MIN_PROTEINS} proteins,{' '}
          {MIN_GENETIC_EDGES} genetic edges). It is kept here rather than hidden, but read it as a
          handful of edges, not as a network.
        </Alert>
      )}
      {view && view.counts.proteins[1] >= MIN_PROTEINS && view.nGenTotal < MIN_GENETIC_EDGES && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          <b>{dzName}</b> has {view.nGenTotal} genetic edges in total, below the {MIN_GENETIC_EDGES}
          {' '}the builder treats as drawable. The lifestyle half of the picture is complete; the
          causal/reporter split rests on very little.
        </Alert>
      )}
      {view && view.cappedAway > 0 && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {view.cappedAway} further reporter{view.cappedAway === 1 ? ' is' : 's are'} not drawn: the
          cap keeps the {view.counts.proteins[0]} proteins that respond to the most exposures. Causal
          and forward proteins are never cut by the cap — raise &ldquo;reporters drawn&rdquo; to see the rest.
        </Alert>
      )}
      {view && view.hiddenMinority > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The breadth floor is hiding {view.hiddenMinority} causal/forward protein
          {view.hiddenMinority === 1 ? '' : 's'}. Those are the minority this panel exists to show —
          lower the slider to bring them back.
        </Alert>
      )}
      {view && view.counts.proteins[0] === 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          No protein survives the current filters, so only the disease hub is drawn.{' '}
          <b>{dzName}</b> has {view.counts.proteins[1]} protein
          {view.counts.proteins[1] === 1 ? '' : 's'} in the payload — lower the breadth floor or
          widen the forward-evidence and platform filters.
        </Alert>
      )}
      {drawnEdges > HAIRBALL && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {drawnEdges.toLocaleString()} lines are drawn. Everything asked for is on screen, but at this
          density the picture reads as texture rather than as a network — raise the breadth floor or
          lower the exposure cap to get the argument back.
        </Alert>
      )}

      {/* --- the network --------------------------------------------------- */}
      {view && (
        <Box ref={boxRef} sx={{ position: 'relative' }} onMouseMove={onMove}>
          <Box sx={{
            width: '100%',
            overflow: 'auto',
            maxHeight: 780,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: '#fff',
          }}
          >
            <svg
              viewBox={`0 0 ${W} ${view.H}`}
              width={W}
              height={view.H}
              role="img"
              aria-label={
                `Left-to-right network for ${dzName}: ${view.counts.exposures[0]} exposures and `
                + `${view.rctKept.length} trials on the left, ${view.counts.proteins[0]} plasma proteins `
                + 'in the middle split into causal intermediates and disease reporters, and the disease '
                + 'as a hub on the right'
              }
              style={{ display: 'block', minWidth: W, background: '#fff' }}
            >
              <defs>
                {Object.entries(SIGN_COLOR).map(([k, c]) => (
                  <marker
                    key={k}
                    id={`${uid}-ar-${k === '1' ? 'up' : 'dn'}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                  </marker>
                ))}
                <linearGradient id={`${uid}-r2`} x1="0" x2="1">
                  <stop offset="0" stopColor={`rgb(${R2_LO.join(',')})`} />
                  <stop offset="1" stopColor={`rgb(${R2_HI.join(',')})`} />
                </linearGradient>
              </defs>

              {/* flow header, straight from the printed figure */}
              <g fontSize="12" fontWeight="700" fill="#616161">
                <text x={X_EXP_LAB} y={24} textAnchor="end">1.  lifestyle &amp; trials</text>
                <text x={X_PROT} y={24} textAnchor="middle">2.  shared proteins</text>
                <text x={X_DZ + DZ_W / 2} y={24} textAnchor="middle">3.  disease</text>
                <line x1={X_EXP_LAB + 16} y1={20} x2={X_PROT - 96} y2={20} stroke="#BDBDBD" strokeWidth="1.2" />
                <line x1={X_PROT + 96} y1={20} x2={X_DZ - 12} y2={20} stroke="#BDBDBD" strokeWidth="1.2" />
              </g>

              {/* observational exposure -> protein: thin, faint, colored by
                  direction. No mouse handlers: there can be thousands of these
                  and per-element listeners are what would make hover crawl. The
                  native <title> still answers "what is this line?". */}
              <g>
                {view.drawnObs.map((e) => {
                  const p = view.kept.get(e.to);
                  const s = view.expById.get(e.from);
                  if (!p || !s) return null;
                  const show = lit(e.from, e.to);
                  return (
                    <line
                      key={`o${e.i}`}
                      x1={X_EXP_OUT}
                      y1={s.sy}
                      x2={X_PROT - p.r - 2}
                      y2={p.sy}
                      stroke={SIGN_COLOR[e.sign] || NO_SIGN}
                      strokeWidth={0.6}
                      opacity={show ? 0.30 : 0.03}
                    >
                      <title>
                        {`${s.label} → ${p.label}: ${SIGN_WORD[e.sign] || 'moves'} it, `
                          + `|β| = ${fmtW(e.weight)}${e.term && e.term !== e.from ? ` (term: ${e.term})` : ''}`}
                      </title>
                    </line>
                  );
                })}
              </g>

              {/* trial -> protein: the same geometry drawn bold, because a
                  randomized shift and an observational association are not the
                  same evidence and must not look alike. */}
              <g>
                {view.drawnInterv.map((e) => {
                  const p = view.kept.get(e.to);
                  const s = view.rctById.get(e.from);
                  if (!p || !s) return null;
                  const show = lit(e.from, e.to);
                  return (
                    <line
                      key={`v${e.i}`}
                      x1={X_EXP_OUT}
                      y1={s.sy}
                      x2={X_PROT - p.r - 2}
                      y2={p.sy}
                      stroke={SIGN_COLOR[e.sign] || NO_SIGN}
                      strokeWidth={1.5}
                      opacity={show ? 0.8 : 0.05}
                    >
                      <title>
                        {`${s.label} → ${p.label}: ${SIGN_WORD[e.sign] || 'moves'} it, `
                          + `|effect| = ${fmtW(e.weight)}`}
                      </title>
                    </line>
                  );
                })}
              </g>

              {/* disease -> protein (reverse MR). Drawn before the forward
                  edges so the causal minority sits on top of the reporter
                  majority, exactly as the printed figure layers them. A reverse
                  edge landing on a causal/forward protein is drawn very faint:
                  those proteins are broad disease markers too, and the printed
                  figure makes the same point with its `gen_rev_causal` layer. */}
              <g>
                {view.drawnRev.map((e) => {
                  const p = view.kept.get(e.protein);
                  if (!p) return null;
                  const onMinority = p.cls !== 'reporter';
                  const show = lit(e.from, e.to);
                  return (
                    <line
                      key={`r${e.i}`}
                      x1={X_DZ - 4}
                      y1={view.revAt.get(e.protein)}
                      x2={X_PROT + p.r + 4}
                      y2={p.sy}
                      stroke={SIGN_COLOR[e.sign] || NO_SIGN}
                      strokeWidth={onMinority ? 0.7 : 1.05}
                      strokeDasharray="1.5 3"
                      markerEnd={`url(#${uid}-ar-${e.sign > 0 ? 'up' : 'dn'})`}
                      opacity={show ? (onMinority ? 0.22 : 0.6) : 0.04}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={enter({ edge: e, protein: p })}
                      onMouseLeave={leave}
                    >
                      <title>{`${dzName} → ${p.label} (reverse MR)`}</title>
                    </line>
                  );
                })}
              </g>

              {/* protein -> disease (forward MR). Solid when the cis instrument
                  colocalizes (the causal set), dashed otherwise (the hedge). */}
              <g>
                {view.drawnFwd.map((e) => {
                  const p = view.kept.get(e.protein);
                  if (!p) return null;
                  const coloc = COLOC_TIERS.has(e.tier);
                  const show = lit(e.from, e.to);
                  return (
                    <line
                      key={`f${e.i}`}
                      x1={X_PROT + p.r + 4}
                      y1={p.sy}
                      x2={X_DZ - 4}
                      y2={view.fwdAt.get(e.protein)}
                      stroke={SIGN_COLOR[e.sign] || NO_SIGN}
                      strokeWidth={coloc ? 2.1 : 1.35}
                      strokeDasharray={coloc ? undefined : '5 3.5'}
                      markerEnd={`url(#${uid}-ar-${e.sign > 0 ? 'up' : 'dn'})`}
                      opacity={show ? 0.95 : 0.05}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={enter({ edge: e, protein: p })}
                      onMouseLeave={leave}
                    >
                      <title>{`${p.label} → ${dzName} (${e.tier || 'forward MR'})`}</title>
                    </line>
                  );
                })}
              </g>

              {/* class block headers + a rule marking where one block ends */}
              {view.blocks.map((b, i) => {
                const meta = classMeta(b.cls);
                return (
                  <g key={b.cls}>
                    {i > 0 && (
                      <line
                        x1={X_PROT - 150} y1={b.sy0 - BLOCK_GAP / 2}
                        x2={X_PROT + 260} y2={b.sy0 - BLOCK_GAP / 2}
                        stroke="#E0E0E0" strokeWidth="1" strokeDasharray="3 3"
                      />
                    )}
                    <text
                      x={X_PROT - 6} y={b.sy0 + 11}
                      textAnchor="end" fontSize="10.5" fontWeight="700"
                      fill={meta.color} letterSpacing="0.4"
                    >
                      {meta.header}
                    </text>
                    <text
                      x={X_PROT + 6} y={b.sy0 + 11}
                      fontSize="9.5" fill="#8A8A8A"
                    >
                      {`${b.n}${b.n < b.nEligible ? ` of ${b.nEligible}` : ''} · ${meta.note}`}
                    </text>
                  </g>
                );
              })}

              {/* exposure column: observational on top, trials below a gap */}
              {view.expKept.map((e) => {
                const c = ecatColor(e.category);
                const show = nodeLit(e.id);
                return (
                  <g
                    key={e.id}
                    opacity={show ? 1 : 0.2}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={enter({ nodeId: e.id, exposure: e })}
                    onMouseLeave={leave}
                  >
                    <rect
                      x={X_EXP_LAB - 200} y={e.sy - 9} width={200} height={18} rx={3}
                      fill={c} opacity={0.92}
                    />
                    <text
                      x={X_EXP_LAB - 7} y={e.sy + 4}
                      textAnchor="end" fontSize="10.5" fontWeight="600" fill="#fff"
                    >
                      {truncate(e.label, 30)}
                    </text>
                    <title>{`${e.label} — ${prettyCategory(e.category)}; moves ${e.n} of the drawn proteins`}</title>
                  </g>
                );
              })}
              {view.rctKept.map((r) => {
                const show = nodeLit(r.id);
                return (
                  <g
                    key={r.id}
                    opacity={show ? 1 : 0.2}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={enter({ nodeId: r.id, rct: r })}
                    onMouseLeave={leave}
                  >
                    <rect
                      x={X_EXP_LAB - 200} y={r.sy - 9} width={200} height={18} rx={3}
                      fill={RCT_COLOR}
                    />
                    <text
                      x={X_EXP_LAB - 7} y={r.sy + 4}
                      textAnchor="end" fontSize="10.5" fontWeight="700" fill="#fff"
                    >
                      {r.label}
                    </text>
                    <title>{`${r.label} — randomized intervention`}</title>
                  </g>
                );
              })}
              {view.rctKept.length > 0 && (
                <text
                  x={X_EXP_LAB} y={view.rctKept[0].sy - 16}
                  textAnchor="end" fontSize="9.5" fontWeight="700" fill={RCT_COLOR}
                >
                  INTERVENTIONAL (trials)
                </text>
              )}
              {view.expKept.length > 0 && (
                <text
                  x={X_EXP_LAB} y={view.expKept[0].sy - 16}
                  textAnchor="end" fontSize="9.5" fontWeight="700" fill="#607D8B"
                >
                  OBSERVATIONAL (lifestyle)
                </text>
              )}

              {/* proteins: ring = class, fill = exposome R2, radius = breadth */}
              {[...view.kept.values()].map((p) => {
                const meta = classMeta(p.cls);
                const show = nodeLit(p.id);
                const isFocus = focus === p.id;
                return (
                  <g
                    key={p.id}
                    opacity={show ? 1 : 0.16}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={enter({ nodeId: p.id, protein: p })}
                    onMouseLeave={leave}
                    onClick={() => setFocus((f) => (f === p.id ? null : p.id))}
                  >
                    <circle
                      cx={X_PROT} cy={p.sy} r={p.r}
                      fill={p.fill} stroke={meta.color} strokeWidth={isFocus ? 2.2 : 1.1}
                    />
                    <text
                      x={X_PROT + p.r + 5} y={p.sy + 3.2}
                      fontSize="10" fontWeight={p.cls === 'reporter' ? 400 : 700}
                      fill={p.cls === 'reporter' ? '#37474F' : meta.color}
                      stroke="#fff" strokeWidth="2.6" paintOrder="stroke"
                    >
                      {p.label}
                    </text>
                    <title>
                      {`${p.label} — ${meta.header.toLowerCase()}; responds to ${p.breadth} exposures`}
                    </title>
                  </g>
                );
              })}

              {/* the disease hub */}
              <g
                style={{ cursor: 'pointer' }}
                onMouseEnter={enter({ nodeId: disease, hub: true })}
                onMouseLeave={leave}
                opacity={nodeLit(disease) ? 1 : 0.25}
              >
                <rect
                  x={X_DZ} y={view.dzTop} width={DZ_W} height={view.dzH} rx={6}
                  fill={DISEASE_COLOR}
                />
                {view.dzLines.map((ln, i) => (
                  <text
                    key={ln}
                    x={X_DZ + DZ_W / 2}
                    y={view.dzTop + view.dzH / 2 - ((view.dzLines.length - 1) * 8) + i * 16 + 4}
                    textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff"
                  >
                    {ln}
                  </text>
                ))}
                <title>{`${dzName} (${disease})`}</title>
              </g>
            </svg>
          </Box>

          {/* hover card: nodes and genetic edges only. Observational lines are
              answered by their native <title> instead, so a view with thousands
              of them does not carry thousands of React listeners. */}
          {hover && (
            <Paper
              elevation={6}
              sx={{
                position: 'absolute',
                left: clamp(hover.px, 185, Math.max(185, (hover.bw || W) - 185)),
                top: hover.py,
                transform: hover.py < 200 ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 14px))',
                p: 1.25,
                minWidth: 250,
                maxWidth: 360,
                pointerEvents: 'none',
                zIndex: 6,
                borderLeft: `4px solid ${
                  hover.protein ? classMeta(hover.protein.cls).color
                    : (hover.exposure ? ecatColor(hover.exposure.category)
                      : (hover.hub ? DISEASE_COLOR : RCT_COLOR))
                }`,
              }}
            >
              {hover.edge && (() => {
                const e = hover.edge;
                const fwd = e.etype === 'gen_fwd';
                return (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {fwd ? `${hover.protein.label} → ${dzName}` : `${dzName} → ${hover.protein.label}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      {fwd
                        ? 'forward MR: the protein moves disease risk'
                        : 'reverse MR: disease liability moves the protein'}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {`evidence: ${e.tier || '—'}`}
                      {e.edgeClass ? ` (${e.edgeClass}-pQTL)` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {`|β| = ${fmtW(e.weight)}, ${SIGN_WORD[e.sign] || 'direction unknown'} · FDR q = ${fmtP(e.padj)}`}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {`pQTL support: ${e.support || '—'}`}
                      {e.nExp !== null ? ` · carried by ${e.nExp} exposures` : ''}
                    </Typography>
                    {fwd && !COLOC_TIERS.has(e.tier) && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: CLASS_META.forward.color }}>
                        Below the Tier-1 cis gate — drawn dashed, and not counted as causal.
                      </Typography>
                    )}
                  </>
                );
              })()}

              {!hover.edge && hover.protein && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {hover.protein.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', fontWeight: 700, color: classMeta(hover.protein.cls).color }}
                  >
                    {classMeta(hover.protein.cls).header.toLowerCase()}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                    {classMeta(hover.protein.cls).long}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {`responds to ${hover.protein.breadth} exposure terms`}
                    {hover.protein.breadthEid !== null ? ` (${hover.protein.breadthEid} base exposures)` : ''}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {`exposome R² = ${hover.protein.r2 === null ? '—' : hover.protein.r2.toFixed(3)}`}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                    Click to hold the focus on this protein.
                  </Typography>
                </>
              )}

              {!hover.edge && hover.exposure && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{hover.exposure.label}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    {`observational exposure · ${prettyCategory(hover.exposure.category)}`}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {`moves ${hover.exposure.n} of the ${view.counts.proteins[0]} drawn proteins`}
                  </Typography>
                </>
              )}

              {!hover.edge && hover.rct && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{hover.rct.label}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    Randomized intervention. Its protein shifts are measured, not associated — which is
                    why trial lines are drawn bold and lifestyle lines thin.
                  </Typography>
                </>
              )}

              {!hover.edge && hover.hub && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{dzName}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    {disease}{parsed?.icd ? ` · ICD-10 ${parsed.icd}` : ''}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {`${view.counts.gen_fwd[1]} forward and ${view.counts.gen_rev[1]} reverse genetic edges in the payload`}
                  </Typography>
                </>
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* --- legend: every color and every line style, named ---------------- */}
      {view && (
        <Box sx={{ mt: 1.5, mb: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center', mb: 1 }}>
            {CLASS_ORDER.filter((c) => view.blocks.some((b) => b.cls === c)).map((c) => (
              <Box key={c} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{
                  width: 14, height: 14, borderRadius: '50%', flex: '0 0 auto',
                  border: `2px solid ${CLASS_META[c].color}`, background: '#B9DDB0',
                }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  <b style={{ color: CLASS_META[c].color }}>{CLASS_META[c].header.toLowerCase()}</b>
                  {` — ${CLASS_META[c].note}`}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center', mb: 1 }}>
            {[
              { d: undefined, w: 2.1, c: '#555', t: 'forward MR, colocalized cis-pQTL (the causal set)' },
              { d: '5 3.5', w: 1.35, c: '#555', t: 'forward MR below the Tier-1 cis gate' },
              { d: '1.5 3', w: 1.05, c: '#555', t: 'reverse MR, disease → protein (reporter)' },
              { d: undefined, w: 1.5, c: '#555', t: 'trial → protein (measured shift)' },
              { d: undefined, w: 0.6, c: '#999', t: 'lifestyle exposure → protein (association)' },
            ].map((s) => (
              <Box key={s.t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <svg width="42" height="10" aria-hidden="true">
                  <line x1="1" y1="5" x2="41" y2="5" stroke={s.c} strokeWidth={s.w} strokeDasharray={s.d} />
                </svg>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.t}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
            {[[1, 'raises the node it points at'], [-1, 'lowers it']].map(([k, t]) => (
              <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <svg width="42" height="10" aria-hidden="true">
                  <line x1="1" y1="5" x2="41" y2="5" stroke={SIGN_COLOR[k]} strokeWidth="2.4" />
                </svg>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <svg width="60" height="12" aria-hidden="true">
                <rect x="0" y="1" width="58" height="10" rx="2" fill={`url(#${uid}-r2)`} />
              </svg>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {`node fill = exposome R² (0 – ${view.maxR2.toFixed(2)} here)`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <svg width="34" height="16" aria-hidden="true">
                <circle cx="6" cy="8" r="3" fill="#CFE8C6" stroke="#777" />
                <circle cx="22" cy="8" r="7" fill="#CFE8C6" stroke="#777" />
              </svg>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {`node size = exposures the protein responds to (up to ${view.maxBreadth})`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 16, height: 12, borderRadius: 0.5, bgcolor: RCT_COLOR }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>trial</Typography>
            </Box>
            {[...new Set(view.expKept.map((e) => e.category))].sort().map((c) => (
              <Box key={c} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <Box sx={{ width: 16, height: 12, borderRadius: 0.5, bgcolor: ecatColor(c) }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{prettyCategory(c)}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* --- the held focus ------------------------------------------------- */}
      {focused && (() => {
        const fwd = view.drawnFwd.filter((e) => e.protein === focused.id);
        const rev = view.drawnRev.filter((e) => e.protein === focused.id);
        const srcs = view.drawnObs.filter((e) => e.to === focused.id);
        const trials = view.drawnInterv.filter((e) => e.to === focused.id);
        const meta = classMeta(focused.cls);
        return (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, borderLeft: `4px solid ${meta.color}` }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{focused.label}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: meta.color }}>
                {meta.header.toLowerCase()}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label="clear focus"
                onClick={() => setFocus(null)}
                sx={{ ml: 'auto' }}
              />
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.75 }}>
              {meta.long}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              {`Moved by ${srcs.length} of the ${view.counts.exposures[0]} drawn exposures`}
              {trials.length ? ` and by ${trials.map((t) => t.from).join(', ')}` : ''}
              {`; responds to ${focused.breadth} exposure terms in all `}
              {`(exposome R² ${focused.r2 === null ? '—' : focused.r2.toFixed(3)}).`}
            </Typography>
            {fwd.map((e) => (
              <Typography key={`f${e.i}`} variant="caption" sx={{ display: 'block' }}>
                {`→ ${dzName}: ${e.tier || 'forward MR'}, |β| ${fmtW(e.weight)} `
                  + `(${SIGN_WORD[e.sign] || 'direction unknown'}), q ${fmtP(e.padj)}, ${e.support || 'support unrecorded'}`}
              </Typography>
            ))}
            {rev.map((e) => (
              <Typography key={`r${e.i}`} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                {`← ${dzName} (reverse): |β| ${fmtW(e.weight)} `
                  + `(${SIGN_WORD[e.sign] || 'direction unknown'}), q ${fmtP(e.padj)}, ${e.support || 'support unrecorded'}`}
              </Typography>
            ))}
            {!fwd.length && !rev.length && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                No genetic edge survives the current forward-evidence and platform filters.
              </Typography>
            )}
          </Paper>
        );
      })()}

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        Read left to right: <i>exposure → protein → disease</i>. Proteins are ordered by
        class, then by how many exposures they respond to. Counts are stated as
        <i>shown of existing</i> — nothing is trimmed silently.
      </Typography>
    </SectionCard>
  );
}
