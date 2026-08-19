import React, { useMemo, useState } from 'react';
import Select from 'react-select';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Chip, Alert } from '@mui/material';
import SectionCard from '../../components/SectionCard';
import ColumnarTable from '../../components/ColumnarTable';
import PlotPanel from '../../components/PlotPanel';
import { useSection, useKeys, useShard } from '../../lib/useSection';
import { ecatColor, prettyExposure, prettyCategory } from '../../lib/palette';

// The packer recovers whole-column types, so a TSV "TRUE" arrives as a real
// JSON boolean. Accept either form rather than assuming one.
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

// The three external trials, keyed the way each payload spells them.
// `key` is the value of `intervention` in intervention_scatter; `col` is the
// wide column name in glp1_exercise / glp1_diet / glp1_smoking; `cmp` is the
// value of `intervention` in intervention_compare.
const TRIALS = [
  { key: 'HERITAGE', col: 'HERITAGE_effect', cmp: 'HERITAGE_effect', label: 'HERITAGE', note: 'exercise training' },
  { key: 'GLP1 STEP1', col: 'GLP1_effect1', cmp: 'GLP1_effect1', label: 'STEP 1', note: 'GLP-1 receptor agonist' },
  { key: 'GLP1 STEP2', col: 'GLP1_effect2', cmp: 'GLP1_effect2', label: 'STEP 2', note: 'GLP-1 receptor agonist' },
];

// The three exemplar signatures shipped as their own sections, each one
// exposure's full replicated protein set carrying the MR annotation that
// intervention_scatter does not have.
const EXEMPLARS = [
  { id: 'glp1_exercise', label: 'Exercise' },
  { id: 'glp1_diet', label: 'Diet' },
  { id: 'glp1_smoking', label: 'Smoking' },
];

// mr_support = which MR arm carried the protein->disease edge (annotate_mr.R).
const MR_SUPPORT_COLOR = {
  Both: '#7B3FA0', 'UKB only': '#1B6CA8', 'DECODE only': '#E07B39', None: '#BDBDBD',
};
const MR_SUPPORT_ORDER = ['Both', 'UKB only', 'DECODE only', 'None'];
// mr_edge_sig = which edge type is the strongest for that protein.
const MR_EDGE_COLOR = {
  PDcis: '#1B6CA8', PDtrans: '#E07B39', DP: '#7B3FA0', None: '#BDBDBD',
};
const MR_EDGE_ORDER = ['PDcis', 'PDtrans', 'DP', 'None'];

// r is signed, so the scale must be diverging and centred on zero.
const DIVERGING = [
  [0, '#2166ac'], [0.25, '#92c5de'], [0.5, '#f7f7f7'],
  [0.75, '#f4a582'], [1, '#b2182b'],
];

// A model term is "<field>_f<code>_<instance>_<array>" with the factor level
// glued on the end, so prettyExposure() alone collapses every level of a field
// onto one label. Keep the level so the 65 rows of the heatmap stay distinct.
const ID_RE = /^(.*)_f(\d+)_(\d+)_(\d)(.*)$/;

function termLabel(id) {
  const s = String(id);
  const m = s.match(ID_RE);
  if (!m) return prettyExposure(s);
  const base = m[1].replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const lvl = m[5]
    .replace(/^[._]+/, '')
    .replace(/^multi_/, '')
    .replace(/[._]+/g, ' ')
    .trim();
  if (!lvl) return base;
  return /^\d+$/.test(lvl) ? `${base} (level ${lvl})` : `${base} (${lvl})`;
}

/** Columnar subset at the given row indices. */
const pick = (data, idx) => Object.fromEntries(
  Object.keys(data).map((c) => [c, idx.map((i) => data[c][i])])
);

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Olink<->SomaScan cross-platform correlation over one displayed set. */
function concordance(values) {
  const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(Number(x)))
    .map(Number).sort((a, b) => a - b);
  return {
    n: v.length,
    missing: values.length - v.length,
    median: quantile(v, 0.5),
    q1: quantile(v, 0.25),
    q3: quantile(v, 0.75),
    weak: v.filter((x) => x < 0.5).length,
  };
}

const num = (v, d = 3) => (v === null || v === undefined || !Number.isFinite(Number(v))
  ? '—' : Number(v).toFixed(d));

// ---------------------------------------------------------------------------
// 1. HEAP effect vs trial effect, one point per protein
// ---------------------------------------------------------------------------
function ScatterSection() {
  const [exposure, setExposure] = useState('pack_years_of_smoking_f20161_0_0');
  const [trialKey, setTrialKey] = useState('GLP1 STEP1');

  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('intervention_scatter');
  const { data, loading, error } = useShard('intervention_scatter', exposure);
  const trial = TRIALS.find((t) => t.key === trialKey);

  const options = useMemo(
    () => (keyIndex
      ? Object.keys(keyIndex.keys).sort().map((k) => ({ value: k, label: termLabel(k) }))
      : []),
    [keyIndex]
  );

  const view = useMemo(() => {
    if (!data) return null;
    const idx = data.protein
      .map((_, i) => i)
      .filter((i) => data.intervention[i] === trialKey
        && Number.isFinite(Number(data.beta_HEAP[i]))
        && Number.isFinite(Number(data.effect[i])));
    const sub = pick(data, idx);
    const xs = sub.beta_HEAP.map(Number);
    const ys = sub.effect.map(Number);
    const conc = concordance(sub.olink_soma_r);
    const nTestedHere = data.protein.length;
    const trialsPresent = [...new Set(data.intervention)];

    if (!idx.length) {
      return { rows: sub, traces: [], n: 0, conc, nTestedHere, trialsPresent };
    }
    const lo = Math.min(...xs, ...ys);
    const hi = Math.max(...xs, ...ys);
    const pad = (hi - lo) * 0.06 || 0.05;

    const traces = [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'y = x',
        x: [lo - pad, hi + pad],
        y: [lo - pad, hi + pad],
        line: { color: '#999', width: 1, dash: 'dash' },
        hoverinfo: 'skip',
        showlegend: true,
      },
      {
        type: 'scatter',
        mode: 'markers',
        name: `proteins (n = ${idx.length})`,
        x: xs,
        y: ys,
        error_x: {
          type: 'data',
          array: sub.se_HEAP.map(Number),
          visible: true,
          color: 'rgba(27,108,168,0.35)',
          thickness: 0.8,
          width: 0,
        },
        customdata: idx.map((_, j) => [
          sub.protein[j], xs[j], Number(sub.se_HEAP[j]), ys[j],
          sub.olink_soma_r[j] === null || sub.olink_soma_r[j] === undefined
            ? 'not in the concordance table' : Number(sub.olink_soma_r[j]).toFixed(2),
        ]),
        hovertemplate:
          '<b>%{customdata[0]}</b>'
          + '<br>UKB β = %{customdata[1]:.4f} ± %{customdata[2]:.4f}'
          + '<br>trial effect = %{customdata[3]:.4f}'
          + '<br>Olink–SomaScan r = %{customdata[4]}<extra></extra>',
        marker: {
          size: 7,
          color: '#1B6CA8',
          opacity: sub.olink_soma_r.map((r) => {
            const v = Number(r);
            return Number.isFinite(v) ? 0.25 + 0.7 * Math.max(0, Math.min(1, v)) : 0.25;
          }),
          line: { width: 0 },
        },
      },
    ];
    return { rows: sub, traces, n: idx.length, conc, nTestedHere, trialsPresent };
  }, [data, trialKey]);

  return (
    <SectionCard
      title="UKB observational effect versus trial effect"
      subtitle="One point per protein: the HEAP exposure–protein effect in UK Biobank on x, the reported trial effect on y. Horizontal bars are the standard error of the UKB effect; the dashed line is y = x. Point opacity tracks the protein's Olink–SomaScan cross-platform correlation."
      loading={kLoading || loading}
      error={kError || error}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ minWidth: 380 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Exposure</Typography>
          <Select
            options={options}
            value={{ value: exposure, label: termLabel(exposure) }}
            onChange={(o) => setExposure(o.value)}
            isSearchable
            placeholder="Search an exposure…"
          />
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Intervention
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={trialKey}
            onChange={(e, v) => v && setTrialKey(v)}
          >
            {TRIALS.map((t) => (
              <ToggleButton key={t.key} value={t.key} sx={{ textTransform: 'none' }}>
                {t.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" color="primary" label={`${view.n} protein${view.n === 1 ? '' : 's'} in both`} />
            <Chip size="small" variant="outlined" label={`${view.nTestedHere} exposure–trial row${view.nTestedHere === 1 ? '' : 's'} for this exposure`} />
            <Chip size="small" variant="outlined" label={`${trial.label} — ${trial.note}`} />
            {view.n > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`Olink–SomaScan r: median ${num(view.conc.median, 2)} (IQR ${num(view.conc.q1, 2)}–${num(view.conc.q3, 2)})`}
              />
            )}
          </Box>

          {view.n === 0 ? (
            <Alert severity="info" sx={{ my: 2 }}>
              No protein is shared between this exposure&apos;s replicated UKB signature and the
              proteins {trial.label} reports, so nothing is plotted. This is an <b>absence of
              overlap</b>, not a comparison that came out null.{' '}
              {view.trialsPresent.length
                ? `This exposure does overlap: ${view.trialsPresent.join(', ')}.`
                : 'This exposure overlaps none of the three trials.'}
            </Alert>
          ) : (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Olink–SomaScan concordance for the {view.n} proteins plotted: median r ={' '}
                {num(view.conc.median, 3)} (IQR {num(view.conc.q1, 3)}–{num(view.conc.q3, 3)});{' '}
                {view.conc.weak} of {view.conc.n} have r &lt; 0.5
                {view.conc.missing ? `; ${view.conc.missing} are absent from the concordance table` : ''}.
              </Typography>
              <PlotPanel
                data={view.traces}
                height={520}
                layout={{
                  xaxis: { title: 'UKB observational effect (β, Olink)', zeroline: true, zerolinecolor: '#e6e6e6' },
                  yaxis: { title: `${trial.label} trial effect (SomaScan)`, zeroline: true, zerolinecolor: '#e6e6e6' },
                  title: { text: `${termLabel(exposure)} — ${trial.label}`, font: { size: 13 } },
                  legend: { orientation: 'h', y: -0.16, font: { size: 10 } },
                  margin: { b: 90 },
                }}
              />
              <ColumnarTable data={view.rows} initialRowsPerPage={10} />
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 2. exposure x intervention correlation heatmap
// ---------------------------------------------------------------------------
function CompareSection() {
  const { data, loading, error } = useSection('intervention_compare');

  const view = useMemo(() => {
    if (!data) return null;
    const ids = [...new Set(data.exposure_id)];
    const cols = TRIALS.map((t) => t.cmp);
    const cell = new Map();
    for (let i = 0; i < data.exposure_id.length; i += 1) {
      cell.set(`${data.exposure_id[i]}||${data.intervention[i]}`, i);
    }
    const breadth = new Map(ids.map((id) => [
      id,
      cols.reduce((acc, c) => {
        const i = cell.get(`${id}||${c}`);
        const r = i === undefined ? null : data.r[i];
        return acc + (r === null || r === undefined ? 0 : Math.abs(Number(r)));
      }, 0),
    ]));
    ids.sort((a, b) => breadth.get(a) - breadth.get(b));

    const y = ids.map(termLabel);
    const x = TRIALS.map((t) => t.label);
    const z = ids.map((id) => cols.map((c) => {
      const i = cell.get(`${id}||${c}`);
      const r = i === undefined ? null : data.r[i];
      return r === null || r === undefined ? null : Number(r);
    }));
    const hover = ids.map((id) => cols.map((c) => {
      const i = cell.get(`${id}||${c}`);
      if (i === undefined) return 'not estimated';
      const r = data.r[i];
      if (r === null || r === undefined) {
        return `not estimated (effective N = ${num(data.n_eff[i], 1)}, below the stability floor)`;
      }
      return `r = ${num(r, 3)}<br>BH p = ${num(data.pval_BH[i], 4)}`
        + `<br>raw p = ${num(data.pval[i], 4)}<br>effective N = ${num(data.n_eff[i], 1)}`
        + `<br>BH p < 0.05: ${data.star[i] === '*' ? 'yes' : 'no'}`;
    }));

    const starX = [];
    const starY = [];
    ids.forEach((id, r) => cols.forEach((c, k) => {
      const i = cell.get(`${id}||${c}`);
      if (i !== undefined && data.star[i] === '*') { starX.push(x[k]); starY.push(y[r]); }
    }));

    const lim = Math.max(...z.flat().filter((v) => v !== null).map(Math.abs));
    const nBlank = z.flat().filter((v) => v === null).length;
    const nCells = z.flat().length;
    const allSigAny = data.sig_any.every(isTrue);

    return {
      traces: [
        {
          type: 'heatmap',
          x, y, z,
          zmin: -lim,
          zmax: lim,
          colorscale: DIVERGING,
          hoverongaps: false,
          text: hover,
          colorbar: { title: 'weighted r', thickness: 12, len: 0.6 },
          hovertemplate: '%{y}<br>%{x}<br>%{text}<extra></extra>',
        },
        {
          type: 'scatter',
          mode: 'markers',
          name: 'BH p < 0.05',
          x: starX,
          y: starY,
          marker: { size: 5, color: '#111', symbol: 'circle' },
          hoverinfo: 'skip',
        },
      ],
      nExp: ids.length,
      nCells,
      nStar: starX.length,
      nBlank,
      allSigAny,
      height: Math.max(420, ids.length * 16 + 140),
    };
  }, [data]);

  return (
    <SectionCard
      title="Signature-level concordance, exposure by intervention"
      subtitle="Reliability-weighted correlation between each exposure's replicated UKB protein signature and each trial's reported protein effects. Each protein is weighted by its Olink–SomaScan cross-platform correlation (weight = max(r, 0)), and effective N is the sample size after that weighting."
      loading={loading}
      error={error}
    >
      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label={`${view.nExp} exposure terms × 3 trials`} />
            <Chip size="small" color="primary" label={`${view.nStar} of ${view.nCells} cells at BH p < 0.05`} />
            <Chip size="small" variant="outlined" label={`${view.nBlank} cells not estimated`} />
          </Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Two different empty states are on this map. A <b>blank cell</b> means the correlation was
            not estimated: its effective N fell below the stability floor, so it is excluded from the
            multiple-testing family as well. A <b>coloured cell without a dot</b> was estimated and
            tested, and did not reach BH p &lt; 0.05.
            {view.allSigAny && ' Rows are limited to exposures reaching BH p < 0.05 in at least one'
              + ' trial (the sig_any flag), so exposures concordant with none of the three are'
              + ' absent from this section entirely.'}
          </Alert>
          <PlotPanel
            data={view.traces}
            height={view.height}
            layout={{
              xaxis: { automargin: true, ticks: '', side: 'top' },
              yaxis: { automargin: true, ticks: '', tickfont: { size: 9 } },
              legend: { orientation: 'h', y: -0.04, font: { size: 10 } },
              margin: { l: 320, r: 20, t: 50, b: 40 },
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 3. exemplar signatures, carrying the MR annotation
// ---------------------------------------------------------------------------
function ExemplarSection() {
  const [which, setWhich] = useState('glp1_exercise');
  const [trialKey, setTrialKey] = useState('HERITAGE');
  const { data, loading, error } = useSection(which);
  const trial = TRIALS.find((t) => t.key === trialKey);

  const view = useMemo(() => {
    if (!data) return null;
    const col = TRIALS.find((t) => t.key === trialKey).col;
    const idx = data.protein
      .map((_, i) => i)
      .filter((i) => Number.isFinite(Number(data.beta_HEAP[i]))
        && data[col][i] !== null && data[col][i] !== undefined
        && Number.isFinite(Number(data[col][i])));
    const sub = pick(data, idx);
    const groups = MR_SUPPORT_ORDER.filter((g) => sub.mr_support.includes(g));
    const traces = groups.map((g) => {
      const j = sub.protein.map((_, k) => k).filter((k) => sub.mr_support[k] === g);
      return {
        type: 'scatter',
        mode: 'markers',
        name: `${g} (${j.length})`,
        x: j.map((k) => Number(sub.beta_HEAP[k])),
        y: j.map((k) => Number(sub[col][k])),
        error_x: {
          type: 'data',
          array: j.map((k) => Number(sub.se_HEAP[k])),
          visible: true,
          color: 'rgba(120,120,120,0.35)',
          thickness: 0.8,
          width: 0,
        },
        customdata: j.map((k) => [
          sub.protein[k], Number(sub.beta_HEAP[k]), Number(sub[col][k]),
          sub.mr_edge_sig[k], sub.best_disease[k] || 'none', sub.n_dz_edge[k],
          sub.olink_soma_r[k] === null || sub.olink_soma_r[k] === undefined
            ? 'not in the concordance table' : Number(sub.olink_soma_r[k]).toFixed(2),
        ]),
        hovertemplate:
          '<b>%{customdata[0]}</b>'
          + '<br>UKB β = %{customdata[1]:.4f}'
          + '<br>trial effect = %{customdata[2]:.4f}'
          + '<br>MR edge: %{customdata[3]} · best disease: %{customdata[4]}'
          + '<br>diseases carrying that edge: %{customdata[5]}'
          + '<br>Olink–SomaScan r = %{customdata[6]}<extra>%{fullData.name}</extra>',
        marker: { size: 8, color: MR_SUPPORT_COLOR[g] || '#BDBDBD', opacity: 0.85, line: { width: 0 } },
      };
    });
    const xs = sub.beta_HEAP.map(Number);
    const ys = sub[col].map(Number);
    if (idx.length) {
      const lo = Math.min(...xs, ...ys);
      const hi = Math.max(...xs, ...ys);
      const pad = (hi - lo) * 0.06 || 0.05;
      traces.unshift({
        type: 'scatter',
        mode: 'lines',
        name: 'y = x',
        x: [lo - pad, hi + pad],
        y: [lo - pad, hi + pad],
        line: { color: '#999', width: 1, dash: 'dash' },
        hoverinfo: 'skip',
      });
    }
    return {
      traces,
      rows: sub,
      n: idx.length,
      nSignature: data.protein.length,
      category: data.Category[0],
      exposureId: data.exposure_id[0],
      conc: concordance(sub.olink_soma_r),
    };
  }, [data, trialKey]);

  return (
    <SectionCard
      title="Exemplar signatures with Mendelian-randomization annotation"
      subtitle="The full replicated protein signature of one exposure, plotted against one trial and coloured by which MR arm carried that protein's strongest protein–disease edge. Proteins the trial does not report are absent from the plot but present in the table."
      loading={loading}
      error={error}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Exposure signature
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={which}
            onChange={(e, v) => v && setWhich(v)}
          >
            {EXEMPLARS.map((s) => (
              <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none' }}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Intervention
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={trialKey}
            onChange={(e, v) => v && setTrialKey(v)}
          >
            {TRIALS.map((t) => (
              <ToggleButton key={t.key} value={t.key} sx={{ textTransform: 'none' }}>
                {t.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={prettyCategory(view.category)}
              sx={{ bgcolor: ecatColor(view.category), color: '#fff' }}
            />
            <Chip size="small" variant="outlined" label={termLabel(view.exposureId)} />
            <Chip size="small" variant="outlined" label={`${view.nSignature} proteins in the signature`} />
            <Chip size="small" color="primary" label={`${view.n} also reported by ${trial.label}`} />
          </Box>
          {view.n === 0 ? (
            <Alert severity="info" sx={{ my: 2 }}>
              None of this signature&apos;s {view.nSignature} proteins appears in the {trial.label}{' '}
              report, so there is no overlap to plot. The signature itself is in the table below.
            </Alert>
          ) : (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Olink–SomaScan concordance for the {view.n} overlapping proteins: median r ={' '}
                {num(view.conc.median, 3)} (IQR {num(view.conc.q1, 3)}–{num(view.conc.q3, 3)}).
              </Typography>
              <PlotPanel
                data={view.traces}
                height={480}
                layout={{
                  xaxis: { title: 'UKB observational effect (β, Olink)', zeroline: true, zerolinecolor: '#e6e6e6' },
                  yaxis: { title: `${trial.label} trial effect (SomaScan)`, zeroline: true, zerolinecolor: '#e6e6e6' },
                  legend: { orientation: 'h', y: -0.18, font: { size: 10 }, title: { text: 'MR arm' } },
                  margin: { b: 100 },
                }}
              />
            </>
          )}
          <ColumnarTable data={data} initialRowsPerPage={10} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 4. proteins carrying an MR edge, for the four behaviour panels
// ---------------------------------------------------------------------------
function MrEdgeSection() {
  const { data, loading, error } = useSection('glp1_heritage_mr');

  const view = useMemo(() => {
    if (!data) return null;
    const panels = [...new Set(data.panel)].sort();
    const kinds = MR_EDGE_ORDER.filter((k) => data.mr_edge_sig.includes(k));
    const traces = kinds.map((k) => ({
      type: 'bar',
      name: k,
      x: panels,
      y: panels.map((p) => new Set(
        data.protein.filter((_, i) => data.panel[i] === p && data.mr_edge_sig[i] === k)
      ).size),
      marker: { color: MR_EDGE_COLOR[k] || '#BDBDBD' },
      hovertemplate: '%{x}<br>%{y} proteins<extra>%{fullData.name}</extra>',
    }));
    const diseases = [...new Set(data.disease)];
    const nEdge = new Set(
      data.protein.filter((_, i) => data.mr_edge_sig[i] !== 'None')
    ).size;
    return { traces, panels, diseases, nEdge, nProt: new Set(data.protein).size };
  }, [data]);

  return (
    <SectionCard
      title="MR edge type behind each behaviour signature"
      subtitle="For the four behaviours that appear in both the trial comparison and the MR triads, how many distinct proteins carry each edge type. PDcis and PDtrans are protein→disease edges instrumented on cis and trans variants; DP is the reverse disease→protein edge; None means the protein carries no significant edge for this disease."
      loading={loading}
      error={error}
    >
      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label={`${view.nProt} distinct proteins`} />
            <Chip size="small" color="primary" label={`${view.nEdge} with an MR edge`} />
            <Chip size="small" variant="outlined" label={`disease: ${view.diseases.join(', ')}`} />
          </Box>
          <PlotPanel
            data={view.traces}
            height={380}
            layout={{
              barmode: 'group',
              xaxis: { automargin: true, tickangle: -15 },
              yaxis: { title: 'proteins' },
              legend: { orientation: 'h', y: -0.24, font: { size: 10 }, title: { text: 'edge type' } },
              margin: { b: 110 },
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 5. the two health-behaviour protein arms
// ---------------------------------------------------------------------------
function ArmsSection() {
  const { data, loading, error } = useSection('health_behavior_arms');

  const view = useMemo(() => {
    if (!data) return null;
    const clean = (s) => String(s).replace(/\s*\n\s*/g, ' ');
    const arms = [...new Set(data.arm)].sort();
    const armOf = new Map();
    data.protein.forEach((p, i) => armOf.set(p, data.arm[i]));
    const proteins = [...new Set(data.protein)]
      .sort((a, b) => {
        const c = arms.indexOf(armOf.get(a)) - arms.indexOf(armOf.get(b));
        return c || String(a).localeCompare(String(b));
      });
    const exposures = [...new Set(data.exposure)].sort();
    const at = new Map();
    for (let i = 0; i < data.protein.length; i += 1) {
      at.set(`${data.protein[i]}||${data.exposure[i]}`, Number(data.beta[i]));
    }
    const z = proteins.map((p) => exposures.map((e) => {
      const v = at.get(`${p}||${e}`);
      return v === undefined ? null : v;
    }));
    const text = proteins.map((p) => exposures.map(() => clean(armOf.get(p))));
    const lim = Math.max(...z.flat().filter((v) => v !== null).map(Math.abs));
    return {
      traces: [{
        type: 'heatmap',
        x: exposures,
        y: proteins.map((p) => `${p}`),
        z,
        zmin: -lim,
        zmax: lim,
        colorscale: DIVERGING,
        hoverongaps: false,
        text,
        colorbar: { title: 'β', thickness: 12, len: 0.6 },
        hovertemplate: '%{y} · %{x}<br>β = %{z:.3f}<br>arm: %{text}<extra></extra>',
      }],
      nProt: proteins.length,
      nExp: exposures.length,
      arms: arms.map(clean),
      nBlank: z.flat().filter((v) => v === null).length,
    };
  }, [data]);

  return (
    <SectionCard
      title="Health-behaviour protein arms in UK Biobank"
      subtitle="Replicated standardized effects (β, averaged across a field's levels) for two predefined protein sets against ten exposures whose direction is unambiguous. Observational UK Biobank effects only — no trial data enters this panel."
      loading={loading}
      error={error}
    >
      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label={`${view.nProt} proteins × ${view.nExp} exposures`} />
            {view.arms.map((a) => <Chip key={a} size="small" variant="outlined" label={a} />)}
            <Chip size="small" variant="outlined" label={`${view.nBlank} cells with no replicated effect`} />
          </Box>
          <PlotPanel
            data={view.traces}
            height={520}
            layout={{
              xaxis: { automargin: true, tickangle: -40, ticks: '' },
              yaxis: { automargin: true, ticks: '' },
              margin: { l: 110, b: 150, t: 20 },
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} />
        </>
      )}
    </SectionCard>
  );
}

export default function Intervention() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 2, maxWidth: 900 }}>
        HEAP&apos;s lifestyle signatures are observational associations measured in UK Biobank. This
        page places them next to protein effects reported by two randomized interventions:
        HERITAGE, an exercise-training trial, and STEP 1 / STEP 2, trials of a GLP-1 receptor
        agonist. Everything below is a comparison of effect estimates from separate studies and
        separate assay platforms.
      </Typography>

      <Alert severity="warning" sx={{ mb: 3, maxWidth: 1000 }}>
        <b>Cross-platform comparison.</b> UK Biobank protein levels are measured on Olink; the
        HERITAGE and STEP reports are SomaScan. The comparison is therefore restricted to the
        proteins measured on both, and every protein carries its Olink–SomaScan cross-platform
        correlation (<code>olink_soma_r</code>). That value is shown per point in the hover, and
        summarized for each displayed set directly under its plot; the signature-level correlations
        are reliability-weighted by it (weight = max(r, 0)), with an effective N reported alongside.
        Read no agreement or disagreement between trial and observational estimates without it.
      </Alert>

      <ScatterSection />
      <CompareSection />
      <ExemplarSection />
      <MrEdgeSection />
      <ArmsSection />
    </Box>
  );
}
