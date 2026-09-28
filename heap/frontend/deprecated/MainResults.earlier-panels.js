// ARCHIVED 2026-08-26 -- the "earlier panels" from MainResults.js
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
//   exemplar_decomp
//   geno_vs_expo_arch
//   partition_motivation
//   predictive_r2
//   r2_decomposition
//   r2_distribution_donut
//   r2_reach_cdf
//   top_eg_proteins
//   variance_architecture

function GenoVsExpo() {
  const { data, loading, error } = useSection('geno_vs_expo_arch');

  const { traces, counts } = useMemo(() => {
    if (!data) return { traces: [], counts: null };
    const n = data.omic.length;
    const all = Array.from({ length: n }, (_, i) => i);
    const nonnull = all.filter((i) => isTrue(data.nonnull[i]));
    const nullish = all.filter((i) => !isTrue(data.nonnull[i]));
    const lim = Math.max(
      Math.max(...data.Genetic_plot),
      Math.max(...data.Exposome_plot)
    ) * 1.05;

    const mk = (idx, name, color, size, opacity) => ({
      type: 'scattergl',
      mode: 'markers',
      name,
      x: idx.map((i) => data.Genetic_plot[i]),
      y: idx.map((i) => data.Exposome_plot[i]),
      customdata: idx.map((i) => [
        data.omic[i], Number(data.Genetic[i]), Number(data.Exposome[i]),
        String(data.driver[i]),
        isTrue(data.sig_G[i]) ? 'yes' : 'no',
        isTrue(data.sig_E[i]) ? 'yes' : 'no',
      ]),
      hovertemplate:
        '<b>%{customdata[0]}</b>'
        + '<br>genetic (PGS) unique R² = %{customdata[1]:.4f}'
        + '<br>exposomic (PXS) unique R² = %{customdata[2]:.4f}'
        + '<br>side of the diagonal: %{customdata[3]}'
        + '<br>genetic component reliably non-null: %{customdata[4]}'
        + '<br>exposomic component reliably non-null: %{customdata[5]}'
        + '<extra>%{fullData.name}</extra>',
      marker: { size, color, opacity, line: { width: 0 } },
    });

    const drivers = [...new Set(nonnull.map((i) => data.driver[i]))].sort();
    const out = [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'R²_G = R²_E',
        x: [0, lim],
        y: [0, lim],
        line: { color: '#999', width: 1, dash: 'dot' },
        hoverinfo: 'skip',
      },
      mk(nullish, 'Neither component reliably non-null', '#C9CDD2', 4, 0.6),
      ...drivers.map((d) => mk(
        nonnull.filter((i) => data.driver[i] === d),
        d, DRIVER_COLORS[d] || '#666', 6, 0.85
      )),
    ];

    return {
      traces: out,
      counts: {
        n,
        nonnull: nonnull.length,
        nullish: nullish.length,
        lim,
        byDriver: drivers.map((d) => [d, nonnull.filter((i) => data.driver[i] === d).length]),
      },
    };
  }, [data]);

  return (
    <SectionCard
      title="Genetics versus exposome, per protein"
      subtitle={'One point per measured plasma protein: unique out-of-fold R² from the genetic '
        + 'block (x) against the exposomic block (y). The dotted diagonal is R²_G = R²_E, so a '
        + 'point above it has more exposomic than genetic explained variance. Out-of-fold '
        + 'negatives are floored at zero for the axes; the hover shows the unfloored value.'}
      loading={loading}
      error={error}
    >
      {counts && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip size="small" variant="outlined" label={`${int(counts.n)} proteins`} />
            <Chip
              size="small"
              label={`${int(counts.nonnull)} with a reliably non-null G or E component (fold t-test, BH FDR < 0.05)`}
            />
            {counts.byDriver.map(([d, k]) => (
              <Chip
                key={d}
                size="small"
                variant="outlined"
                label={`${int(k)} ${d}`}
                sx={{ borderColor: DRIVER_COLORS[d], color: DRIVER_COLORS[d] }}
              />
            ))}
          </Box>
          <PlotPanel
            data={traces}
            height={560}
            layout={{
              xaxis: { title: 'genetic (PGS) unique R²', range: [0, counts.lim], type: 'linear' },
              yaxis: { title: 'exposomic (PXS) unique R²', range: [0, counts.lim], type: 'linear' },
              legend: { orientation: 'h', y: -0.16, font: { size: 11 } },
              margin: { b: 90 },
            }}
          />
          <Alert severity="info" sx={{ mt: 1 }}>
            Every one of the {int(counts.n)} measured proteins was tested. The{' '}
            {int(counts.nullish)} gray points are <b>tested, with neither component reliably
            distinguishable from zero</b> across cross-validation folds — not untested and not
            missing. The {int(counts.nonnull)} colored points are the ones with at least one
            reliably non-null component.
          </Alert>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// b. Mean unique R² per component
// ---------------------------------------------------------------------------


function R2Decomposition() {
  const { data, loading, error } = useSection('r2_decomposition');

  const traces = useMemo(() => {
    if (!data) return [];
    return [{
      type: 'bar',
      x: data.component,
      y: data.mean_r2,
      marker: { color: data.component.map(compColor) },
      error_y: { type: 'data', array: data.sd_r2, color: '#555', thickness: 1, width: 6 },
      customdata: data.component.map((_, i) => [Number(data.sd_r2[i]), Number(data.n_prot[i])]),
      hovertemplate:
        '<b>%{x}</b><br>mean unique R² = %{y:.4f}'
        + '<br>SD across proteins = %{customdata[0]:.4f}'
        + '<br>%{customdata[1]:,} proteins<extra></extra>',
    }];
  }, [data]);

  return (
    <SectionCard
      title="Variance components across the proteome"
      subtitle={'Mean unique out-of-fold R² added by each block over the covariate-only baseline, '
        + 'averaged across the measured proteome. Error bars are ±1 SD across proteins, not a '
        + 'standard error of the mean.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <PlotPanel
            data={traces}
            height={380}
            layout={{
              xaxis: { title: 'variance component', type: 'category' },
              yaxis: { title: 'mean unique R²', zeroline: true, zerolinecolor: '#bbb' },
              showlegend: false,
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} maxHeight={240} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// c. Nested model blocks
// ---------------------------------------------------------------------------


function PredictiveR2() {
  const { data, loading, error } = useSection('predictive_r2');

  const traces = useMemo(() => {
    if (!data) return [];
    const idx = data.block.map((_, i) => i).sort((a, b) => data.order[a] - data.order[b]);
    return [{
      type: 'bar',
      x: idx.map((i) => data.block[i]),
      y: idx.map((i) => data.mean_r2[i]),
      marker: { color: idx.map((i) => compColor(String(data.block[i]).split('+').pop())) },
      error_y: { type: 'data', array: idx.map((i) => data.sd_r2[i]), color: '#555', thickness: 1, width: 6 },
      customdata: idx.map((i) => [Number(data.sd_r2[i]), Number(data.n[i])]),
      hovertemplate:
        '<b>%{x}</b><br>mean cross-validated R² = %{y:.4f}'
        + '<br>SD = %{customdata[0]:.4f}<br>%{customdata[1]:,} protein × fold fits'
        + '<extra></extra>',
    }];
  }, [data]);

  return (
    <SectionCard
      title="Predictive R² by model block"
      subtitle={'Cumulative cross-validated R² of the nested models: covariates only (C), then '
        + '+ genetics (G), + exposome (E) and + gene × environment (GxE). Bars are totals, not '
        + 'increments, so each includes everything to its left. Error bars are ±1 SD.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <PlotPanel
            data={traces}
            height={380}
            layout={{
              xaxis: { title: 'model block', type: 'category' },
              yaxis: { title: 'mean cross-validated R²', zeroline: true, zerolinecolor: '#bbb' },
              showlegend: false,
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} maxHeight={240} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// d. Reach: survival curve of per-protein component R²
// ---------------------------------------------------------------------------


function ReachCdf() {
  const { data, loading, error } = useSection('r2_reach_cdf');

  const traces = useMemo(() => {
    if (!data) return [];
    const comps = [...new Set(data.comp)];
    return comps.map((c) => {
      const idx = data.comp
        .map((_, i) => i)
        .filter((i) => data.comp[i] === c)
        .sort((a, b) => data.x[a] - data.x[b]);
      return {
        type: 'scatter',
        mode: 'lines',
        name: String(c),
        x: idx.map((i) => data.x[i]),
        y: idx.map((i) => data.S[i]),
        line: { color: compColor(c), width: 2 },
        hovertemplate:
          'R² ≥ %{x:.4f}<br>%{y:.1%} of proteins<extra>%{fullData.name}</extra>',
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="Reach of each component across the proteome"
      subtitle={'Survival curves of the per-protein unique R²: each curve gives the fraction of '
        + 'proteins whose component R² is at least the threshold on the x-axis (log scale). '
        + 'Out-of-fold negatives are floored at zero.'}
      loading={loading}
      error={error}
    >
      {data && (
        <PlotPanel
          data={traces}
          height={440}
          layout={{
            xaxis: { title: 'unique R² threshold', type: 'log' },
            yaxis: { title: 'fraction of proteins at or above threshold', tickformat: '.0%', type: 'linear' },
            legend: { orientation: 'h', y: -0.2 },
            margin: { b: 90 },
          }}
        />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// e. Distribution of per-protein R², binned
// ---------------------------------------------------------------------------
const RAMPS = {
  Genetic: ['#DEEBF7', '#9ECAE1', '#4292C6', '#1B6CA8', '#08306B'],
  Exposomic: ['#E5F5E0', '#A1D99B', '#41AB5D', '#2E9E48', '#00441B'],
};


function DistributionDonut() {
  const { data, loading, error } = useSection('r2_distribution_donut');

  const { traces, sets } = useMemo(() => {
    if (!data) return { traces: [], sets: [] };
    const uniq = [...new Set(data.set)];
    const out = uniq.map((s, col) => {
      const idx = data.set.map((_, i) => i).filter((i) => data.set[i] === s);
      const ramp = /^Genetic/.test(String(s)) ? RAMPS.Genetic : RAMPS.Exposomic;
      return {
        type: 'pie',
        hole: 0.55,
        sort: false,
        name: String(s),
        labels: idx.map((i) => String(data.bin[i])),
        values: idx.map((i) => Number(data.n[i])),
        customdata: idx.map((i) => Number(data.pct[i])),
        domain: { column: col },
        marker: { colors: idx.map((_, k) => ramp[k % ramp.length]), line: { color: 'white', width: 1 } },
        texttemplate: '%{label}',
        textposition: 'outside',
        hovertemplate: 'R² %{label}<br>%{value:,} proteins (%{customdata:.2f}%)<extra>%{fullData.name}</extra>',
      };
    });
    return { traces: out, sets: uniq };
  }, [data]);

  return (
    <SectionCard
      title="Distribution of explained variance"
      subtitle={'Per-protein unique R² binned separately for the genetic and exposomic blocks. '
        + 'The two donuts use different bin edges, so slices are comparable within a donut, not '
        + 'across the pair.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <PlotPanel
            data={traces}
            height={400}
            layout={{
              grid: { rows: 1, columns: sets.length },
              showlegend: false,
              annotations: sets.map((s, k) => ({
                text: String(s),
                x: sets.length > 1 ? (k + 0.5) / sets.length : 0.5,
                y: -0.06,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: { size: 12 },
              })),
              margin: { t: 40, b: 60 },
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} maxHeight={300} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// f. Leading proteins for the non-genetic components
// ---------------------------------------------------------------------------


function TopEgProteins() {
  const { data, loading, error } = useSection('top_eg_proteins');

  const { traces, order } = useMemo(() => {
    if (!data) return { traces: [], order: [] };
    const comps = [...new Set(data.comp)].sort();
    const rank = new Map(comps.map((c, i) => [c, i]));
    const idxAll = data.protein
      .map((_, i) => i)
      .sort((a, b) => (rank.get(data.comp[b]) - rank.get(data.comp[a]))
        || (data.r2[a] - data.r2[b]));
    const out = comps.map((c) => {
      const idx = idxAll.filter((i) => data.comp[i] === c);
      return {
        type: 'bar',
        orientation: 'h',
        name: String(c),
        x: idx.map((i) => data.r2[i]),
        y: idx.map((i) => data.protein[i]),
        marker: { color: compColor(c) },
        hovertemplate: '<b>%{y}</b><br>unique R² = %{x:.4f}<extra>%{fullData.name}</extra>',
      };
    });
    return { traces: out, order: idxAll.map((i) => data.protein[i]) };
  }, [data]);

  return (
    <SectionCard
      title="Leading proteins for the non-genetic components"
      subtitle={'Proteins ranked by unique out-of-fold R² within the exposomic and the gene × '
        + 'environment blocks. The two sets are ranked separately and share an axis only for '
        + 'compactness.'}
      loading={loading}
      error={error}
    >
      {data && (
        <PlotPanel
          data={traces}
          height={640}
          layout={{
            xaxis: { title: 'unique R²' },
            yaxis: { categoryorder: 'array', categoryarray: order, automargin: true, ticks: '' },
            margin: { l: 110 },
            legend: { orientation: 'h', y: -0.1 },
          }}
        />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// g. Exemplar protein decompositions
// ---------------------------------------------------------------------------
const STACK_ORDER = ['Covariates', 'Genetic', 'Exposomic', 'GxE'];


function ExemplarDecomp() {
  const { data, loading, error } = useSection('exemplar_decomp');

  const { traces, order } = useMemo(() => {
    if (!data) return { traces: [], order: [] };
    const meta = new Map();
    data.protein.forEach((p, i) => {
      if (!meta.has(p)) meta.set(p, { group: data.cast_group[i], total: Number(data.R2_total[i]) });
    });
    const groups = [...new Set(data.cast_group)].sort();
    const gRank = new Map(groups.map((g, i) => [g, i]));
    const prots = [...meta.keys()].sort((a, b) => (
      (gRank.get(meta.get(b).group) - gRank.get(meta.get(a).group))
      || (meta.get(a).total - meta.get(b).total)
    ));
    const comps = [...new Set(data.component)]
      .sort((a, b) => STACK_ORDER.indexOf(a) - STACK_ORDER.indexOf(b));
    const value = new Map();
    data.protein.forEach((p, i) => value.set(`${p}|${data.component[i]}`, Number(data.r2[i])));

    const out = comps.map((c) => ({
      type: 'bar',
      orientation: 'h',
      name: String(c),
      x: prots.map((p) => value.get(`${p}|${c}`) ?? 0),
      y: prots,
      marker: { color: compColor(c) },
      customdata: prots.map((p) => [meta.get(p).group, meta.get(p).total]),
      hovertemplate:
        '<b>%{y}</b> (%{customdata[0]})<br>%{fullData.name} increment = %{x:.4f}'
        + '<br>total cross-validated R² = %{customdata[1]:.4f}<extra></extra>',
    }));
    return { traces: out, order: prots };
  }, [data]);

  return (
    <SectionCard
      title="Exemplar protein decompositions"
      subtitle={'Nested incremental out-of-fold R² for the exemplar proteins carried through the '
        + 'spectrum above: covariates, then the increment added by genetics, by the exposome and '
        + 'by GxE. Bar length is that protein’s total cross-validated R².'}
      loading={loading}
      error={error}
    >
      {data && (
        <PlotPanel
          data={traces}
          height={420}
          layout={{
            barmode: 'stack',
            xaxis: { title: 'cross-validated R² (nested increments)' },
            yaxis: { categoryorder: 'array', categoryarray: order, automargin: true, ticks: '' },
            margin: { l: 110 },
            legend: { orientation: 'h', y: -0.16 },
          }}
        />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// h. Full per-protein spread of every component
// ---------------------------------------------------------------------------
const BOX_ORDER = ['Covariates', 'Genetic', 'cis', 'trans', 'Exposomic', 'GxE', 'Total'];


function VarianceArchitecture() {
  const { data, loading, error } = useSection('variance_architecture');

  const traces = useMemo(() => {
    if (!data) return [];
    const present = [...new Set(data.comp)];
    const comps = present.slice().sort((a, b) => {
      const ia = BOX_ORDER.indexOf(a);
      const ib = BOX_ORDER.indexOf(b);
      return (ia < 0 ? BOX_ORDER.length : ia) - (ib < 0 ? BOX_ORDER.length : ib);
    });
    return comps.map((c) => {
      const idx = data.comp.map((_, i) => i).filter((i) => data.comp[i] === c);
      return {
        type: 'box',
        name: String(c),
        y: idx.map((i) => data.r2[i]),
        text: idx.map((i) => data.omic[i]),
        marker: { color: compColor(c), size: 3, opacity: 0.5 },
        line: { color: compColor(c) },
        fillcolor: 'rgba(0,0,0,0)',
        boxpoints: 'outliers',
        hovertemplate: '%{text}<br>%{fullData.name} R² = %{y:.4f}<extra></extra>',
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="Per-protein spread of every component"
      subtitle={'Distribution across all measured proteins of each component’s R². cis and trans '
        + 'are sub-components of the genetic block and Total is the full model, so the boxes are '
        + 'not additive.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <PlotPanel
            data={traces}
            height={480}
            layout={{
              xaxis: { title: 'component', type: 'category' },
              yaxis: { title: 'R² per protein', zeroline: true, zerolinecolor: '#bbb' },
              showlegend: false,
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} maxHeight={320} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// i. Block-by-block increments
// ---------------------------------------------------------------------------


function PartitionMotivation() {
  const { data, loading, error } = useSection('partition_motivation');

  const traces = useMemo(() => {
    if (!data) return [];
    const idx = data.step.map((_, i) => i).sort((a, b) => data.x[a] - data.x[b]);
    return [{
      type: 'bar',
      x: idx.map((i) => data.step[i]),
      y: idx.map((i) => data.val[i]),
      base: idx.map((i) => data.ymin[i]),
      marker: { color: idx.map((i) => compColor(data.step[i])) },
      customdata: idx.map((i) => [String(data.abbr[i]), Number(data.ymin[i]), Number(data.ymax[i])]),
      hovertemplate:
        '<b>%{x}</b> (%{customdata[0]})<br>adds %{y:.4f} R²'
        + '<br>running total %{customdata[1]:.4f} → %{customdata[2]:.4f}<extra></extra>',
    }];
  }, [data]);

  return (
    <SectionCard
      title="What each block adds"
      subtitle={'Mean R² added to the proteome model as each block is entered in turn: covariates '
        + '(baseline), then the polygenic score, the polyexposure score and the gene-interaction '
        + 'score. Each bar starts where the previous one ended.'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <PlotPanel
            data={traces}
            height={380}
            layout={{
              xaxis: { title: 'block entered', type: 'category' },
              yaxis: { title: 'cumulative mean R²', zeroline: true, zerolinecolor: '#bbb' },
              showlegend: false,
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} maxHeight={240} />
        </>
      )}
    </SectionCard>
  );
}


// ---- the page's import block as it stood when these were removed ----
// import React, { useMemo } from 'react';
// import { Alert, Box, Chip, Typography } from '@mui/material';
// import { COMP_COLORS } from '../../lib/palette';
// import SectionCard from '../../components/SectionCard';
// import Disclosure from '../../components/Disclosure';
// import VarianceReach from '../../components/redesign/VarianceReach';
// import VarianceStack from '../../components/redesign/VarianceStack';
// import ExposomicGradient from '../../components/redesign/ExposomicGradient';
// import ColumnarTable from '../../components/ColumnarTable';
// import PlotPanel from '../../components/PlotPanel';
// import { useSection } from '../../lib/useSection';
