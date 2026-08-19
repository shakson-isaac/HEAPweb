import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Chip, Alert } from '@mui/material';
import SectionCard from '../../components/SectionCard';
import ColumnarTable from '../../components/ColumnarTable';
import PlotPanel from '../../components/PlotPanel';
import { useSection, useKeys, useShard } from '../../lib/useSection';
import { getManifest } from '../../lib/heapdata';
import { prettyExposure } from '../../lib/palette';

// The packer recovers whole-column types, so a TSV "TRUE" arrives as a real
// JSON boolean. Accept either form rather than assuming one.
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

// GxE component colors, from HEAP's single source of truth:
// scripts/visualizations/common/plot_theme.R :: HEAP_GXE_COLORS.
const GXE_COLORS = { cis: '#1B6CA8', trans: '#D55E00', 'joint-only': '#9E9E9E' };
const GXE_LEVELS = ['cis', 'trans', 'joint-only'];

// Per-pair architecture labels used by fig_gxe_assoc, same source file.
const ARCH_COLORS = {
  'cis & trans': '#7B3FA0', 'cis-driven': '#1B6CA8', 'trans-driven': '#E07B39', 'n.s.': '#C7C7C7',
};
const ARCH_ORDER = ['cis & trans', 'cis-driven', 'trans-driven', 'n.s.'];

// Variance-component colors, HEAP_PAL_COMPONENT in the same theme file.
const COMPONENT_COLORS = { Genetic: '#1B6CA8', Exposome: '#2E9E48', GxE: '#7B3FA0' };
const COMPONENT_ORDER = ['Genetic', 'Exposome', 'GxE'];

const STATS = [
  { id: 'p_GxE_joint', label: 'joint GxE', axis: 'joint GxE F-test' },
  { id: 'p_GcisxE', label: 'cis × E', axis: 'cis-genetic × exposure block' },
  { id: 'p_GtrxE', label: 'trans × E', axis: 'trans-genetic × exposure block' },
];

// A model term is "<field>_f<code>_<instance>_<array>" with the factor level
// glued on the end, so prettyExposure() alone collapses every level of a field
// onto one label.
const ID_RE = /^(.*)_f(\d+)_(\d+)_(\d)(.*)$/;

function termLabel(id) {
  const s = String(id);
  const m = s.match(ID_RE);
  if (!m) return prettyExposure(s);
  const base = m[1].replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const lvl = m[5].replace(/^[._]+/, '').replace(/^multi_/, '').replace(/[._]+/g, ' ').trim();
  if (!lvl) return base;
  return /^\d+$/.test(lvl) ? `${base} (level ${lvl})` : `${base} (${lvl})`;
}

const num = (v, d = 3) => (v === null || v === undefined || !Number.isFinite(Number(v))
  ? '—' : Number(v).toFixed(d));

const sci = (v) => (v === null || v === undefined || !Number.isFinite(Number(v))
  ? '—' : Number(v).toExponential(2));

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Axis styling to match PlotPanel's BASE_LAYOUT on the secondary subplot axes,
// which the shallow layout merge does not reach.
const AX = { showgrid: false, zeroline: false, ticks: 'outside', linecolor: '#333' };

/** Number of exposure-protein pairs the GxE section holds, from the manifest. */
function useGxePairCount() {
  const [n, setN] = useState(null);
  useEffect(() => {
    let alive = true;
    getManifest()
      .then((m) => {
        for (const p of m.pages) {
          const s = p.sections.find((x) => x.section_id === 'gxe_assoc');
          if (s && alive) { setN(s.n_rows); return; }
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return n;
}

// ---------------------------------------------------------------------------
// 1. per-exposure interaction p-values across the proteome
// ---------------------------------------------------------------------------
function AssocSection({ nPairs }) {
  const [exposure, setExposure] = useState('pack_years_of_smoking_f20161_0_0');
  const [statId, setStatId] = useState('p_GxE_joint');

  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('gxe_assoc');
  const { data, loading, error } = useShard('gxe_assoc', exposure);
  const stat = STATS.find((s) => s.id === statId);
  const thr = nPairs ? 0.05 / nPairs : null;

  const options = useMemo(
    () => (keyIndex
      ? Object.keys(keyIndex.keys).sort().map((k) => ({ value: k, label: termLabel(k) }))
      : []),
    [keyIndex]
  );

  const view = useMemo(() => {
    if (!data) return null;
    const order = data.protein
      .map((_, i) => i)
      .sort((a, b) => String(data.protein[a]).localeCompare(String(data.protein[b])));
    const pos = new Map(order.map((rowIdx, x) => [rowIdx, x]));

    // A p-value exported below the figure JSON's precision arrives as 0. It is
    // a censored small number, not an infinite -log10, so it is left off the
    // axis and counted instead of being drawn at the top of the plot.
    const censored = order.filter((i) => !(Number(data[statId][i]) > 0));
    const plotted = order.filter((i) => Number(data[statId][i]) > 0);

    const kinds = ARCH_ORDER.filter((a) => data.arch.includes(a));
    const traces = kinds.map((a) => {
      const idx = plotted.filter((i) => data.arch[i] === a);
      return {
        type: 'scattergl',
        mode: 'markers',
        name: `${a} (${idx.length})`,
        x: idx.map((i) => pos.get(i)),
        y: idx.map((i) => -Math.log10(Number(data[statId][i]))),
        customdata: idx.map((i) => [
          data.protein[i], Number(data.p_GxE_joint[i]), Number(data.p_GcisxE[i]),
          Number(data.p_GtrxE[i]), data.arch[i], isTrue(data.sig_joint[i]) ? 'yes' : 'no',
        ]),
        hovertemplate:
          '<b>%{customdata[0]}</b>'
          + '<br>joint p = %{customdata[1]:.3g}'
          + '<br>cis×E p = %{customdata[2]:.3g}'
          + '<br>trans×E p = %{customdata[3]:.3g}'
          + '<br>architecture: %{customdata[4]}'
          + '<br>passes the joint Bonferroni threshold: %{customdata[5]}<extra></extra>',
        marker: {
          size: a === 'n.s.' ? 4 : 8,
          color: ARCH_COLORS[a] || '#C7C7C7',
          opacity: a === 'n.s.' ? 0.5 : 0.95,
          line: { width: 0 },
        },
      };
    });
    if (thr && plotted.length) {
      traces.unshift({
        type: 'scatter',
        mode: 'lines',
        name: `Bonferroni 0.05/${nPairs.toLocaleString()}`,
        x: [0, order.length - 1],
        y: [-Math.log10(thr), -Math.log10(thr)],
        line: { color: '#999', width: 1, dash: 'dash' },
        hoverinfo: 'skip',
      });
    }
    const counts = Object.fromEntries(kinds.map((a) => [a, order.filter((i) => data.arch[i] === a).length]));
    return {
      traces,
      n: order.length,
      nSig: data.sig_joint.filter(isTrue).length,
      counts,
      kinds,
      nCensored: censored.length,
    };
  }, [data, statId, thr, nPairs]);

  return (
    <SectionCard
      title="Interaction p-values across the proteome, one exposure at a time"
      subtitle="Every protein tested against the selected exposure for a gene-by-environment interaction. Points are colored by which genetic block reaches the Bonferroni threshold — cis, trans, both, or neither — and the dashed line is that threshold, set over all exposure-protein pairs in the section."
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
            Statistic
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={statId}
            onChange={(e, v) => v && setStatId(v)}
          >
            {STATS.map((s) => (
              <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none' }}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label={`${view.n} proteins tested`} />
            <Chip
              size="small"
              color={view.nSig ? 'primary' : 'default'}
              label={`${view.nSig} pass the joint Bonferroni threshold${thr ? ` (p < ${sci(thr)})` : ''}`}
            />
            {view.kinds.filter((a) => a !== 'n.s.').map((a) => (
              <Chip key={a} size="small" variant="outlined" label={`${a}: ${view.counts[a]}`} />
            ))}
            {view.nCensored > 0 && (
              <Chip size="small" variant="outlined" label={`${view.nCensored} p-values below export precision, not plotted`} />
            )}
          </Box>

          {view.nSig === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              All {view.n} proteins were tested against this exposure and none reached the joint
              Bonferroni threshold. That is a <b>tested, threshold not met</b> result — distinct from
              an exposure that carries no test at all, which would not appear in the selector.
            </Alert>
          )}

          <PlotPanel
            data={view.traces}
            height={480}
            layout={{
              xaxis: { title: 'proteins, in alphabetical order', showticklabels: false, type: 'linear' },
              yaxis: { title: `−log10 p, ${stat.axis}`, type: 'linear' },
              title: { text: `${termLabel(exposure)} — ${stat.label}`, font: { size: 13 } },
              legend: { orientation: 'h', y: -0.16, font: { size: 10 } },
              margin: { b: 90 },
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 2. the interaction component against its noise floor
// ---------------------------------------------------------------------------
function NoiseFloorSection({ onStats }) {
  const { data, loading, error } = useSection('gxe_noise_floor');

  const view = useMemo(() => {
    if (!data) return null;
    const traces = [];
    const stats = [];
    COMPONENT_ORDER.forEach((comp, k) => {
      const idx = data.panel
        .map((_, i) => i)
        .filter((i) => data.panel[i] === 'a' && data.key[i] === comp
          && Number.isFinite(Number(data.value1[i])) && Number.isFinite(Number(data.value2[i])));
      const xs = idx.map((i) => Number(data.value1[i]));
      const ys = idx.map((i) => Number(data.value2[i]));
      const ax = k === 0 ? 'x' : `x${k + 1}`;
      const ay = k === 0 ? 'y' : `y${k + 1}`;
      const lo = Math.min(...xs, ...ys);
      const hi = Math.max(...xs, ...ys);
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [lo, hi],
        y: [lo, hi],
        xaxis: ax,
        yaxis: ay,
        line: { color: '#999', width: 1, dash: 'dash' },
        hoverinfo: 'skip',
        showlegend: false,
      });
      traces.push({
        type: 'scattergl',
        mode: 'markers',
        name: comp,
        x: xs,
        y: ys,
        xaxis: ax,
        yaxis: ay,
        customdata: idx.map((i) => [data.omic[i]]),
        hovertemplate: `<b>%{customdata[0]}</b><br>train R² = %{x:.4f}<br>test R² = %{y:.4f}`
          + `<extra>${comp}</extra>`,
        marker: { size: 3, color: COMPONENT_COLORS[comp], opacity: 0.35, line: { width: 0 } },
        showlegend: false,
      });
      stats.push({
        component: comp,
        n: idx.length,
        r: pearson(xs, ys),
        gap: median(xs.map((v, j) => v - ys[j])),
      });
    });

    const bIdx = data.panel.map((_, i) => i).filter((i) => data.panel[i] === 'b');
    const bar = {
      type: 'bar',
      x: bIdx.map((i) => String(data.key[i]).replace(/\n/g, '<br>')),
      y: bIdx.map((i) => Number(data.value1[i])),
      customdata: bIdx.map((i) => [Number(data.value2[i])]),
      text: bIdx.map((i) => String(Number(data.value1[i]))),
      textposition: 'outside',
      hovertemplate: '%{x}<br>%{y} proteins<br>Spearman ρ vs base = %{customdata[0]:.2f}<extra></extra>',
      cliponaxis: false,
      marker: { color: COMPONENT_COLORS.GxE, opacity: 0.85 },
    };
    const rho = bIdx.map((i) => ({ key: String(data.key[i]).replace(/\n/g, ' '), rho: Number(data.value2[i]) }));
    return { traces, stats, bar, rho };
  }, [data]);

  useEffect(() => {
    if (view && onStats) onStats(view.stats);
  }, [view, onStats]);

  return (
    <SectionCard
      title="How the interaction component reproduces"
      subtitle="Each protein's unique drop-one R² in the training split against the same quantity out of fold, one panel per variance component, with the dashed line at y = x. The bar chart repeats the interaction estimate under models that add age- and sex-interaction terms."
      loading={loading}
      error={error}
    >
      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {view.stats.map((s) => (
              <Chip
                key={s.component}
                size="small"
                variant="outlined"
                label={`${s.component}: train→test r = ${num(s.r, 2)}, median gap ${s.gap >= 0 ? '+' : ''}${num(s.gap, 4)}`}
                sx={{ borderColor: COMPONENT_COLORS[s.component] }}
              />
            ))}
          </Box>
          <PlotPanel
            data={view.traces}
            height={340}
            layout={{
              xaxis: { ...AX, domain: [0, 0.28], title: 'train R²', anchor: 'y' },
              yaxis: { ...AX, title: 'test R²', anchor: 'x' },
              xaxis2: { ...AX, domain: [0.36, 0.64], title: 'train R²', anchor: 'y2' },
              yaxis2: { ...AX, anchor: 'x2' },
              xaxis3: { ...AX, domain: [0.72, 1], title: 'train R²', anchor: 'y3' },
              yaxis3: { ...AX, anchor: 'x3' },
              annotations: COMPONENT_ORDER.map((c, i) => ({
                text: c,
                x: [0.14, 0.5, 0.86][i],
                y: 1.08,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: { size: 12, color: COMPONENT_COLORS[c] },
              })),
              margin: { l: 60, r: 10, t: 34, b: 50 },
            }}
          />
          <Box sx={{ mt: 3 }}>
            <PlotPanel
              data={[view.bar]}
              height={320}
              layout={{
                xaxis: { automargin: true, ticks: '' },
                yaxis: { title: 'proteins with interaction R² ≥ 0.01' },
                margin: { l: 70, r: 20, t: 45, b: 70 },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Spearman correlation of the per-protein interaction estimate against the base model:{' '}
            {view.rho.map((r) => `${r.key} ρ = ${num(r.rho, 2)}`).join(' · ')}.
          </Typography>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 3. what the replicated interactions look like
// ---------------------------------------------------------------------------
function ArchitectureSection({ onCounts }) {
  const { data, loading, error } = useSection('gxe_architecture');

  const view = useMemo(() => {
    if (!data) return null;
    const rows = (panel) => data.panel.map((_, i) => i).filter((i) => data.panel[i] === panel);

    const a = rows('a');
    const compCounts = GXE_LEVELS
      .map((lv) => {
        const i = a.find((j) => data.key[j] === lv);
        return { component: lv, n: i === undefined ? 0 : Number(data.value[i]) };
      });
    const total = compCounts.reduce((s, c) => s + c.n, 0);
    const componentBar = [{
      type: 'bar',
      orientation: 'h',
      x: compCounts.map((c) => c.n),
      y: compCounts.map((c) => c.component),
      marker: { color: compCounts.map((c) => GXE_COLORS[c.component]) },
      text: compCounts.map((c) => String(c.n)),
      textposition: 'outside',
      cliponaxis: false,
      hovertemplate: '%{y}<br>%{x} replicated pairs<extra></extra>',
    }];

    const split = (panel) => {
      const idx = rows(panel);
      const items = idx.map((i) => {
        const [left, comp] = String(data.key[i]).split(' | ');
        return { left, comp, n: Number(data.value[i]) };
      });
      const labels = [...new Set(items.map((it) => it.left))];
      const tot = new Map(labels.map((l) => [l, items.filter((it) => it.left === l)
        .reduce((s, it) => s + it.n, 0)]));
      labels.sort((p, q) => tot.get(p) - tot.get(q));
      return GXE_LEVELS.map((lv) => ({
        type: 'bar',
        orientation: 'h',
        name: lv,
        x: labels.map((l) => {
          const hit = items.find((it) => it.left === l && it.comp === lv);
          return hit ? hit.n : 0;
        }),
        y: labels,
        marker: { color: GXE_COLORS[lv] },
        hovertemplate: `%{y}<br>%{x} pairs<extra>${lv}</extra>`,
      }));
    };
    const catBar = split('b');
    const hubBar = split('c');
    const nCat = new Set(rows('b').map((i) => String(data.key[i]).split(' | ')[0])).size;
    const nHub = new Set(rows('c').map((i) => String(data.key[i]).split(' | ')[0])).size;

    const d = rows('d')
      .map((i) => {
        const [protein, ex] = String(data.key[i]).split(' | ');
        return { protein, ex, v: Number(data.value[i]) };
      })
      .sort((p, q) => q.v - p.v);
    const TOP = 25;
    const dTop = d.slice(0, TOP).reverse();
    const lociBar = [{
      type: 'bar',
      orientation: 'h',
      x: dTop.map((r) => r.v),
      y: dTop.map((r) => `${r.protein} × ${termLabel(r.ex)}`),
      marker: { color: GXE_COLORS.cis },
      hovertemplate: '%{y}<br>−log10 p (joint, train) = %{x:.1f}<extra></extra>',
    }];

    return {
      componentBar, compCounts, total, catBar, hubBar, lociBar,
      nCat, nHub, nLoci: d.length, nLociShown: dTop.length,
    };
  }, [data]);

  useEffect(() => {
    if (view && onCounts) onCounts({ compCounts: view.compCounts, total: view.total });
  }, [view, onCounts]);

  return (
    <SectionCard
      title="What the replicated interactions consist of"
      subtitle="Interaction pairs that clear the Bonferroni threshold in both the training and the held-out split, broken down by which genetic block carries them, by exposure category, and by protein."
      loading={loading}
      error={error}
    >
      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" color="primary" label={`${view.total} replicated interaction pairs`} />
            {view.compCounts.map((c) => (
              <Chip key={c.component} size="small" variant="outlined"
                label={`${c.component}: ${c.n}`} sx={{ borderColor: GXE_COLORS[c.component] }} />
            ))}
            <Chip size="small" variant="outlined" label={`${view.nCat} exposure categories`} />
          </Box>

          <PlotPanel
            data={view.componentBar}
            height={220}
            layout={{
              xaxis: { title: 'replicated pairs' },
              yaxis: { automargin: true, ticks: '' },
              margin: { l: 100, r: 40, t: 20, b: 50 },
            }}
          />

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>By exposure category</Typography>
            <PlotPanel
              data={view.catBar}
              height={Math.max(300, view.nCat * 26 + 120)}
              layout={{
                barmode: 'stack',
                xaxis: { title: 'replicated pairs' },
                yaxis: { automargin: true, ticks: '' },
                legend: { orientation: 'h', y: -0.12, font: { size: 10 } },
                margin: { l: 210, r: 30, t: 10, b: 70 },
              }}
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              By protein ({view.nHub} proteins carry the interactions shown)
            </Typography>
            <PlotPanel
              data={view.hubBar}
              height={Math.max(300, view.nHub * 26 + 120)}
              layout={{
                barmode: 'stack',
                xaxis: { title: 'replicated pairs' },
                yaxis: { automargin: true, ticks: '' },
                legend: { orientation: 'h', y: -0.12, font: { size: 10 } },
                margin: { l: 120, r: 30, t: 10, b: 70 },
              }}
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Strongest cis interaction pairs ({view.nLociShown} of {view.nLoci} shown; the rest are
              in the table below)
            </Typography>
            <PlotPanel
              data={view.lociBar}
              height={Math.max(360, view.nLociShown * 20 + 120)}
              layout={{
                xaxis: { title: '−log10 p, joint GxE F-test (training split)' },
                yaxis: { automargin: true, ticks: '', tickfont: { size: 9 } },
                margin: { l: 330, r: 30, t: 10, b: 60 },
              }}
            />
          </Box>

          <ColumnarTable data={data} initialRowsPerPage={10} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 4. the largest per-protein interaction estimates
// ---------------------------------------------------------------------------
function ProteinsSection() {
  const { data, loading, error } = useSection('gxe_proteins');
  return (
    <SectionCard
      title="Proteins with the largest interaction R²"
      subtitle="The 25 proteins with the highest unique interaction R², with the exposure category that dominates each. These are the right-hand tail of the same per-protein distribution plotted against its held-out estimate above; read the two together."
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label={`${data.omic.length} proteins listed`} />
            <Chip size="small" variant="outlined" label={`${new Set(data.dom_category).size} dominant categories`} />
          </Box>
          <ColumnarTable data={data} initialRowsPerPage={25} />
        </>
      )}
    </SectionCard>
  );
}

export default function Interactions() {
  const nPairs = useGxePairCount();
  const [floor, setFloor] = useState(null);
  const [arch, setArch] = useState(null);

  const gxeStat = floor ? floor.find((s) => s.component === 'GxE') : null;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        Gene-by-environment interactions — a supplementary analysis
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, maxWidth: 900 }}>
        HEAP tests every exposure–protein pair for a polygenic gene-by-environment interaction, and
        reports the result as a supplementary analysis rather than a headline. The two measurements
        behind that placement are on this page: the size of the interaction variance component
        relative to the genetic and exposomic components, and how the same component behaves out of
        fold. Both are plotted below from the published payload; what they mean for the biology is
        argued in the manuscript, not here.
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {nPairs && (
          <Chip size="small" variant="outlined" label={`${nPairs.toLocaleString()} exposure–protein pairs tested`} />
        )}
        {arch && (
          <Chip size="small" variant="outlined" label={`${arch.total} pairs replicate across the split`} />
        )}
        {arch && arch.compCounts.map((c) => (
          <Chip key={c.component} size="small" variant="outlined"
            label={`${c.component}: ${c.n}`} sx={{ borderColor: GXE_COLORS[c.component] }} />
        ))}
        {gxeStat && (
          <Chip size="small" variant="outlined"
            label={`interaction R² train→test r = ${num(gxeStat.r, 2)}`}
            sx={{ borderColor: COMPONENT_COLORS.GxE }} />
        )}
        {floor && floor.filter((s) => s.component !== 'GxE').map((s) => (
          <Chip key={s.component} size="small" variant="outlined"
            label={`${s.component} R² train→test r = ${num(s.r, 2)}`}
            sx={{ borderColor: COMPONENT_COLORS[s.component] }} />
        ))}
      </Box>

      <Alert severity="info" sx={{ mb: 3, maxWidth: 1000 }}>
        Two thresholds are in play and they are not the same. The <b>per-pair</b> plot uses a
        Bonferroni threshold over all exposure–protein pairs in one split. The <b>replicated</b>{' '}
        counts require a pair to clear that threshold in the training split and again in held-out
        data, which is why they are far smaller than the per-split counts.
      </Alert>

      <AssocSection nPairs={nPairs} />
      <NoiseFloorSection onStats={setFloor} />
      <ArchitectureSection onCounts={setArch} />
      <ProteinsSection />
    </Box>
  );
}
