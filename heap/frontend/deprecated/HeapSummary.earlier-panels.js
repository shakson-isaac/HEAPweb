// ARCHIVED 2026-08-26 -- the "earlier panels" from HeapSummary.js
//
// These were folded behind a "Show the earlier panels" disclosure and are now
// removed from the site. Kept because each was the ONLY view of its payload
// section, and because the designs may be worth revisiting.
//
// NOT COMPILED. This directory sits outside src/, so CRA never builds it. The
// code below is verbatim as it last shipped, but its imports are NOT included
// -- to revive a panel, copy the function back into the page and restore
// whatever it referenced. The original import block is reproduced at the end
// for exactly that purpose.
//
// Payload sections these were the only view of:
//   category_biology
//   expo_category_arch
//   expo_category_dist
//   expo_category_heatmap
//   traintest_stability_categories

function CategoryReach() {
  const arch = useSection('expo_category_arch');
  const dist = useSection('expo_category_dist');

  const view = useMemo(() => {
    if (!arch.data) return null;
    const d = arch.data;
    const idx = d.category.map((_, i) => i).sort((a, b) => d.n_resp[a] - d.n_resp[b]);
    const trace = {
      type: 'bar',
      orientation: 'h',
      x: idx.map((i) => Number(d.n_resp[i])),
      y: idx.map((i) => prettyCategory(d.category[i])),
      marker: { color: idx.map((i) => ecatColor(d.category[i])) },
      customdata: idx.map((i) => [String(d.broad[i]), Number(d.n_prot[i])]),
      text: idx.map((i) => int(d.n_resp[i])),
      textposition: 'outside',
      hovertemplate:
        '<b>%{y}</b><br>%{customdata[0]}'
        + '<br>%{x:,} of %{customdata[1]:,} proteins reliably predicted<extra></extra>',
    };
    // Categories that were tested and reliably predict no protein are dropped
    // from this section by the plotter, so recover them from the sibling
    // section rather than letting them read as "not tested" (S7).
    const shown = new Set(d.category.map(String));
    const zero = dist.data
      ? [...new Set(dist.data.category.map(String))].filter((c) => !shown.has(c)).sort()
      : [];
    return {
      traces: [trace],
      nProt: Math.max(...d.n_prot.map(Number)),
      nShown: d.category.length,
      zero,
    };
  }, [arch.data, dist.data]);

  return (
    <SectionCard
      title="Reach of each exposure category"
      subtitle={'Number of proteins each lifestyle category reliably predicts. Reach uses no R² '
        + 'cutoff: for every protein × category the leave-one-category-out R² is tested for being '
        + 'consistently positive across cross-validation folds, with BH correction across '
        + 'proteins within a category, and reach counts the proteins at FDR < 0.05.'}
      loading={arch.loading || dist.loading}
      error={arch.error || dist.error}
    >
      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label={`${int(view.nProt)} proteins tested per category`} />
            <Chip size="small" label={`${view.nShown} of ${view.nShown + view.zero.length} categories reach at least one protein`} />
          </Box>
          <PlotPanel
            data={view.traces}
            height={330}
            layout={{
              xaxis: { title: 'proteins reliably predicted (BH FDR < 0.05)' },
              yaxis: { automargin: true, ticks: '', type: 'category' },
              margin: { l: 150, r: 60 },
              showlegend: false,
            }}
          />
          {view.zero.length > 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              The other {view.zero.length} categories —{' '}
              <b>{view.zero.map(prettyCategory).join(', ')}</b> — were <b>tested against all{' '}
              {int(view.nProt)} proteins and reliably predict none of them</b> at FDR &lt; 0.05.
              They are absent from the bars above because their reach is zero, not because they
              were left untested. Their per-protein values are in the next two sections.
            </Alert>
          )}
          <ColumnarTable data={arch.data} initialRowsPerPage={10} maxHeight={300} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// b. Size versus breadth, per category
// ---------------------------------------------------------------------------


function CategoryDist() {
  const { data, loading, error } = useSection('expo_category_dist');

  // 13 points, seven of which sit on top of each other at the origin, so inline
  // text labels collide. One trace per category puts the name in the legend
  // instead, and the fill (solid vs hollow) still separates the two states.
  const traces = useMemo(() => {
    if (!data) return [];
    const idx = data.category
      .map((_, i) => i)
      .sort((a, b) => Number(data.mean_r2[b]) - Number(data.mean_r2[a]));
    return idx.map((i) => {
      const nul = isTrue(data.is_null[i]);
      const color = ecatColor(data.category[i]);
      return {
        type: 'scatter',
        mode: 'markers',
        name: prettyCategory(data.category[i]),
        x: [Number(data.mean_r2[i])],
        y: [Number(data.frac_resp[i])],
        customdata: [[
          Number(data.median_r2[i]), Number(data.n_prot[i]), Number(data.frac_resp[i]),
          nul ? 'at or below zero' : 'above zero',
        ]],
        hovertemplate:
          '<b>%{fullData.name}</b><br>mean unique R² = %{x:.5f} (%{customdata[3]})'
          + '<br>median unique R² = %{customdata[0]:.5f}'
          + '<br>%{customdata[2]:.2%} of %{customdata[1]:,} proteins above R² 0.005'
          + '<extra></extra>',
        marker: {
          size: 13,
          color: nul ? 'white' : color,
          line: { width: 2.5, color },
        },
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="Variance explained per category"
      subtitle={'Mean unique exposomic R² across all proteins (x) against the fraction of '
        + 'proteins whose unique R² exceeds 0.005 (y). Hollow markers are categories whose mean '
        + 'out-of-fold R² is at or below zero — tested, with no variance recovered on held-out '
        + 'folds. Several of those sit on top of one another at the origin; the legend and the '
        + 'table below name each one.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <PlotPanel
            data={traces}
            height={500}
            layout={{
              xaxis: { title: 'mean unique R² across proteins', zeroline: true, zerolinecolor: '#bbb' },
              yaxis: { title: 'fraction of proteins with R² > 0.005', tickformat: '.1%' },
              legend: { orientation: 'h', y: -0.16, font: { size: 10 } },
              margin: { r: 40, b: 130 },
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={13} maxHeight={420} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// c. Category × protein heatmap
// ---------------------------------------------------------------------------


function CategoryHeatmap() {
  const { data, loading, error } = useSection('expo_category_heatmap');

  const { traces, nProt, nCat } = useMemo(() => {
    if (!data) return { traces: [], nProt: 0, nCat: 0 };
    const disp = pivot(data, { xCol: 'category', yCol: 'omic', zCol: 'r2_disp' });
    const raw = pivot(data, { xCol: 'category', yCol: 'omic', zCol: 'r2' });
    return {
      traces: [{
        type: 'heatmap',
        x: disp.x.map(prettyCategory),
        y: disp.y,
        z: disp.z,
        customdata: raw.z,
        colorscale: SEQ,
        zmin: 0,
        hoverongaps: false,
        colorbar: { title: { text: 'unique R²' }, thickness: 12, len: 0.6 },
        hovertemplate:
          '<b>%{y}</b><br>%{x}<br>unique R² = %{z:.4f}'
          + '<br>before flooring: %{customdata:.4f}<extra></extra>',
      }],
      nProt: disp.y.length,
      nCat: disp.x.length,
    };
  }, [data]);

  return (
    <SectionCard
      title="Category by protein"
      subtitle={'Per-category unique exposomic R² for the most exposure-responsive proteins. '
        + 'Negative out-of-fold values are floored at zero for the color scale; the hover carries '
        + 'the unfloored value.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ mb: 1 }}>
            <Chip size="small" variant="outlined" label={`${nProt} proteins × ${nCat} categories`} />
          </Box>
          <PlotPanel
            data={traces}
            height={880}
            layout={{
              xaxis: { tickangle: -45, automargin: true, ticks: '', type: 'category' },
              yaxis: { automargin: true, ticks: '', type: 'category' },
              margin: { l: 110, b: 170, t: 20 },
            }}
          />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// d. Train versus test, per protein and category
// ---------------------------------------------------------------------------


function TrainTest() {
  const { data, loading, error } = useSection('traintest_stability_categories');

  const { traces, lim, nPairs } = useMemo(() => {
    if (!data) return { traces: [], lim: 1, nPairs: 0 };
    const cats = [...new Set(data.category)].sort();
    const hi = Math.max(Math.max(...data.train_r2), Math.max(...data.test_r2));
    const lo = Math.min(Math.min(...data.train_r2), Math.min(...data.test_r2));
    const pad = (hi - lo) * 0.04;
    const range = [lo - pad, hi + pad];
    const line = {
      type: 'scatter',
      mode: 'lines',
      name: 'train = test',
      x: range,
      y: range,
      line: { color: '#999', width: 1, dash: 'dot' },
      hoverinfo: 'skip',
    };
    const pts = cats.map((c) => {
      const idx = data.category.map((_, i) => i).filter((i) => data.category[i] === c);
      return {
        type: 'scattergl',
        mode: 'markers',
        name: prettyCategory(c),
        x: idx.map((i) => Number(data.train_r2[i])),
        y: idx.map((i) => Number(data.test_r2[i])),
        text: idx.map((i) => data.omic[i]),
        marker: { size: 4, color: ecatColor(c), opacity: 0.55, line: { width: 0 } },
        hovertemplate:
          '<b>%{text}</b><br>train R² = %{x:.4f}<br>test R² = %{y:.4f}'
          + '<extra>%{fullData.name}</extra>',
      };
    });
    return { traces: [line, ...pts], lim: range, nPairs: data.omic.length };
  }, [data]);

  return (
    <SectionCard
      title="Train versus test stability"
      subtitle={'Per-protein unique R² for each category, fitted in training folds (x) against '
        + 'the same quantity scored on held-out folds (y). Points on the dotted line carry over '
        + 'unchanged; points to its right lose R² out of fold.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ mb: 1 }}>
            <Chip size="small" variant="outlined" label={`${int(nPairs)} protein × category pairs`} />
          </Box>
          <PlotPanel
            data={traces}
            height={560}
            layout={{
              xaxis: { title: 'train unique R²', range: lim, type: 'linear' },
              yaxis: { title: 'test (out-of-fold) unique R²', range: lim, type: 'linear' },
              legend: { orientation: 'h', y: -0.16, font: { size: 10 } },
              margin: { b: 120 },
            }}
          />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// e. Gene-set biology behind each category
// ---------------------------------------------------------------------------


function CategoryBiology() {
  const arch = useSection('expo_category_arch');
  const { data, loading, error } = useSection('category_biology');

  const view = useMemo(() => {
    if (!data) return null;
    const cats = [...new Set(data.category)].sort();
    const best = new Map();
    data.term.forEach((t, i) => {
      best.set(t, Math.max(best.get(t) ?? -Infinity, Number(data.lp[i])));
    });
    const order = [...best.keys()].sort((a, b) => best.get(a) - best.get(b));
    const traces = cats.map((c) => {
      const idx = data.category.map((_, i) => i).filter((i) => data.category[i] === c);
      return {
        type: 'bar',
        orientation: 'h',
        name: prettyCategory(c),
        x: idx.map((i) => Number(data.lp[i])),
        y: idx.map((i) => String(data.term[i])),
        marker: { color: ecatColor(c) },
        customdata: idx.map((i) => [
          Number(data.NES[i]), Number(data.setSize[i]), Number(data['p.adjust'][i]),
          String(data.theme[i]), String(data.ONTOLOGY[i]), String(data.ID[i]),
        ]),
        hovertemplate:
          '<b>%{y}</b> (%{customdata[4]}, %{customdata[5]})'
          + '<br>−log10 adjusted p = %{x:.2f}<br>q = %{customdata[2]:.3g}'
          + '<br>NES = %{customdata[0]:.2f} over %{customdata[1]:,} genes'
          + '<br>theme: %{customdata[3]}<extra>%{fullData.name}</extra>',
      };
    });
    const tested = arch.data ? [...new Set(arch.data.category.map(String))] : [];
    const missing = tested.filter((c) => !cats.includes(c)).sort();
    return { traces, order, cats, missing, nTerms: best.size, nRows: data.term.length };
  }, [data, arch.data]);

  return (
    <SectionCard
      title="Biology behind each category"
      subtitle={'Top gene-ontology terms enriched among the proteins each category predicts, by '
        + 'adjusted p-value. Only positively enriched terms are carried in this section, and each '
        + 'category contributes its own top terms, so a term can appear for several categories.'}
      loading={arch.loading || loading}
      error={arch.error || error}
    >
      {view && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label={`${view.nRows} category × term rows`} />
            <Chip size="small" variant="outlined" label={`${view.nTerms} distinct terms`} />
            <Chip size="small" variant="outlined" label={`${view.cats.length} categories`} />
          </Box>
          <PlotPanel
            data={view.traces}
            height={720}
            layout={{
              barmode: 'group',
              xaxis: { title: '−log10 adjusted p' },
              yaxis: {
                categoryorder: 'array',
                categoryarray: view.order,
                automargin: true,
                ticks: '',
                type: 'category',
              },
              margin: { l: 320, b: 90 },
              legend: { orientation: 'h', y: -0.12, font: { size: 10 } },
            }}
          />
          <Alert severity="info" sx={{ mt: 1 }}>
            Enrichment is reported for the {view.cats.length} categories present in this section.
            {view.missing.length > 0 && (
              <> {view.missing.length} of the categories with non-zero reach contribute no term
                to it ({view.missing.map(prettyCategory).join(', ')}).</>
            )}{' '}
            The categories whose reach is zero have no protein set to test, so they are absent
            here for a different reason than a category that was tested and returned no enriched
            term.
          </Alert>
          <ColumnarTable
            data={data}
            columns={['catlab', 'database', 'ONTOLOGY', 'ID', 'Description', 'setSize', 'NES',
              'pvalue', 'p.adjust', 'qvalue', 'theme']}
            initialRowsPerPage={10}
            maxHeight={340}
          />
        </>
      )}
    </SectionCard>
  );
}


// ---- the page's import block as it stood when these were removed ----
// import React, { useMemo } from 'react';
// import { Alert, Box, Chip, Typography } from '@mui/material';
// import SectionCard from '../../components/SectionCard';
// import ColumnarTable from '../../components/ColumnarTable';
// import PlotPanel from '../../components/PlotPanel';
// import { useSection } from '../../lib/useSection';
// import Disclosure from '../../components/Disclosure';
// import CategoryReachPanel from '../../components/redesign/CategoryReach';
// import CategoryProfile from '../../components/redesign/CategoryProfile';
// import { pivot } from '../../lib/heapdata';
// import { ecatColor, prettyCategory } from '../../lib/palette';
