import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, AlertTitle, Box, Chip, Paper, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import Select from 'react-select';
import SectionCard from '../SectionCard';
import ColumnarTable from '../ColumnarTable';
import PlotPanel from '../PlotPanel';
import { useKeys, useSection, useShard } from '../../lib/useSection';
// getShard rather than useShard for the effect-size panel: that panel needs ten
// shards at once (they are keyed by PROTEIN), and useShard is one key per hook.
import { getShard } from '../../lib/heapdata';
import { prettyExposure } from '../../lib/palette';
import { SpecPicker, assocSectionFor, specById } from '../../lib/covariateSpecs';
import {
  NON_ANATOMICAL, SHARED_REGIONS, TISSUE_BODY_MAP, prettyTissue,
} from '../../lib/tissueBodyMap';
// Served from public/, NOT imported from src/. Create React App runs SVGR over
// every .svg under src/ to synthesise a `ReactComponent` export, and these are
// Inkscape files carrying sodipodi:/inkscape: namespace tags, which React's JSX
// transform rejects outright -- "Namespace tags are not supported". The build
// fails even though only the URL export is used. Serving them as static assets
// sidesteps the transform entirely and keeps ~1.7 MB of anatomy out of the
// bundle, which was the intent anyway.
const ASSET_BASE = `${process.env.PUBLIC_URL || ''}/anatomogram`;
const maleSvgUrl = `${ASSET_BASE}/homo_sapiens.male.svg`;
const femaleSvgUrl = `${ASSET_BASE}/homo_sapiens.female.svg`;
const brainSvgUrl = `${ASSET_BASE}/homo_sapiens.brain.svg`;

// ---------------------------------------------------------------------------
// THE ENTRY POINT: pick an exposure, see which tissues it touches, then open a
// tissue and read the proteins that actually carried the enrichment.
//
// Every other enrichment view on this site starts from the analysis -- a
// heatmap cell, a tripartite edge, a tissue name. This one starts from the
// question a non-specialist arrives with: "I play strenuous sports; what does
// that show up in?" So the first thing on screen is a body, and the only thing
// asked of the reader is which exposure.
//
// THREE QUESTIONS, IN THE ORDER A READER NEEDS THEM
//   1. WHERE   the anatomogram, painted by the exposure's tissue GSEA
//              (bodymap_terms, kind='tissue', FDR q < 0.05).
//   2. WHICH   click an organ -> the GSEA LEADING EDGE for that tissue: the
//              exact proteins that carried the enrichment up to its peak
//              (bodymap_leading_edge, sharded by exposure).
//   3. WHY     pick one of the exposure's enriched pathways and the body
//              narrows to the tissues that share leading-edge proteins with it.
//
// WHAT THE LEADING EDGE IS, AND WHAT IT IS NOT
//   `core_enrichment` from the GSEA, exported by export_gsea_leading_edge.R.
//   It is NOT "proteins associated with this exposure that happen to be
//   expressed in this tissue" -- that set ignores rank and sweeps in proteins
//   that sat below the enrichment peak and contributed nothing to it. The
//   distinction is the whole reason this payload exists rather than an
//   intersection computed in the browser.
//
// THE PATHWAY -> TISSUE LINK IS COMPUTED HERE, AND IT IS NOT THE BACKBONE
//   Choosing a pathway lights only the tissues whose leading edge shares at
//   least `minShared` proteins with that pathway's leading edge, WITHIN THIS
//   ONE EXPOSURE. That is an intersection taken in this component, from the
//   shard on screen, and it moves every time the exposure picker moves.
//
//   The grey program->tissue backbone in the tripartite panel is a DIFFERENT
//   quantity that happens to be built from the same ingredient: >= 3 shared
//   leading-edge genes with the same NES sign, computed in R by
//   module2_program_tissue_edges.R across all 114 exposures at once, and it
//   does not move when the exposure changes. Neither number should be read as
//   the other, so this panel never calls its link a backbone and always states
//   the threshold it used.
//
// FOUR APPEARANCES, BECAUSE "NOT TESTED" AND "TESTED, NULL" ARE NOT THE SAME
//   The payload only carries rows that cleared q < 0.05, so a naive renderer
//   would leave a tested-but-null tissue looking identical to a piece of
//   anatomy the GTEx panel never covered. That would be the single most
//   misleading thing this figure could do, so there are four states and the
//   legend names all four -- see PAINT_STATES below.
//
// LABEL BOXES ARE THE PRIMARY TARGET, THE ORGAN IS THE SECONDARY ONE
//   Every named organ is an invisible overlay sized to the drawn organ, so the
//   hit area for the pituitary is a few square pixels and the reader has to
//   aim. Each LIT region therefore also gets a labelled box in the gutter,
//   joined to its organ by a leader line, and the box carries the same hover
//   and click as the shape. The body click was not removed -- this is a second,
//   larger target for the same action. Only lit regions are labelled: labelling
//   the tested-null anatomy as well would bury the figure under its own legend.
//
// THREE THINGS UNDER THE LEADING-EDGE TABLE
//   Clicking a tissue has always given the leading-edge proteins. Selecting one
//   of those proteins now also gives:
//     - its GTEx expression across all 54 tissues (protein_tissue_profile,
//       sharded by gene), drawn the way TissueExplorer.js draws it, with the
//       tissue that was clicked highlighted inside it. That is the point of
//       putting the chart here rather than leaving it in the sibling panel: it
//       answers "where does the organ I opened sit in this protein's own
//       distribution?".
//     - the exposure->protein effect sizes for the top proteins of this tissue
//       (assoc_*, sharded by PROTEIN), with intervals. See EFFECT_SHORTLIST for
//       how the ten are chosen without fetching the whole leading edge.
// ---------------------------------------------------------------------------

// --- direction grammar, shared with the rest of the site --------------------
// TissueExplorer.js:123, EnrichTripartite.js:134, InterventionNetwork.js:61.
// Red = up / enriched, blue = down / depleted, everywhere.
const DIR_COLOR = { up: '#B2182B', down: '#2166AC' };

// Only reachable if a rebuilt payload ever put two tissues of opposite sign on
// one shared shape. It does not happen in the published payload (0 of 79
// shared-shape co-occurrences conflict), but a silent coin-flip between red and
// blue is not an acceptable failure mode, so the case has its own colour.
const MIXED_COLOR = '#7B3FA0';

// Tested by the GSEA, no hit for this exposure. A real, flat, hoverable fill --
// it has to be visibly present, because its whole job is to be distinguishable
// from anatomy that was never in the panel (which stays unpainted).
const NULL_FILL = '#EDE9E3';
const NULL_STROKE = '#C9C2B8';

// |NES| -> colour intensity, on a FIXED domain rather than per-exposure. An
// autoscale would make the strongest tissue of a weak exposure look exactly as
// loud as the strongest tissue of a strong one, so two exposures could not be
// compared by eye -- which is the main thing a reader does with this figure.
// The published tissue |NES| runs 1.23 to 3.43.
const NES_LO = 1.2;
const NES_HI = 3.0;
const TINT_FLOOR = 0.30;   // even the weakest hit keeps 30% of its colour

// The whole-brain shape on the BODY svg. It is not a GTEx tissue and is never
// painted red or blue: doing that would invent a brain-level enrichment nobody
// computed. It gets a neutral slate wash purely as a pointer to the brain view.
const BRAIN_POINTER = 'brain';
const BRAIN_POINTER_COLOR = '#8FA3B0';

const SVG_URL = { male: maleSvgUrl, female: femaleSvgUrl, brain: brainSvgUrl };

// Stroke widths are in SVG user units, and the two drawings are not the same
// size (the body is ~106 units wide, the brain ~143), so one number would give
// visibly different line weights.
const STROKE_W = { body: 0.25, brain: 0.4 };

// Opens on strenuous sports because it is the cleanest demonstration of what
// the figure is for: heart, skeletal muscle and the arteries go up, liver,
// kidney, lung and spleen go down, and the pathway picker separates them
// ("Striated Muscle Contraction" -> muscle and both heart chambers,
// "Complement cascade" -> liver). Checked against the published key list rather
// than assumed -- a renamed key falls back to the first exposure instead of
// leaving an empty body.
const DEFAULT_EXPOSURES = [
  'types_of_physical_activity_in_last_4_weeks_f6164_0_0.multi_Strenuous_sports',
];

// Minimum shared leading-edge proteins for a pathway->tissue link. 1 is the
// default because it is the statement a reader can hold in their head ("these
// tissues and this pathway are carried by some of the same proteins"); the
// higher settings exist so the claim can be made stricter on demand, and the
// count is always shown so the strength of each link is visible either way.
const MIN_SHARED_CHOICES = [1, 2, 3, 5];

// The four appearances, in the order the legend lists them.
const PAINT_STATES = [
  {
    id: 'lit',
    label: 'enriched (FDR q < 0.05)',
    note: 'red up, blue down; colour depth is |NES| on a fixed 1.2–3.0 scale',
  },
  {
    id: 'unlinked',
    label: 'enriched, but not linked to the chosen pathway',
    note: 'shares fewer leading-edge proteins with it than the threshold; outlined in its own direction',
  },
  {
    id: 'null',
    label: 'tested, nothing at q < 0.05',
    note: 'in the GTEx panel this exposure was scored against, and it came back null',
  },
  {
    id: 'untested',
    label: 'not in the tested panel',
    note: 'left unpainted — the GSEA never scored this piece of anatomy, so nothing is claimed about it',
  },
];

// --- label boxes: geometry --------------------------------------------------
// The gutter is reserved by insetting the drawing, not by letting the labels
// push it around: the boxes are absolutely positioned over the frame, so
// however many of them there are the anatomogram never moves and the measured
// anchor positions stay valid.
const LABEL_GUTTER = 106;   // px of gutter on each side of the drawing
const LABEL_W = 100;
const LABEL_H = 30;
const LABEL_GAP = 3;
const LEADER_COLOR = 'rgba(60,60,60,0.55)';

// The covariate specifications live in lib/covariateSpecs.js. This component
// used to carry its own copy keyed by PAYLOAD SECTION NAME (assoc_base_plus_bmi)
// while the enrichment exports key the same specification as `base_bmi`, so the
// two layers on this page could be set to different models at the same time --
// a base-specification body map read beside +BMI effect sizes. One picker now
// drives both, and specById().assocSection does the translation.

// HOW THE TOP TEN ARE PICKED, AND WHY IT IS A SHORTLIST
//   assoc_* is sharded by PROTEIN, so N proteins is N requests. Ranking by
//   |beta| requires the betas, which is the thing being fetched -- so the
//   ranking is done in two passes rather than by pulling a whole leading edge.
//
//   PASS 1, free: the leading edge is stored in the order clusterProfiler wrote
//   `core_enrichment`, which is the RANKED-LIST order. Checked against the
//   published payload rather than assumed: across 86 tissue terms with >= 8
//   fetchable proteins, |Spearman| between leading-edge position and the
//   published |beta_test| has a median of 0.85. The sign flips with direction,
//   because a negative-NES set is read from the bottom of the ranked list --
//   for `up` terms position 0 is the strongest protein, for `down` terms it is
//   the LAST one. Hence the reverse below; getting it backwards would shortlist
//   the weakest proteins of every depleted tissue.
//
//   PASS 2, paid: fetch that shortlist and re-rank by the |beta_test| actually
//   returned. So the order on screen is the real effect size; the shortlist only
//   decides who was eligible, and the caption says so and prints both counts --
//   with a median |rho| of 0.85 rather than 1.0, a protein just outside the
//   shortlist can outrank one inside it.
const EFFECT_SHORTLIST = 24;
const EFFECT_TOP_N = 10;

// --- GTEx profile: formatting and reading aids ------------------------------
// Deliberately the same treatment as TissueExplorer.js:79-118 -- same log axis,
// same zero floor, same tau bands and wording. These are duplicated rather than
// imported because that file exports only its component, and a second visual
// language for one dataset would be worse than a few repeated lines. If the
// bands move there, move them here.
const fmtTpm = (v) => {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '0';
  if (v >= 1000) return Math.round(v).toLocaleString();
  if (v >= 10) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(2);
  return v.toExponential(1);
};
const fmtDecade = (v) => (v >= 1000 ? `${v / 1000}k` : String(v));

const TAU_BANDS = [
  { max: 0.4, word: 'ubiquitous', color: '#2C7FB8', gloss: 'transcribed at a broadly similar level across the 54 tissues' },
  { max: 0.7, word: 'intermediate', color: '#B0A24A', gloss: 'transcribed widely, with a clear preference for a few tissues' },
  { max: Infinity, word: 'tissue-restricted', color: '#B0653C', gloss: 'nearly all of its transcription sits in one or a few tissues' },
];
const tauBand = (t) => TAU_BANDS.find((b) => t < b.max) || TAU_BANDS[TAU_BANDS.length - 1];

const DETECTED = '#4F7CA3';
const NOT_DETECTED = '#C4B7A6';

// --- small helpers ----------------------------------------------------------

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const RGB = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Mix `hex` toward white. t=1 is the pure colour, t=0 is white. */
function tint(hex, t) {
  const c = RGB(hex).map((v) => Math.round(255 + (v - 255) * clamp(t, 0, 1)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** |NES| -> 0..1 on the fixed domain, floored so a hit is never invisible. */
const nesIntensity = (nes) => TINT_FLOOR
  + (1 - TINT_FLOOR) * clamp((Math.abs(nes) - NES_LO) / (NES_HI - NES_LO), 0, 1);

const fmtQ = (v) => {
  if (v === null) return '—';
  if (v === 0) return '< 1e-300';
  return v < 1e-3 ? v.toExponential(1) : v.toFixed(3);
};

const fmtNes = (v) => (v === null ? '—' : (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)));

const str = (v) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s === '' ? null : s;
};

const fmtBeta = (v) => (v === null || v === undefined ? '—' : (v > 0 ? `+${v.toFixed(3)}` : v.toFixed(3)));

const fmtP = (v) => {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '< 1e-300';
  return v < 1e-3 ? v.toExponential(1) : v.toFixed(3);
};

/**
 * Lay label boxes out in two gutters without letting them overlap each other.
 *
 * Side is chosen by which half of the drawing the organ sits in -- left-side
 * anatomy gets the left gutter -- because that is what keeps leader lines from
 * crossing, and it is the same idiom the printed exemplar panels use. A gutter
 * that is full spills to the other one rather than dropping the label; only
 * when BOTH are full is a label dropped, and the caller prints how many.
 *
 * Within a gutter the boxes are pushed down from their organ's height until
 * they clear the box above, then pushed back up off the bottom edge, so a
 * cluster of organs (the four upper-abdominal ones, the basal ganglia) fans out
 * instead of stacking into one illegible pile.
 */
function placeLabels(items, w, h) {
  const cap = Math.max(1, Math.floor((h - 4) / (LABEL_H + LABEL_GAP)));
  const cols = { left: [], right: [] };
  // Strongest first, so if there is not room for everything the labels that
  // survive are the ones a reader would have looked at anyway.
  [...items].sort((a, b) => b.priority - a.priority).forEach((it) => {
    const pref = it.ax < w / 2 ? 'left' : 'right';
    const other = pref === 'left' ? 'right' : 'left';
    if (cols[pref].length < cap) cols[pref].push(it);
    else if (cols[other].length < cap) cols[other].push(it);
  });

  const out = [];
  ['left', 'right'].forEach((side) => {
    const list = cols[side].sort((a, b) => a.ay - b.ay);
    let floor = 2;
    list.forEach((it) => {
      it.top = Math.max(it.ay - LABEL_H / 2, floor);
      floor = it.top + LABEL_H + LABEL_GAP;
    });
    let ceil = h - 2;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      list[i].top = Math.max(2, Math.min(list[i].top, ceil - LABEL_H));
      ceil = list[i].top - LABEL_GAP;
    }
    list.forEach((it) => { it.side = side; out.push(it); });
  });
  return out;
}

const countShared = (a, b) => {
  if (!a || !b) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let n = 0;
  small.forEach((g) => { if (big.has(g)) n += 1; });
  return n;
};

// Which anatomogram carries which region. Derived from the hand-written map so
// this component never re-states a pairing that lives in tissueBodyMap.js.
const BODY_REGION_IDS = [];
const BRAIN_REGION_IDS = [];
Object.values(TISSUE_BODY_MAP).forEach((m) => {
  const list = m.view === 'brain' ? BRAIN_REGION_IDS : BODY_REGION_IDS;
  if (!list.includes(m.region)) list.push(m.region);
});
BODY_REGION_IDS.push(BRAIN_POINTER);

// ---------------------------------------------------------------------------
// LOADING AND HIGHLIGHTING THE VENDORED SVGs
//
// The ids we need sit on a <title> CHILD of each shape, not on the shape:
//
//     <path id="UBERON_0002107" style="fill:none;stroke:none" d="...">
//       <title id="liver">liver</title>
//     </path>
//
// So every named organ is an INVISIBLE overlay on the printed body outline, and
// "highlighting" means giving that overlay a fill. Two consequences run through
// everything below: a shape has to be reached via its title's parent, and an
// unpainted shape is genuinely invisible AND unhoverable (pointer-events do not
// fire on fill:none), which is exactly the behaviour the "not tested" state
// wants.
//
// WHY FETCH + DOMParser RATHER THAN SVGR
//   CRA hands `import x from './y.svg'` the file-loader URL and only builds the
//   SVGR component for the `{ ReactComponent }` named export. Taking the URL and
//   fetching it keeps the bytes exactly as vendored, keeps ~1.7 MB of anatomy
//   out of the JS bundle, and loads a drawing only when someone looks at it.
//   DOMParser in 'image/svg+xml' mode is used rather than innerHTML because
//   these are XML files with sodipodi:/inkscape: namespaced attributes, which
//   the HTML parser is entitled to mangle.
//
// The three files also reuse ids between them (`amygdala` is in both the male
// body and the brain), so every lookup is scoped to its own container element.
// Nothing here queries `document`.
// ---------------------------------------------------------------------------

// One in-flight request per file, shared by every mount, kept for the life of
// the page -- the same promise-cache discipline heapdata.js uses.
const svgTextCache = new Map();

function loadSvgText(url) {
  if (!svgTextCache.has(url)) {
    svgTextCache.set(url, fetch(url).then((r) => {
      if (!r.ok) {
        svgTextCache.delete(url);
        throw new Error(`${r.status} ${r.statusText} fetching the anatomogram`);
      }
      return r.text();
    }));
  }
  return svgTextCache.get(url);
}

// Shapes are <path>, but also <g> wrappers, <rect>, <ellipse>, <circle>. A <g>
// wrapper is not enough on its own: the male `renal_cortex` group holds two
// paths that each carry their own `fill:none`, which would beat a fill set on
// the parent. So a paint is applied to the titled element AND every shape under
// it.
const SHAPE_SELECTOR = 'path, g, rect, circle, ellipse, polygon, polyline, line, use';

/**
 * The declared region id -> the element to paint, inside one container.
 *
 * The fallback is not cosmetic: the female drawing spells two of its regions
 * with a space (`coronary artery`, `parotid gland`) where the male one uses an
 * underscore. Without the retry, coronary artery would silently vanish from the
 * female figure even though the shape is right there.
 */
function findShape(root, region) {
  const title = root.querySelector(`title[id="${region}"]`)
    || root.querySelector(`title[id="${region.replace(/_/g, ' ')}"]`);
  return title ? title.parentElement : null;
}

const shapeTargets = (el) => [el, ...el.querySelectorAll(SHAPE_SELECTOR)];

/**
 * Remember each shape's vendored inline style once.
 *
 * Necessary because the vendored style IS `fill:none;stroke:none` and it lives
 * in the style attribute. Clearing `el.style.fill` to un-paint a shape would
 * delete that declaration and let the SVG default (solid black) through, which
 * paints a black blob over the body. Un-painting therefore restores the
 * remembered string rather than guessing at it.
 */
function rememberBaseStyle(el) {
  shapeTargets(el).forEach((t) => {
    if (t.dataset.heapBase === undefined) t.dataset.heapBase = t.getAttribute('style') || '';
  });
}

function resetShape(el) {
  shapeTargets(el).forEach((t) => {
    const base = t.dataset.heapBase;
    if (base) t.setAttribute('style', base);
    else t.removeAttribute('style');
  });
}

// Appended after the vendored declarations so ours win by source order, which
// keeps the original string intact for resetShape().
function paintShape(el, css) {
  shapeTargets(el).forEach((t) => {
    t.setAttribute('style', `${t.dataset.heapBase || ''};${css}`);
  });
}

/**
 * One anatomogram: fetch, inject, paint, and report which regions it actually
 * carries.
 *
 * `paint` is a Map(regionId -> css string). A region present in the drawing but
 * absent from the Map is reset to invisible, which is the "not in the tested
 * panel" state.
 *
 * `onResolved(ids)` fires once per drawing with the region ids that resolved.
 * The caller uses it to route anything unresolvable into the side panel instead
 * of dropping it -- see the female spinal cord, below.
 *
 * `labels` is [{ region, text, sub, color, dashed, priority }] for the regions
 * worth naming in the gutters. It must be a STABLE array (it comes out of the
 * `view` memo): a fresh literal on every render would re-run the measuring
 * effect on every render.
 */
function Anatomogram({
  url, regionIds, paint, labels, minHeight, onPick, onResolved, renderTooltip,
}) {
  const hostRef = useRef(null);
  const frameRef = useRef(null);
  const shapesRef = useRef(null);
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);
  const [injected, setInjected] = useState(0);
  const [hover, setHover] = useState(null);
  const [placed, setPlaced] = useState([]);
  const [frame, setFrame] = useState({ w: 0, h: 0 });

  // Callbacks go through a ref so a parent re-render never re-injects 900 KB of
  // anatomy; the injection effect depends only on the file and the id list.
  const cb = useRef({ onPick, onResolved });
  cb.current = { onPick, onResolved };

  useEffect(() => {
    let alive = true;
    setText(null);
    setError(null);
    loadSvgText(url)
      .then((t) => { if (alive) setText(t); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [url]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !text) return undefined;

    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    // Browsers report an XML parse failure by handing back a <parsererror>
    // document rather than throwing, and they disagree about which namespace it
    // sits in -- so the reliable test is "did we get an <svg> back".
    if (!svg || svg.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) {
      setError(new Error('the vendored anatomogram did not parse'));
      return undefined;
    }

    // Inkscape ships a fixed width/height alongside the viewBox, which pins the
    // drawing at ~106 x 195 px however much room it is given. Dropping the two
    // attributes and letting the viewBox scale is what makes it responsive.
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('style', 'width:100%;height:100%;display:block');
    // Editor-only nodes that never render: sodipodi:namedview carries Inkscape's
    // canvas colours and grid, <metadata> the RDF credit block.
    svg.querySelectorAll('namedview, metadata').forEach((n) => n.remove());

    host.replaceChildren(document.importNode(svg, true));
    const root = host.firstElementChild;

    const found = new Map();
    regionIds.forEach((region) => {
      const el = findShape(root, region);
      if (!el) return;
      rememberBaseStyle(el);
      // Stamped on the shape so hover and click need ONE listener on the host
      // rather than one per organ, and so a click landing on a child path of a
      // <g> still resolves to the region.
      el.dataset.heapRegion = region;
      found.set(region, el);
    });
    shapesRef.current = found;
    cb.current.onResolved(Array.from(found.keys()));

    const hit = (ev) => (ev.target.closest ? ev.target.closest('[data-heap-region]') : null);
    const onMove = (ev) => {
      const el = hit(ev);
      if (!el) { setHover(null); return; }
      // Measured against the FRAME, not the host: the label boxes sit in the
      // frame's gutters and set the same hover state, so both paths have to
      // report coordinates in one system or the tooltip jumps between them.
      const box = (frameRef.current || host).getBoundingClientRect();
      setHover({
        region: el.dataset.heapRegion,
        x: ev.clientX - box.left,
        y: ev.clientY - box.top,
        w: box.width,
      });
    };
    const onLeave = () => setHover(null);
    const onClick = (ev) => {
      const el = hit(ev);
      if (el) cb.current.onPick(el.dataset.heapRegion);
    };
    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    host.addEventListener('click', onClick);
    setInjected((n) => n + 1);

    return () => {
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
      host.removeEventListener('click', onClick);
      host.replaceChildren();
      shapesRef.current = null;
    };
  }, [text, regionIds]);

  // Repaint. Separate from injection so changing exposure, sex-view, pathway or
  // threshold restyles the existing DOM instead of re-parsing the file.
  useEffect(() => {
    const found = shapesRef.current;
    if (!found) return;
    found.forEach((el, region) => {
      const css = paint.get(region);
      if (css) paintShape(el, css);
      else resetShape(el);
    });
  }, [paint, injected]);

  // Measure where each labelled organ actually landed.
  //
  // Measured, never derived from the viewBox: the drawing is scaled to whatever
  // width the panel has, and both bodies differ in where the same organ sits.
  // getBoundingClientRect works on an unpainted shape because it reports
  // geometry, not paint -- the same reason these invisible overlays can be
  // highlighted at all.
  //
  // The overlay is position:absolute over the frame, so nothing it renders can
  // change the frame's size and re-trigger this. The `prev.length ? [] : prev`
  // guard is the other half of that: without it an empty label list would set a
  // new [] on every render and spin.
  useEffect(() => {
    const box = frameRef.current;
    const found = shapesRef.current;
    if (!box || !found || !labels || !labels.length) {
      setPlaced((prev) => (prev.length ? [] : prev));
      return undefined;
    }
    let raf = 0;
    const measure = () => {
      const fr = box.getBoundingClientRect();
      if (!fr.width || !fr.height) return;
      const anchored = [];
      labels.forEach((spec) => {
        const el = found.get(spec.region);
        if (!el) return;
        const b = el.getBoundingClientRect();
        if (!b.width && !b.height) return;
        anchored.push({
          ...spec,
          ax: b.left + b.width / 2 - fr.left,
          ay: b.top + b.height / 2 - fr.top,
        });
      });
      setFrame({ w: fr.width, h: fr.height });
      setPlaced(placeLabels(anchored, fr.width, fr.height));
    };
    measure();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(box);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [labels, injected]);

  const tip = hover ? renderTooltip(hover.region) : null;
  const gutter = labels && labels.length ? LABEL_GUTTER : 0;
  const nLabels = labels ? labels.length : 0;

  return (
    <Box sx={{ minHeight, display: 'flex', flexDirection: 'column' }}>
      {error && (
        <Alert severity="warning" sx={{ my: 1 }}>
          Could not draw the anatomogram: {String(error.message || error)}. The tissue results are
          unaffected — every enriched tissue is still listed beside the figure.
        </Alert>
      )}
      {!text && !error && (
        <Typography variant="caption" sx={{ color: 'text.secondary', p: 1 }}>Loading the anatomogram…</Typography>
      )}

      <Box ref={frameRef} sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {/* Inset by the gutters rather than shrunk by them, so the label boxes
            can never reflow the drawing they are measured against. */}
        <Box
          ref={hostRef}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            ml: `${gutter}px`,
            mr: `${gutter}px`,
            '& svg': { height: '100%' },
          }}
        />

        {placed.length > 0 && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            {/* Leader lines, drawn under the boxes. Two segments and an elbow:
                a straight diagonal from a box to a small organ crosses its
                neighbours' lines much more often than an L does. */}
            <svg
              width="100%"
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
              aria-hidden="true"
            >
              {placed.map((a) => {
                const edge = a.side === 'left' ? gutter - 4 : frame.w - gutter + 4;
                const elbow = a.side === 'left' ? edge + 9 : edge - 9;
                const cy = a.top + LABEL_H / 2;
                const on = hover && hover.region === a.region;
                return (
                  <g key={`${a.region}-line`}>
                    <polyline
                      points={`${edge},${cy} ${elbow},${cy} ${a.ax},${a.ay}`}
                      fill="none"
                      stroke={on ? a.color : LEADER_COLOR}
                      strokeWidth={on ? 1.6 : 0.8}
                    />
                    <circle cx={a.ax} cy={a.ay} r={on ? 3.4 : 2} fill={a.color} stroke="#fff" strokeWidth="0.8" />
                  </g>
                );
              })}
            </svg>

            {placed.map((a) => (
              <Box
                key={a.region}
                onClick={() => onPick(a.region)}
                onMouseEnter={() => setHover({ region: a.region, x: a.ax, y: a.ay, w: frame.w })}
                onMouseLeave={() => setHover(null)}
                sx={{
                  position: 'absolute',
                  top: `${a.top}px`,
                  [a.side]: 0,
                  width: LABEL_W,
                  height: LABEL_H,
                  px: 0.5,
                  py: 0.25,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  borderRadius: 0.75,
                  bgcolor: '#fff',
                  border: '1px solid',
                  borderColor: a.color,
                  borderStyle: a.dashed ? 'dashed' : 'solid',
                  borderLeftWidth: a.side === 'right' ? 3 : 1,
                  borderRightWidth: a.side === 'left' ? 3 : 1,
                  boxShadow: hover && hover.region === a.region ? 2 : 0,
                  textAlign: a.side === 'left' ? 'right' : 'left',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.63rem',
                    fontWeight: 700,
                    lineHeight: 1.12,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {a.text}
                </Typography>
                <Typography sx={{ fontSize: '0.58rem', lineHeight: 1.15, color: a.color, fontWeight: 600 }}>
                  {a.sub}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {tip && (
          <Paper
            elevation={6}
            sx={{
              position: 'absolute',
              left: clamp(hover.x, 90, Math.max(90, (hover.w || 0) - 90)),
              top: hover.y,
              transform: hover.y < 150 ? 'translate(-40%, 20px)' : 'translate(-40%, calc(-100% - 16px))',
              p: 1.25,
              minWidth: 230,
              maxWidth: 340,
              pointerEvents: 'none',
              zIndex: 8,
            }}
          >
            {tip}
          </Paper>
        )}
      </Box>

      {/* Fixed height on purpose: this caption sits below the measured frame,
          so a one-line/two-line change here would resize the frame and move
          every anchor it just reported. */}
      {nLabels > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, lineHeight: 1.3, minHeight: 32 }}>
          {placed.length === nLabels
            ? `All ${nLabels} lit region${nLabels === 1 ? '' : 's'} labelled — click a box or the organ itself.`
            : `${placed.length} of ${nLabels} lit regions labelled, strongest |NES| first — the gutters hold no more. `
              + 'Every lit region is still clickable on the figure and named on hover.'}
        </Typography>
      )}
    </Box>
  );
}

// A colour chip that uses the same fill the body uses, so the side panel and
// the legend cannot drift from the figure.
function Swatch({ color, dashed }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 16,
        height: 16,
        flex: '0 0 auto',
        borderRadius: 0.5,
        bgcolor: dashed ? NULL_FILL : color,
        border: '1px solid',
        borderColor: dashed ? color : 'rgba(0,0,0,0.25)',
        borderStyle: dashed ? 'dashed' : 'solid',
      }}
    />
  );
}

// One line of the side panel. Lit exactly like an organ, because these tissues
// are results too -- they simply have nowhere to sit on a drawing of a body.
function SideRow({ entry, onClick, active }) {
  const lit = entry.state === 'lit' || entry.state === 'unlinked';
  return (
    <Box
      onClick={lit ? onClick : undefined}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1,
        py: 0.6,
        borderRadius: 1,
        cursor: lit ? 'pointer' : 'default',
        bgcolor: active ? 'action.selected' : 'transparent',
        '&:hover': lit ? { bgcolor: 'action.hover' } : undefined,
      }}
    >
      <Box sx={{ pt: 0.3 }}>
        <Swatch
          color={entry.state === 'null' ? NULL_STROKE : entry.color}
          dashed={entry.state === 'unlinked'}
        />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: lit ? 600 : 400, lineHeight: 1.25 }}>
          {prettyTissue(entry.tissue)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
          {entry.state === 'null'
            ? 'tested, nothing at q < 0.05'
            : `NES ${fmtNes(entry.nes)} · q = ${fmtQ(entry.q)} · ${entry.nLead} leading-edge proteins`}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3, fontStyle: 'italic' }}>
          {entry.why}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ExposureBodyMap() {
  const { data: terms, loading, error } = useSection('bodymap_terms');

  const [exposure, setExposure] = useState(null);
  const [sex, setSex] = useState('male');
  const [pathway, setPathway] = useState(null);
  const [minShared, setMinShared] = useState(1);
  const [openTissue, setOpenTissue] = useState(null);
  // The protein whose GTEx profile is shown under the leading-edge table.
  const [gene, setGene] = useState(null);
  // Which covariate specification the effect sizes are read from.
  const [spec, setSpec] = useState('base');
  const assocSection = assocSectionFor(spec);
  const specLabel = specById(spec).label;
  // viewKey -> Set of region ids the drawing actually carries. Measured from the
  // injected DOM rather than assumed, because the two body drawings are not
  // mirror images of each other: the female one has no `spinal_cord` shape at
  // all, so an enriched cervical spinal cord has to be routed somewhere rather
  // than quietly failing to paint.
  const [available, setAvailable] = useState({});

  const { data: shard, loading: shardLoading, error: shardError } = useShard('bodymap_leading_edge', exposure);

  // --- bodymap_terms: every exposure, and the tested tissue panel -----------
  const parsed = useMemo(() => {
    if (!terms?.exposure) return null;
    const byExposure = new Map();
    const testedTissues = new Set();
    for (let i = 0; i < terms.exposure.length; i += 1) {
      if (terms.spec && terms.spec[i] !== spec) continue;
      const key = terms.exposure[i];
      let rec = byExposure.get(key);
      if (!rec) { rec = { tissues: [], pathways: [] }; byExposure.set(key, rec); }
      const row = {
        term: terms.term[i],
        label: terms.term_label[i],
        nes: num(terms.nes[i]),
        q: num(terms.q[i]),
        dir: terms.dir[i],
        setSize: num(terms.set_size[i]),
        nLead: num(terms.n_leading_edge[i]),
      };
      if (terms.kind[i] === 'tissue') {
        rec.tissues.push(row);
        // The tested panel is read off the data (the union of tissues scored
        // anywhere) rather than off the hand-written map, so the "tested, null"
        // state stays correct if the GSEA panel is ever widened or narrowed.
        testedTissues.add(row.term);
      } else {
        rec.pathways.push(row);
      }
    }
    return { byExposure, testedTissues, exposures: Array.from(byExposure.keys()).sort() };
  }, [terms, spec]);

  useEffect(() => {
    if (exposure || !parsed?.exposures.length) return;
    const hit = DEFAULT_EXPOSURES.find((k) => parsed.byExposure.has(k))
      || parsed.exposures.find((k) => /strenuous/i.test(k))
      || parsed.exposures[0];
    setExposure(hit);
  }, [parsed, exposure]);

  // A pathway and an open tissue belong to one exposure; carrying either across
  // a change of exposure would show a drill-in for a term the new exposure does
  // not have.
  useEffect(() => {
    setPathway(null);
    setOpenTissue(null);
  }, [exposure]);

  // --- the shard: leading-edge proteins for this exposure -------------------
  const leadingEdge = useMemo(() => {
    if (!shard?.gene) return null;
    const byTerm = new Map();          // "kind|term" -> Set(gene)
    const tissuesPerGene = new Map();  // gene -> # enriched tissues carrying it
    const pathwaysPerGene = new Map(); // gene -> # enriched pathways carrying it
    for (let i = 0; i < shard.gene.length; i += 1) {
      // Each exposure's shard now carries all five specifications, so the rows
      // have to be narrowed here. Without this the leading edge would be the
      // union across specifications while the terms above were a single one.
      if (shard.spec && shard.spec[i] !== spec) continue;
      const kind = shard.kind[i];
      const key = `${kind}|${shard.term[i]}`;
      let set = byTerm.get(key);
      if (!set) { set = new Set(); byTerm.set(key, set); }
      set.add(shard.gene[i]);
      const counter = kind === 'tissue' ? tissuesPerGene : pathwaysPerGene;
      counter.set(shard.gene[i], (counter.get(shard.gene[i]) || 0) + 1);
    }
    return { byTerm, tissuesPerGene, pathwaysPerGene };
  }, [shard, spec]);

  // --- the whole view: placement, paint, side panel, counts -----------------
  const view = useMemo(() => {
    if (!parsed || !exposure) return null;
    const rec = parsed.byExposure.get(exposure) || { tissues: [], pathways: [] };
    const pathwayRow = pathway ? rec.pathways.find((p) => p.term === pathway) : null;
    const pathwayGenes = pathwayRow && leadingEdge
      ? leadingEdge.byTerm.get(`pathway|${pathway}`)
      : null;
    const availSet = available[sex];

    // 1. every enriched tissue: how it links to the pathway, and where it goes.
    const tissues = rec.tissues.map((row) => {
      const map = TISSUE_BODY_MAP[row.term];
      const genes = leadingEdge ? leadingEdge.byTerm.get(`tissue|${row.term}`) : null;
      const shared = pathwayGenes ? countShared(genes, pathwayGenes) : null;
      // Not yet loaded is treated as "linked" so the body never flickers to a
      // narrower picture and back while the shard is in flight.
      const linked = pathwayGenes ? shared >= minShared : true;

      let place = 'body';
      let region = map ? map.region : null;
      let why = '';
      if (!map) {
        place = 'panel';
        why = NON_ANATOMICAL[row.term] || 'no anatomogram shape exists for this term';
      } else if (map.view === 'brain') {
        place = 'brain';
      } else if (map.sex && map.sex !== sex) {
        place = 'panel';
        why = `drawn only on the ${map.sex} figure`;
        region = null;
      } else if (availSet && !availSet.has(map.region)) {
        // Measured, not predicted: the female anatomogram simply has no
        // `spinal_cord` shape. An enrichment must not disappear because of
        // which drawing happens to be on screen.
        place = 'panel';
        why = `the ${sex} anatomogram carries no “${map.region.replace(/_/g, ' ')}” shape`;
        region = null;
      }
      return {
        ...row,
        map,
        region,
        place,
        why,
        shared,
        linked,
        state: linked ? 'lit' : 'unlinked',
        color: DIR_COLOR[row.dir] || MIXED_COLOR,
      };
    });

    // 2. collapse onto shapes. Several GTEx tissues share one organ, so a shape
    //    can carry two different enrichments and the hover has to name both.
    const regions = new Map();
    tissues.forEach((t) => {
      if (t.place !== 'body' && t.place !== 'brain') return;
      let r = regions.get(t.region);
      if (!r) { r = { region: t.region, view: t.place, tissues: [] }; regions.set(t.region, r); }
      r.tissues.push(t);
    });
    regions.forEach((r) => {
      r.tissues.sort((a, b) => Math.abs(b.nes) - Math.abs(a.nes));
      const dirs = new Set(r.tissues.map((t) => t.dir));
      r.mixed = dirs.size > 1;
      r.anyLinked = r.tissues.some((t) => t.linked);
      const lead = r.tissues.find((t) => t.linked) || r.tissues[0];
      r.lead = lead;
      r.color = r.mixed ? MIXED_COLOR : (DIR_COLOR[lead.dir] || MIXED_COLOR);
      r.state = r.anyLinked ? 'lit' : 'unlinked';
      r.approximate = r.tissues.some((t) => t.map && t.map.approximate);
    });

    // 3. tested-but-null shapes. Everything mapped and in the tested panel that
    //    this exposure did not hit, so null never borrows the appearance of
    //    untested.
    const enriched = new Set(rec.tissues.map((r) => r.term));
    const nullRegions = new Map();
    Object.entries(TISSUE_BODY_MAP).forEach(([tissue, m]) => {
      if (enriched.has(tissue) || !parsed.testedTissues.has(tissue)) return;
      if (m.sex && m.sex !== sex) return;
      if (regions.has(m.region)) return;
      let r = nullRegions.get(m.region);
      if (!r) { r = { region: m.region, view: m.view, tissues: [] }; nullRegions.set(m.region, r); }
      r.tissues.push(tissue);
    });

    // 4. the paint maps, one per drawing.
    const paintBody = new Map();
    const paintBrain = new Map();
    const info = new Map();
    const put = (viewKey, region, css, meta) => {
      (viewKey === 'brain' ? paintBrain : paintBody).set(region, css);
      info.set(`${viewKey}|${region}`, meta);
    };
    regions.forEach((r) => {
      const sw = STROKE_W[r.view === 'brain' ? 'brain' : 'body'];
      const css = r.state === 'lit'
        ? `fill:${tint(r.color, nesIntensity(r.lead.nes))};stroke:${r.color};`
          + `stroke-width:${sw};stroke-opacity:0.85;cursor:pointer`
        : `fill:${NULL_FILL};stroke:${r.color};stroke-width:${sw * 1.2};`
          + `stroke-dasharray:${sw * 3} ${sw * 2.4};cursor:pointer`;
      put(r.view, r.region, css, { kind: 'region', region: r });
    });
    nullRegions.forEach((r) => {
      const viewKey = r.view === 'brain' ? 'brain' : 'body';
      const sw = STROKE_W[viewKey];
      put(
        viewKey,
        r.region,
        `fill:${NULL_FILL};stroke:${NULL_STROKE};stroke-width:${sw * 0.6};cursor:default`,
        { kind: 'null', region: r },
      );
    });

    // 5. the whole-brain shape on the body, as a pointer only. Deliberately
    //    outside the red/blue grammar: GTEx scores 13 brain subregions, never a
    //    brain, so painting it by direction would invent a result.
    const brainHits = tissues.filter((t) => t.place === 'brain');
    if (brainHits.length) {
      put(
        'body',
        BRAIN_POINTER,
        `fill:${tint(BRAIN_POINTER_COLOR, 0.5)};stroke:${BRAIN_POINTER_COLOR};`
        + `stroke-width:${STROKE_W.body};stroke-dasharray:0.8 0.6;cursor:default`,
        { kind: 'brainPointer', n: brainHits.length },
      );
    }

    // 5b. the gutter labels: one per LIT region, and nothing else. A label for
    //     every tested-null shape would be thirty boxes of "nothing here", and
    //     the brain pointer is not a result so it gets none either. Priority is
    //     |NES| because that is what decides which survive a full gutter.
    const labelsBody = [];
    const labelsBrain = [];
    regions.forEach((r) => {
      const spec = {
        region: r.region,
        text: r.tissues.length > 1
          ? `${r.region.replace(/_/g, ' ')} · ${r.tissues.length} tissues`
          : prettyTissue(r.tissues[0].term),
        sub: r.mixed ? 'mixed direction' : `NES ${fmtNes(r.lead.nes)}`,
        color: r.color,
        dashed: r.state === 'unlinked',
        priority: Math.abs(r.lead.nes || 0),
      };
      (r.view === 'brain' ? labelsBrain : labelsBody).push(spec);
    });

    // 6. the side panel: everything with nowhere to sit, plus the three terms
    //    that will never have anywhere to sit, shown null when they are null.
    const panel = tissues.filter((t) => t.place === 'panel');
    const panelTerms = new Set(panel.map((t) => t.term));
    Object.entries(NON_ANATOMICAL).forEach(([tissue, why]) => {
      if (panelTerms.has(tissue) || !parsed.testedTissues.has(tissue)) return;
      panel.push({
        term: tissue, tissue, state: 'null', why, nes: null, q: null, nLead: 0, place: 'panel',
      });
    });
    panel.forEach((p) => { p.tissue = p.term; });
    panel.sort((a, b) => {
      if ((a.state === 'null') !== (b.state === 'null')) return a.state === 'null' ? 1 : -1;
      return Math.abs(b.nes || 0) - Math.abs(a.nes || 0);
    });

    // Sex-specific anatomy that is not enriched is not listed row by row -- it
    // would be a dozen lines of nothing -- but it is counted, so the reader can
    // see that the figure is not showing everything the panel covers.
    const hiddenNull = Object.entries(TISSUE_BODY_MAP).filter(([tissue, m]) => (
      !enriched.has(tissue) && parsed.testedTissues.has(tissue) && m.sex && m.sex !== sex
    )).length;

    const nLinked = pathwayGenes ? tissues.filter((t) => t.linked).length : null;

    return {
      rec,
      tissues,
      regions,
      info,
      paintBody,
      paintBrain,
      labelsBody,
      labelsBrain,
      panel,
      hiddenNull,
      pathwayRow,
      pathwayGenes,
      nLinked,
      brainHits: brainHits.length,
      counts: {
        enriched: tissues.length,
        tested: parsed.testedTissues.size,
        onBody: tissues.filter((t) => t.place === 'body').length,
        onBrain: brainHits.length,
        inPanel: tissues.filter((t) => t.place === 'panel').length,
      },
    };
  }, [parsed, exposure, sex, pathway, minShared, leadingEdge, available]);

  // --- the drill-in ---------------------------------------------------------
  const drill = useMemo(() => {
    if (!view || !openTissue) return null;
    const row = view.tissues.find((t) => t.term === openTissue);
    if (!row) return null;
    const genes = leadingEdge ? leadingEdge.byTerm.get(`tissue|${openTissue}`) : null;
    if (!genes) return { row, table: null, siblings: [], ranked: [], geneSet: new Set() };

    // Insertion order into the Set is the shard's row order, which is the order
    // clusterProfiler wrote core_enrichment -- i.e. the ranked list. Kept
    // separately from `list` below, which is re-sorted for the table.
    const ranked = Array.from(genes);
    if (row.dir === 'down') ranked.reverse();   // see EFFECT_SHORTLIST

    const list = Array.from(genes).map((g) => ({
      gene: g,
      tissues: leadingEdge.tissuesPerGene.get(g) || 0,
      programs: leadingEdge.pathwaysPerGene.get(g) || 0,
      inPathway: view.pathwayGenes ? (view.pathwayGenes.has(g) ? 'yes' : '—') : null,
    }));
    // Most tissue-SPECIFIC first. The payload carries no per-gene statistic --
    // every leading-edge row of a term repeats that term's NES and q -- so
    // there is nothing to rank by within the tissue. Breadth across the
    // exposure's other enriched tissues is a real quantity computed from the
    // shard, and it answers the question a reader actually has next: is this
    // protein this tissue's own signal, or the exposure's shared one?
    list.sort((a, b) => (a.tissues - b.tissues) || a.gene.localeCompare(b.gene));

    const table = {
      protein: list.map((r) => r.gene),
      'in # of this exposure’s enriched tissues': list.map((r) => r.tissues),
      'in # of its enriched pathways': list.map((r) => r.programs),
    };
    const columns = Object.keys(table);
    if (view.pathwayGenes) {
      table[`in ${view.pathwayRow.label}`] = list.map((r) => r.inPathway);
      columns.push(`in ${view.pathwayRow.label}`);
    }

    // A shared shape carries more than one tissue; the drill-in has to let the
    // reader move between them rather than pretending the organ is one result.
    const siblings = row.map
      ? (SHARED_REGIONS[row.map.region] || [])
        .filter((t) => t !== openTissue)
        .map((t) => view.tissues.find((x) => x.term === t))
        .filter(Boolean)
      : [];

    return {
      row,
      table,
      columns,
      siblings,
      ranked,
      list,
      geneSet: genes,
      nGenes: list.length,
    };
  }, [view, openTissue, leadingEdge]);

  // Follow the table. Keeping the protein when it survives a change of tissue
  // is deliberate: stepping between two tissues that share a shape, or between
  // a tissue and its pathway-narrowed self, should not throw away the profile
  // being read. Otherwise fall back to the first row rather than an empty panel.
  useEffect(() => {
    if (!drill || !drill.list || !drill.list.length) return;
    setGene((g) => (g && drill.geneSet.has(g) ? g : drill.list[0].gene));
  }, [drill]);

  // --- the GTEx expression profile of the selected protein -------------------
  // Guarded through the key index rather than fetched hopefully: getShard
  // throws on a key the published index does not carry, and 2,659 of the
  // panel's proteins have a profile, not all of them.
  const { data: profileKeys } = useKeys('protein_tissue_profile');
  const profileGene = gene && profileKeys?.keys?.[gene] ? gene : null;
  const {
    data: profileShard, loading: profileLoading, error: profileError,
  } = useShard('protein_tissue_profile', profileGene);

  const profile = useMemo(() => {
    if (!profileShard?.tissue) return null;
    const rows = [];
    for (let i = 0; i < profileShard.tissue.length; i += 1) {
      rows.push({
        tissue: profileShard.tissue[i],
        label: prettyTissue(profileShard.tissue[i]),
        tpm: num(profileShard.median_tpm?.[i]),
        n: num(profileShard.n_samples?.[i]),
        frac: num(profileShard.frac_of_max?.[i]),
      });
    }
    rows.sort((a, b) => (b.tpm ?? -1) - (a.tpm ?? -1));
    // tau and the HPA fields are constant down the shard by construction --
    // they are properties of the PROTEIN, not of the tissue -- so they are read
    // once off row 0 and shown as headline context. As 54 repeated column
    // values they would read as 54 measurements.
    const meta = {
      tau: num(profileShard.tau?.[0]),
      main: str(profileShard.hpa_main_location?.[0]),
      extra: str(profileShard.hpa_additional_location?.[0]),
      rel: str(profileShard.hpa_reliability?.[0]),
    };
    const idx = rows.findIndex((r) => r.tissue === openTissue);
    return {
      rows,
      meta,
      here: idx >= 0 ? { ...rows[idx], rank: idx + 1 } : null,
      top: rows.find((r) => r.tpm != null) || null,
      nZero: rows.filter((r) => r.tpm === 0).length,
      nHalf: rows.filter((r) => r.frac != null && r.frac >= 0.5).length,
    };
  }, [profileShard, openTissue]);

  // The lollipop itself, on the same axis treatment as TissueExplorer.js: log
  // TPM, and zeros given their own floor a decade below the smallest measured
  // value plus their own series, because a median of 0 cannot be logged and
  // must not be nudged into looking like a small measurement.
  const profilePlot = useMemo(() => {
    if (!profile?.rows.length) return null;
    const rows = profile.rows;
    const positives = rows.map((r) => r.tpm).filter((v) => v != null && v > 0);
    if (!positives.length) return null;

    const hasZero = rows.some((r) => r.tpm === 0);
    const lo = Math.min(...positives);
    const hi = Math.max(...positives);
    const zeroX = Math.max(1e-5, lo / 10);
    const axLo = hasZero ? zeroX / 2.2 : lo / 1.6;
    const axHi = hi * 1.6;

    const tickvals = [];
    const ticktext = [];
    if (hasZero) { tickvals.push(zeroX); ticktext.push('0'); }
    for (let e = -5; e <= 6; e += 1) {
      const v = 10 ** e;
      if (v >= axLo && v <= axHi) { tickvals.push(v); ticktext.push(fmtDecade(v)); }
    }

    const xOf = (r) => (r.tpm != null && r.tpm > 0 ? r.tpm : zeroX);
    // A categorical y axis runs bottom-up in the order given, so the arrays are
    // built ascending to put the strongest tissue at the top.
    const plotRows = [...rows].reverse();
    const categoryarray = plotRows.map((r) => r.label);
    const nMax = Math.max(...rows.map((r) => r.n ?? 0), 1);
    const sizeOf = (r) => 4 + 9 * Math.sqrt((r.n ?? 0) / nMax);

    const sx = [];
    const sy = [];
    plotRows.forEach((r) => {
      // The gap between stems is opened with a null X and never a null Y: a
      // null on a CATEGORICAL axis is an unnamed category, not a gap, and would
      // silently add a 55th row.
      sx.push(axLo, xOf(r), null);
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
      // The plotted x of a zero is the floor, not a measurement, so the hover
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

    const isHere = (r) => r.tissue === openTissue;
    const detected = plotRows.filter((r) => r.tpm !== 0 && !isHere(r));
    const absent = plotRows.filter((r) => r.tpm === 0 && !isHere(r));
    const here = plotRows.filter(isHere);

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
      traces, here, categoryarray, hasZero, axLo, axHi, tickvals, ticktext, sizeOf, xOf,
    };
  }, [profile, openTissue]);

  // --- top exposure-protein effect sizes for this tissue ---------------------
  const { data: assocKeys } = useKeys(assocSection);

  // The shortlist, decided from what the leading edge already gives us. See
  // EFFECT_SHORTLIST for why leading-edge order is a usable proxy and why the
  // `down` case is reversed.
  const effectPlan = useMemo(() => {
    if (!view || !drill || !exposure || !assocKeys?.keys) return null;
    const ranked = drill.ranked || [];
    if (!ranked.length) return null;
    // The pathway narrows the PROTEINS here, not just the tissues: with a
    // pathway chosen the question is which proteins carry both.
    const scoped = view.pathwayGenes ? ranked.filter((g) => view.pathwayGenes.has(g)) : ranked;
    const inIndex = scoped.filter((g) => assocKeys.keys[g]);
    return {
      genes: inIndex.slice(0, EFFECT_SHORTLIST),
      nLeading: ranked.length,
      nScoped: scoped.length,
      nInIndex: inIndex.length,
      nNoIndex: scoped.length - inIndex.length,
    };
  }, [view, drill, exposure, assocKeys]);

  const [effects, setEffects] = useState({ loading: false, error: null, rows: null, nFetched: 0 });

  // Keyed on the gene LIST rather than on the plan object. `view` re-memos on
  // things this panel does not care about -- the sex toggle above all -- and
  // depending on the object would tear the plot down and refetch every time the
  // body flipped. Gene symbols carry no commas, so the join is a safe identity.
  const effectGeneKey = effectPlan ? effectPlan.genes.join(',') : '';

  useEffect(() => {
    if (!effectGeneKey || !exposure) {
      setEffects({ loading: false, error: null, rows: null, nFetched: 0 });
      return undefined;
    }
    const genes = effectGeneKey.split(',');
    let alive = true;
    setEffects({ loading: true, error: null, rows: null, nFetched: 0 });
    Promise.all(genes.map((g) => getShard(assocSection, g)
      .then((d) => [g, d])
      .catch(() => [g, null])))
      .then((pairs) => {
        if (!alive) return;
        const rows = [];
        pairs.forEach(([g, d]) => {
          if (!d?.Exposure) return;
          // One exposure can contribute several rows: a categorical exposure is
          // fitted as one Term per level. The strongest level is the one plotted
          // and it is named, rather than averaging levels that mean different
          // things.
          let best = null;
          let nTerms = 0;
          for (let i = 0; i < d.Exposure.length; i += 1) {
            if (d.Exposure[i] !== exposure) continue;
            const beta = num(d.beta_test[i]);
            if (beta === null) continue;
            nTerms += 1;
            if (!best || Math.abs(beta) > Math.abs(best.beta)) {
              best = {
                gene: g,
                term: d.Term[i],
                beta,
                se: num(d.SE_test[i]),
                p: num(d.p_test[i]),
                n: num(d.N_test[i]),
                replicated: d.replicated[i] === true || d.replicated[i] === 'True',
              };
            }
          }
          if (best) rows.push({ ...best, nTerms });
        });
        rows.sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
        setEffects({
          loading: false, error: null, rows, nFetched: genes.length,
        });
      })
      .catch((e) => { if (alive) setEffects({ loading: false, error: e, rows: null, nFetched: 0 }); });
    return () => { alive = false; };
  }, [effectGeneKey, exposure, assocSection]);

  const effectTop = useMemo(
    () => (effects.rows ? effects.rows.slice(0, EFFECT_TOP_N) : null),
    [effects],
  );

  // --- handlers -------------------------------------------------------------
  const handleResolved = (viewKey, ids) => {
    setAvailable((prev) => (prev[viewKey] ? prev : { ...prev, [viewKey]: new Set(ids) }));
  };

  const pickRegion = (viewKey, region) => {
    const meta = view?.info.get(`${viewKey}|${region}`);
    if (!meta || meta.kind !== 'region') return;   // null shapes and the brain pointer are inert
    setOpenTissue(meta.region.lead.term);
  };

  const exposureOptions = useMemo(() => (parsed
    ? parsed.exposures.map((k) => ({ value: k, label: prettyExposure(k) }))
      .sort((a, b) => a.label.localeCompare(b.label))
    : []), [parsed]);

  const pathwayOptions = useMemo(() => (view
    ? view.rec.pathways
      .slice()
      .sort((a, b) => Math.abs(b.nes) - Math.abs(a.nes))
      .map((p) => ({
        value: p.term,
        label: `${p.label} — ${p.dir}, NES ${fmtNes(p.nes)}, ${p.nLead} proteins`,
      }))
    : []), [view]);

  // --- tooltips -------------------------------------------------------------
  const renderTooltip = (viewKey, region) => {
    const meta = view?.info.get(`${viewKey}|${region}`);
    if (!meta) return null;

    if (meta.kind === 'brainPointer') {
      return (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Brain</Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            {`${meta.n} brain subregion${meta.n === 1 ? '' : 's'} enriched — shown on the brain view beside this one.`}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            Not itself a tested tissue: GTEx scores the subregions, never a whole brain, so this
            shape is a pointer and carries no direction or NES.
          </Typography>
        </>
      );
    }

    if (meta.kind === 'null') {
      const names = meta.region.tissues.map(prettyTissue);
      return (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{names.join(' · ')}</Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            Tested against this exposure, nothing at FDR q &lt; 0.05.
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            A null result, not a missing one. Anatomy the GSEA never scored is left unpainted.
          </Typography>
        </>
      );
    }

    const r = meta.region;
    return (
      <>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {r.tissues.length > 1 ? `${r.region.replace(/_/g, ' ')} — ${r.tissues.length} tissues` : prettyTissue(r.tissues[0].term)}
        </Typography>
        {r.tissues.length > 1 && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
            One shape, more than one GTEx tissue. Both results are listed; the fill follows the
            stronger one.
          </Typography>
        )}
        {r.tissues.map((t) => (
          <Typography key={t.term} variant="caption" sx={{ display: 'block' }}>
            <b>{r.tissues.length > 1 ? prettyTissue(t.term) : 'enrichment'}</b>
            {` — NES ${fmtNes(t.nes)} (${t.dir}) · q = ${fmtQ(t.q)} · ${t.nLead} of ${t.setSize} genes in the leading edge`}
            {t.shared !== null ? ` · ${t.shared} shared with ${view.pathwayRow.label}` : ''}
          </Typography>
        ))}
        {r.mixed && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: MIXED_COLOR }}>
            The tissues on this shape point in opposite directions, so the shape is drawn in the
            mixed colour rather than picking one.
          </Typography>
        )}
        {r.approximate && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
            Indicative placement, not anatomical: the anatomogram has no tibial artery, so this
            result is shown on the nearest arterial shape.
          </Typography>
        )}
        {r.state === 'unlinked' && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            Enriched, but sharing fewer than {minShared} leading-edge protein
            {minShared === 1 ? '' : 's'} with the chosen pathway — outlined rather than filled.
          </Typography>
        )}
        {r.state === 'lit' && <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>Click for the proteins that carried it.</Typography>}
      </>
    );
  };

  const counts = view?.counts;

  return (
    <SectionCard
      title="What does this exposure touch, and which proteins carry it?"
      subtitle={
        'Pick an exposure and the body shows the tissues whose expression signature its plasma '
        + 'proteins concentrate in (GSEA, FDR q < 0.05). Click an organ for the exact proteins '
        + 'that drove that enrichment — the GSEA leading edge, not every associated protein that '
        + 'happens to be expressed there. Choosing one of the exposure’s enriched pathways narrows '
        + 'the figure to the tissues that share leading-edge proteins with it.'
      }
      loading={loading}
      error={error}
      empty={!loading && !error && !parsed}
    >
      {view && (
        <>
          {/* --- controls ------------------------------------------------- */}
          {/* One picker for the whole section. It re-runs the body map from that
              specification's GSEA and reads the effect sizes from the matching
              association export, so the two can no longer disagree. */}
          <SpecPicker
            value={spec}
            onChange={(v) => { setSpec(v); setOpenTissue(null); setGene(null); }}
            label="Covariate specification — applies to the enrichment, the leading edge and the effect sizes"
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', mb: 1.5 }}>
            <Box sx={{ flex: '1 1 360px', minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                {`Exposure (${parsed.exposures.length} with any enrichment)`}
              </Typography>
              <Select
                options={exposureOptions}
                value={exposureOptions.find((o) => o.value === exposure) || null}
                onChange={(o) => setExposure(o ? o.value : exposure)}
                isSearchable
                placeholder="Search an exposure…"
                styles={{ menu: (b) => ({ ...b, zIndex: 20 }) }}
              />
            </Box>

            <Box sx={{ flex: '1 1 360px', minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                {`Pathway (${view.rec.pathways.length} enriched for this exposure — optional)`}
              </Typography>
              <Select
                options={pathwayOptions}
                value={pathwayOptions.find((o) => o.value === pathway) || null}
                onChange={(o) => setPathway(o ? o.value : null)}
                isSearchable
                isClearable
                placeholder="All tissues — or narrow by a pathway…"
                styles={{ menu: (b) => ({ ...b, zIndex: 20 }) }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                Body
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={sex} onChange={(_, v) => v && setSex(v)}>
                <ToggleButton value="male" sx={{ textTransform: 'none', px: 1.5 }}>male</ToggleButton>
                <ToggleButton value="female" sx={{ textTransform: 'none', px: 1.5 }}>female</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {pathway && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  Shared proteins needed for a link
                </Typography>
                <ToggleButtonGroup size="small" exclusive value={minShared} onChange={(_, v) => v && setMinShared(v)}>
                  {MIN_SHARED_CHOICES.map((v) => (
                    <ToggleButton key={v} value={v} sx={{ textTransform: 'none', px: 1.5 }}>{`≥ ${v}`}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}
          </Box>

          {/* --- counts: what is enriched, and where each one ended up ----- */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <Chip
              size="small"
              color={counts.enriched ? 'primary' : 'default'}
              label={`${counts.enriched} of ${counts.tested} tested tissues enriched (q < 0.05)`}
            />
            <Chip size="small" variant="outlined" label={`${counts.onBody} on the ${sex} body`} />
            <Chip size="small" variant="outlined" label={`${counts.onBrain} on the brain view`} />
            <Chip
              size="small"
              variant="outlined"
              color={counts.inPanel ? 'warning' : 'default'}
              label={`${counts.inPanel} with no shape — in the side panel`}
            />
            {view.pathwayRow && (
              <Chip
                size="small"
                color="secondary"
                label={`${view.nLinked} of ${counts.enriched} share ≥ ${minShared} leading-edge protein${minShared === 1 ? '' : 's'} with ${view.pathwayRow.label}`}
              />
            )}
            {shardLoading && <Chip size="small" variant="outlined" label="loading leading-edge proteins…" />}
          </Box>

          {shardError && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              The leading-edge shard for this exposure did not load ({String(shardError.message || shardError)}).
              The body is still painted from the tissue enrichments, but the protein drill-in and the
              pathway link are unavailable until it does.
            </Alert>
          )}

          {view.pathwayRow && (
            <Alert severity="info" icon={false} sx={{ mb: 1.5 }}>
              <AlertTitle sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                This pathway→tissue link is computed here, and it is not the published backbone
              </AlertTitle>
              <Typography variant="body2" component="div">
                A tissue stays lit if its leading edge and <b>{view.pathwayRow.label}</b>&rsquo;s leading
                edge share at least {minShared} protein, <b>within this one exposure</b>. It is an
                intersection taken in your browser from the shard on screen, so it moves whenever the
                exposure picker moves.
                <br />
                The grey program&rarr;tissue backbone in the tripartite panel is a different quantity:
                &ge; 3 shared leading-edge genes with the same NES sign, computed in R across all 114
                exposures at once, and fixed regardless of which exposure is selected. Do not read
                one as the other.
              </Typography>
            </Alert>
          )}

          {/* --- the figure ----------------------------------------------- */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
            {/* Wider than the drawing needs, because the two gutters that hold
                the label boxes are part of this panel. */}
            <Paper variant="outlined" sx={{ flex: '1 1 430px', minWidth: 340, p: 1, bgcolor: '#fff' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                {`${sex} body — ${counts.onBody} enriched`}
              </Typography>
              <Anatomogram
                url={SVG_URL[sex]}
                regionIds={BODY_REGION_IDS}
                paint={view.paintBody}
                labels={view.labelsBody}
                minHeight={560}
                onPick={(region) => pickRegion('body', region)}
                onResolved={(ids) => handleResolved(sex, ids)}
                renderTooltip={(region) => renderTooltip('body', region)}
              />
            </Paper>

            {/* The brain sits beside the body ALWAYS, not only when a brain
                subregion is enriched. If it appeared on demand, its absence
                would read as "the brain was not tested" — which is precisely the
                not-tested / tested-null confusion the four paint states exist to
                prevent. Drawn permanently, an all-neutral brain is a visible
                null result: 13 subregions were scored and none of them hit. */}
            <Paper variant="outlined" sx={{ flex: '1 1 430px', minWidth: 340, p: 1, bgcolor: '#fff' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                {`brain subregions — ${counts.onBrain} enriched`}
              </Typography>
              <Anatomogram
                url={SVG_URL.brain}
                regionIds={BRAIN_REGION_IDS}
                paint={view.paintBrain}
                labels={view.labelsBrain}
                minHeight={360}
                onPick={(region) => pickRegion('brain', region)}
                onResolved={(ids) => handleResolved('brain', ids)}
                renderTooltip={(region) => renderTooltip('brain', region)}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                GTEx scores 13 brain subregions separately. The slate wash on the body is only a
                pointer to this panel, never a brain-level result.
              </Typography>
            </Paper>

            {/* --- side panel + legend ---------------------------------- */}
            <Box sx={{ flex: '1 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
                  Nowhere to sit on a body — lit the same way
                </Typography>
                {view.panel.length === 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Nothing for this exposure.
                  </Typography>
                )}
                {view.panel.map((entry) => (
                  <SideRow
                    key={entry.term}
                    entry={entry}
                    active={openTissue === entry.term}
                    onClick={() => setOpenTissue(entry.term)}
                  />
                ))}
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  Whole blood and the two cell lines are not places and never will be. Anything else
                  here is a real anatomical result that the drawing on screen cannot carry — sex-specific
                  tissue on the other body, or a shape this anatomogram does not have. Switch the body
                  toggle and watch it move onto the figure rather than vanish.
                  {view.hiddenNull > 0 && ` A further ${view.hiddenNull} tested tissue${view.hiddenNull === 1 ? '' : 's'} of the other sex ${view.hiddenNull === 1 ? 'is' : 'are'} null for this exposure and not listed.`}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
                  Two channels: direction, and strength
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                  {['up', 'down'].map((d) => (
                    <Box key={d} sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: DIR_COLOR[d] }}>
                        {d === 'up' ? 'up — enriched' : 'down — depleted'}
                      </Typography>
                      <Box sx={{ display: 'flex', mt: 0.25 }}>
                        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                          <Box
                            key={f}
                            sx={{
                              flex: 1,
                              height: 12,
                              bgcolor: tint(DIR_COLOR[d], TINT_FLOOR + (1 - TINT_FLOOR) * f),
                              border: '1px solid rgba(0,0,0,0.12)',
                            }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        {`|NES| ${NES_LO.toFixed(1)} → ${NES_HI.toFixed(1)}+`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {PAINT_STATES.map((s) => (
                  <Box key={s.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 0.4 }}>
                    <Box sx={{ pt: 0.25 }}>
                      <Swatch
                        color={s.id === 'null' ? NULL_STROKE : (s.id === 'untested' ? '#FFFFFF' : DIR_COLOR.up)}
                        dashed={s.id === 'unlinked'}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ lineHeight: 1.3 }}>
                      <b>{s.label}</b>
                      {` — ${s.note}`}
                    </Typography>
                  </Box>
                ))}
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  Anatomogram shapes from EBI Expression Atlas (Apache-2.0). Several GTEx tissues share
                  one shape — both adipose depots, both skin sites, both colon segments, both esophagus
                  layers — and the hover names every tissue behind a shape it lights.
                </Typography>
              </Paper>
            </Box>
          </Box>

          {/* --- drill-in --------------------------------------------------- */}
          <Box sx={{ mt: 2 }}>
            {!drill && (
              <Alert severity="info">
                Click any labelled box beside the figure — or the organ itself, or any lit row in the
                side panel — for the proteins that carried its enrichment, their effect sizes for this
                exposure, and where each one is expressed across the 54 GTEx tissues.
              </Alert>
            )}
            {drill && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 0.5 }}>
                  <Swatch color={drill.row.color} dashed={drill.row.state === 'unlinked'} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {prettyTissue(drill.row.term)}
                  </Typography>
                  <Chip size="small" variant="outlined" label={`NES ${fmtNes(drill.row.nes)} (${drill.row.dir})`} />
                  <Chip size="small" variant="outlined" label={`FDR q = ${fmtQ(drill.row.q)}`} />
                  <Chip size="small" variant="outlined" label={`${drill.row.nLead} of ${drill.row.setSize} genes in the leading edge`} />
                  <Chip size="small" variant="outlined" label="clear" onClick={() => setOpenTissue(null)} />
                </Box>

                {drill.siblings.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      shares its shape with:
                    </Typography>
                    {drill.siblings.map((s) => (
                      <Chip
                        key={s.term}
                        size="small"
                        label={`${prettyTissue(s.term)} — NES ${fmtNes(s.nes)}`}
                        onClick={() => setOpenTissue(s.term)}
                      />
                    ))}
                  </Box>
                )}

                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  The GSEA leading edge (<code>core_enrichment</code>): the ranked plasma proteins that
                  carried this tissue&rsquo;s enrichment up to its peak. Not the proteins associated with
                  the exposure that happen to be expressed here — that set ignores rank and includes
                  proteins which contributed nothing.
                  {' '}
                  Every leading-edge row of a term repeats that term&rsquo;s NES and q, so there is no
                  per-protein statistic to rank by; rows are ordered most tissue-specific first, using
                  how many of this exposure&rsquo;s other enriched tissues also carry the protein. Sort
                  the other way for the proteins this exposure moves everywhere.
                </Typography>

                {drill.table
                  ? (
                    // Click-through, rather than a second copy of the table with
                    // a callback: ColumnarTable is a shared component in another
                    // file and exposes no row handler, and duplicating it here
                    // would give two tables of one thing that could disagree.
                    // The protein is column 0 by construction (see drill.table),
                    // and the guard against the leading-edge set means a change
                    // to that component can only make this a no-op, never a
                    // wrong selection.
                    <Box
                      onClick={(ev) => {
                        const tr = ev.target.closest ? ev.target.closest('tr') : null;
                        if (!tr || tr.closest('thead')) return;
                        const cell = tr.querySelector('td');
                        const g = cell ? cell.textContent.trim() : '';
                        if (drill.geneSet.has(g)) setGene(g);
                      }}
                      sx={{ '& tbody tr': { cursor: 'pointer' } }}
                    >
                      <ColumnarTable data={drill.table} columns={drill.columns} initialRowsPerPage={10} />
                    </Box>
                  )
                  : (
                    <Alert severity="info">
                      {shardLoading
                        ? 'Loading this exposure’s leading-edge proteins…'
                        : 'No leading-edge proteins in the payload for this tissue.'}
                    </Alert>
                  )}

                {/* --- the selected protein across the 54 GTEx tissues ------- */}
                {drill.table && (
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 0.75 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {gene
                          ? `Where ${gene} is expressed — all 54 GTEx tissues`
                          : 'Where a protein is expressed — all 54 GTEx tissues'}
                      </Typography>
                      <Chip size="small" variant="outlined" label="click any row above to change protein" />
                      {profile?.meta.tau != null && (
                        <Chip
                          size="small"
                          label={`τ = ${profile.meta.tau.toFixed(2)} — ${tauBand(profile.meta.tau).word}`}
                          sx={{ bgcolor: tauBand(profile.meta.tau).color, color: '#fff', fontWeight: 700 }}
                        />
                      )}
                      {profile?.here && (
                        <Chip
                          size="small"
                          sx={{ bgcolor: drill.row.color, color: '#fff', fontWeight: 700 }}
                          label={`${prettyTissue(openTissue)}: rank ${profile.here.rank} of ${profile.rows.length} · ${fmtTpm(profile.here.tpm)} TPM`}
                        />
                      )}
                      {profile?.top && (
                        <Chip size="small" variant="outlined" label={`highest in ${profile.top.label} (${fmtTpm(profile.top.tpm)} TPM)`} />
                      )}
                      {profile && (
                        <Chip size="small" variant="outlined" label={`${profile.nHalf} of ${profile.rows.length} tissues at ≥ 50% of its maximum`} />
                      )}
                      {profile?.nZero > 0 && (
                        <Chip size="small" variant="outlined" label={`${profile.nZero} tissues with a median of 0`} />
                      )}
                    </Box>

                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                      GTEx v10 transcript expression, which is a different measurement from everything
                      above it: no exposure, no plasma and no result of this study enters it. It is here
                      to answer one question the leading edge raises and cannot settle — where does{' '}
                      <b>{prettyTissue(openTissue)}</b>, the tissue you opened, sit inside this
                      protein&rsquo;s own distribution?
                      {profile?.meta.tau != null && (
                        <>
                          {' '}τ is tissue specificity across the 54 tissues, 0 = the same level
                          everywhere, 1 = confined to one. It is one number per protein, not a column of
                          54.{' '}<b>{gene}</b> is {tauBand(profile.meta.tau).word}:{' '}
                          {tauBand(profile.meta.tau).gloss}. The distinction bears on how a plasma
                          measurement should be read: a ubiquitous, broadly secreted protein reports on
                          exposure from everywhere at once, whereas a tissue-restricted one carries a
                          plasma signal closer to a readout of that one organ.
                        </>
                      )}
                    </Typography>

                    {profileLoading && <Typography variant="body2">Loading {gene}…</Typography>}
                    {profileError && (
                      <Alert severity="warning">
                        Could not load the GTEx profile for {gene}: {String(profileError.message || profileError)}.
                      </Alert>
                    )}
                    {gene && !profileGene && profileKeys && (
                      <Alert severity="info">
                        <b>{gene}</b> has no row in <code>protein_tissue_profile</code>. The section covers
                        2,659 panel proteins; this one is not among them, so nothing is known here about
                        where it is transcribed — which is not the same as it being absent everywhere.
                      </Alert>
                    )}
                    {profile && !profilePlot && (
                      <Alert severity="warning">
                        <b>{gene}</b> has a GTEx median of 0 TPM in all {profile.rows.length} tissues, so
                        there is nothing to place on a log axis and τ is undefined for the same reason.
                      </Alert>
                    )}

                    {profilePlot && (
                      <>
                        <PlotPanel
                          data={[
                            ...profilePlot.traces,
                            // The clicked tissue, drawn last so it is on top and
                            // in the organ's own colour, which is what ties this
                            // chart back to the body above it.
                            ...(profilePlot.here.length ? [{
                              type: 'scatter',
                              mode: 'markers',
                              name: `${prettyTissue(openTissue)} — the tissue you opened`,
                              x: profilePlot.here.map(profilePlot.xOf),
                              y: profilePlot.here.map((r) => r.label),
                              customdata: profilePlot.here.map((r) => [
                                r.n == null ? '—' : r.n.toLocaleString(),
                                r.frac == null ? '—' : `${(r.frac * 100).toFixed(1)}%`,
                                r.tpm === 0 ? '0 — not detected' : fmtTpm(r.tpm),
                              ]),
                              hovertemplate: '<b>%{y}</b><br>median TPM %{customdata[2]}'
                                + '<br>share of this gene&#39;s maximum %{customdata[1]}'
                                + '<br>%{customdata[0]} GTEx donors<extra></extra>',
                              marker: {
                                size: profilePlot.here.map((r) => profilePlot.sizeOf(r) + 5),
                                color: drill.row.color,
                                symbol: 'circle',
                                line: { width: 1.6, color: '#111' },
                              },
                            }] : []),
                          ]}
                          height={Math.max(420, profile.rows.length * 16 + 140)}
                          layout={{
                            shapes: profile.here ? [{
                              // Band behind the row, in category coordinates:
                              // with categoryarray set, a category's numeric
                              // position is its index in that array.
                              type: 'rect',
                              xref: 'paper',
                              x0: 0,
                              x1: 1,
                              yref: 'y',
                              y0: profilePlot.categoryarray.indexOf(profile.here.label) - 0.5,
                              y1: profilePlot.categoryarray.indexOf(profile.here.label) + 0.5,
                              fillcolor: tint(drill.row.color, 0.12),
                              line: { width: 0 },
                              layer: 'below',
                            }] : [],
                            xaxis: {
                              title: 'GTEx median TPM (log10 scale)',
                              type: 'log',
                              range: [Math.log10(profilePlot.axLo), Math.log10(profilePlot.axHi)],
                              tickmode: 'array',
                              tickvals: profilePlot.tickvals,
                              ticktext: profilePlot.ticktext,
                              automargin: true,
                            },
                            yaxis: {
                              categoryorder: 'array',
                              categoryarray: profilePlot.categoryarray,
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
                          Dot area scales with the number of GTEx donors behind that tissue&rsquo;s median; a
                          median over a dozen donors is a far softer number than one over several hundred.
                          {profilePlot.hasZero && ' A median of exactly 0 cannot be placed on a log axis, so '
                            + 'those tissues are drawn as their own series on the tick labelled 0, one decade '
                            + 'below the smallest measured value — they are not a small measurement.'}
                          {!profile.here && ` ${prettyTissue(openTissue)} is not one of the 54 GTEx tissues in `
                            + 'this profile, so no row is highlighted.'}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          <b>Subcellular location (Human Protein Atlas):</b>{' '}
                          {profile.meta.main ? (
                            <>
                              {profile.meta.main.replace(/;/g, '; ')}
                              {profile.meta.extra ? ` (also ${profile.meta.extra.replace(/;/g, '; ')})` : ''}
                              {profile.meta.rel ? ` — ${profile.meta.rel.toLowerCase()} reliability` : ''}
                            </>
                          ) : (
                            <Box component="span" sx={{ color: 'text.secondary' }}>
                              not annotated in HPA — 860 of the 2,659 panel proteins have no HPA subcellular
                              record at all, so this is a gap in the annotation, not a protein without a location.
                            </Box>
                          )}
                        </Typography>
                      </>
                    )}
                  </Box>
                )}

                {/* --- effect sizes for the top proteins of this tissue ------ */}
                {drill.table && (
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 0.75 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {`How strongly does ${prettyExposure(exposure)} move these proteins?`}
                      </Typography>
                      {effectTop && effects.rows && (
                        <Chip
                          size="small"
                          color="primary"
                          label={`top ${effectTop.length} by |β| of the ${effects.rows.length} estimated`}
                        />
                      )}
                      {effectPlan && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`shortlist ${effects.nFetched || effectPlan.genes.length} of ${effectPlan.nScoped} leading-edge proteins`}
                        />
                      )}
                      {effectPlan?.nNoIndex > 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="warning"
                          label={`${effectPlan.nNoIndex} with no association row — missing, not zero`}
                        />
                      )}
                      {effects.loading && <Chip size="small" variant="outlined" label="fetching effect sizes…" />}
                    </Box>

                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1 }}>
                      Effect sizes follow the <b>{specLabel}</b> specification chosen at the top of
                      this section, the same model the enrichment above was run under.
                    </Typography>

                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                      Held-out β with a 95% Wald interval (β ± 1.96 × SE), from the test split — the same
                      estimate the rest of the site plots, never the discovery-split β.
                      {' '}
                      Ranking by |β| needs the βs, and the association sections are sharded by <i>protein</i>,
                      so the ten are found in two passes rather than by fetching the whole leading edge: the
                      leading edge is stored in GSEA ranked-list order, so the first{' '}
                      {effectPlan ? effectPlan.genes.length : EFFECT_SHORTLIST} of it are fetched
                      {drill.row.dir === 'down' ? ' (read from the far end, since this is a depleted set)' : ''}
                      {' '}and then re-ranked by the β actually returned. That proxy has a median |ρ| of about
                      0.85 against |β|, not 1, so a protein just outside the shortlist can outrank one inside it.
                      {' '}
                      Adjusting for BMI or the clinical covariates attenuates many adiposity-linked effects;
                      attenuation under adjustment cannot on its own separate mediation from confounding, so
                      read the specification buttons as a sensitivity check rather than a mechanism.
                    </Typography>

                    {effects.error && (
                      <Alert severity="warning">
                        The {specLabel} association shards did not load
                        ({String(effects.error.message || effects.error)}).
                      </Alert>
                    )}

                    {effectTop && effectTop.length > 0 && (
                      <>
                        <PlotPanel
                          data={['replicated', 'nominal'].map((kind) => {
                            const subset = effectTop.filter((r) => (kind === 'replicated' ? r.replicated : !r.replicated));
                            const color = (r) => (r.beta >= 0 ? DIR_COLOR.up : DIR_COLOR.down);
                            return {
                              type: 'scatter',
                              mode: 'markers',
                              name: kind === 'replicated'
                                ? 'replicated (Bonferroni in both splits)'
                                : 'discovery hit, not replicated in the held-out split',
                              x: subset.map((r) => r.beta),
                              y: subset.map((r) => r.gene),
                              error_x: {
                                type: 'data',
                                array: subset.map((r) => (r.se == null ? 0 : 1.96 * r.se)),
                                thickness: 1.2,
                                width: 3,
                                color: 'rgba(90,90,90,0.65)',
                              },
                              customdata: subset.map((r) => [
                                fmtBeta(r.beta),
                                r.se == null ? '—' : `${fmtBeta(r.beta - 1.96 * r.se)} to ${fmtBeta(r.beta + 1.96 * r.se)}`,
                                fmtP(r.p),
                                r.n == null ? '—' : r.n.toLocaleString(),
                                r.nTerms > 1 ? `strongest of ${r.nTerms} levels — ${r.term}` : r.term,
                              ]),
                              hovertemplate: '<b>%{y}</b><br>β %{customdata[0]}  95% CI %{customdata[1]}'
                                + '<br>p (held-out) %{customdata[2]}<br>N test %{customdata[3]}'
                                + '<br>%{customdata[4]}<extra></extra>',
                              marker: {
                                size: 11,
                                color: kind === 'replicated' ? subset.map(color) : '#fff',
                                line: { width: 1.6, color: subset.map(color) },
                                symbol: 'circle',
                              },
                            };
                          }).filter((t) => t.x.length)}
                          height={Math.max(280, effectTop.length * 34 + 130)}
                          layout={{
                            xaxis: {
                              title: `held-out exposure→protein β, 95% CI — ${specLabel}`,
                              zeroline: true,
                              zerolinecolor: '#999',
                              zerolinewidth: 1,
                              automargin: true,
                            },
                            yaxis: {
                              categoryorder: 'array',
                              // Built in reverse so the largest |β| is the top row.
                              categoryarray: [...effectTop].reverse().map((r) => r.gene),
                              automargin: true,
                              ticks: '',
                            },
                            margin: { l: 100, r: 30, t: 46, b: 60 },
                            showlegend: true,
                            legend: { orientation: 'h', yanchor: 'bottom', y: 1.002, x: 0, font: { size: 10 } },
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                          {`Red where the exposure raises the protein, blue where it lowers it — the same direction grammar as the body. Filled markers replicated in the held-out split; open markers are discovery hits that did not. `}
                          {view.pathwayRow && effectPlan
                            ? `Restricted to the ${effectPlan.nScoped} of this tissue's ${effectPlan.nLeading} leading-edge proteins that are also in ${view.pathwayRow.label}. `
                            : `Drawn from this tissue's ${effectPlan ? effectPlan.nLeading : 0} leading-edge proteins. `}
                          {effectPlan?.nNoIndex > 0 && `${effectPlan.nNoIndex} of those have no association row for any exposure in the ${specLabel} export and cannot be plotted — that is missing data, not an effect of zero. `}
                          {effects.rows && effects.nFetched > effects.rows.length
                            && `${effects.nFetched - effects.rows.length} of the ${effects.nFetched} fetched carry no row for this exposure specifically, and are likewise absent rather than zero. `}
                          {'A categorical exposure is fitted one term per level; the strongest level is the one plotted and the hover names it.'}
                        </Typography>
                      </>
                    )}

                    {!effects.loading && !effects.error && effectTop && effectTop.length === 0 && (
                      <Alert severity="info">
                        <AlertTitle sx={{ fontSize: '0.85rem' }}>
                          No individual association to plot — but the enrichment above still stands
                        </AlertTitle>
                        {effectPlan?.genes?.length
                          ? <>The shortlisted proteins here are <b>{effectPlan.genes.join(', ')}</b>. None
                            of them has</>
                          : <>None of the {effects.nFetched} shortlisted proteins has</>}
                        {' '}an association row for <b>{prettyExposure(exposure)}</b> in the{' '}
                        {specLabel} export, which carries only the pairs that cleared this
                        exposure&apos;s discovery threshold.
                        {' '}
                        <b>That is not a contradiction with the enrichment.</b> GSEA scores the whole
                        ranked list of tested proteins, so a protein reaches the leading edge by sitting
                        near the top of the ranking together with the rest of its set — it never had to
                        be individually significant. This exposure has more leading-edge proteins than
                        it has rows in the association export, so this combination is expected rather
                        than rare: the set moves coherently while no single member clears the
                        per-protein bar.
                      </Alert>
                    )}
                  </Box>
                )}
              </Paper>
            )}
          </Box>
        </>
      )}
    </SectionCard>
  );
}
