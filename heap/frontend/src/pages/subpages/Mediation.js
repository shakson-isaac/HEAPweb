import React, { useMemo, useState } from 'react';
import Select from 'react-select';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Chip, Link, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../../components/SectionCard';
import Disclosure from '../../components/Disclosure';
import PleiotropySpectrum from '../../components/redesign/PleiotropySpectrum';
import MediationGrid from '../../components/redesign/MediationGrid';
import DriverComparison from '../../components/redesign/DriverComparison';
import MediationLandscape from '../../components/redesign/MediationLandscape';
import ColumnarTable from '../../components/ColumnarTable';
import PlotPanel from '../../components/PlotPanel';
import { useSection, useKeys, useShard } from '../../lib/useSection';
import { ecatColor, prettyCategory } from '../../lib/palette';

// The packer recovers whole-column types, so a TSV "TRUE" arrives as a real
// JSON boolean. Accept either form rather than assuming one.
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

// Verbatim, and repeated next to every mediated-fraction number on the page.
// Do not reword: this is the manuscript's own statement of what an
// observational mediation estimate is and is not.
const CAVEAT = 'Observational mediation estimates are descriptive and may reflect '
  + 'confounding, reverse causation, or shared upstream causes. Causal support is '
  + 'evaluated separately using MR and colocalization.';

function Caveat({ withLink = false, sx }) {
  return (
    <Alert severity="info" sx={{ my: 2, ...sx }}>
      {CAVEAT}
      {withLink && (
        <Box sx={{ mt: 1 }}>
          <Link component={RouterLink} to="/results/causal">
            Causal adjudication — Mendelian randomization and colocalization →
          </Link>
        </Box>
      )}
    </Alert>
  );
}

// Mediation-class colors, mirroring scripts/visualizations/figures/fig_gem_landscape.R
// (COL) so the site and the manuscript figure agree.
const QUAD_COLORS = {
  'genetic-driven': '#1B6CA8',
  'exposure-driven': '#E07B39',
  'both (convergent)': '#7B3294',
  weak: '#CCCCCC',
};
const quadColor = (q) => QUAD_COLORS[q] || '#999999';

// The two genetic arms and the exposome total, as colored in
// fig_mediation_proportion.R / fig_gem_disease_dumbbell.R. Fine-grained
// exposure drivers keep their HEAP_ECAT_COLORS hue (S6).
const DRIVER_COLORS = {
  'Genetic (cis)': '#1B6CA8',
  'Genetic (trans)': '#6BAED6',
  'Exposomic (PXS)': '#E07B39',
};
const driverColor = (d) => DRIVER_COLORS[d] || ecatColor(d);

// fig_mediation_keystones.R abbreviates the dominant driver; map back to the
// category id so the bar takes the same hue as everywhere else on the site.
const KEYSTONE_DRIVER_ECAT = {
  'phys. activity': 'Exercise_Freq',
  alcohol: 'Alcohol',
  diet: 'Diet_Weekly',
  smoking: 'Smoking',
  sleep: 'Sleep',
  sun: 'Sun_Exposure',
  deprivation: 'Deprivation_Indices',
  internet: 'Internet_Usage',
};

const uniq = (a) => [...new Set(a)];
const rows = (d) => (d && Object.keys(d).length ? d[Object.keys(d)[0]].length : 0);
const idxOf = (d) => Array.from({ length: rows(d) }, (_, i) => i);

/* ------------------------------------------------------------------ *
 * Per-protein view: the two sharded sections, driven by one selector.
 * ------------------------------------------------------------------ */
function ProteinLinks() {
  const [protein, setProtein] = useState('LEP');
  const [panel, setPanel] = useState('a');

  const gemKeys = useKeys('gem_landscape');
  const propKeys = useKeys('mediation_proportion');

  // Only request a shard the key index actually lists; a missing key is an
  // empty state to explain, not a failed fetch to show as an error card.
  const inGem = !!(gemKeys.data && gemKeys.data.keys[protein]);
  const inProp = !!(propKeys.data && propKeys.data.keys[protein]);
  const gem = useShard('gem_landscape', inGem ? protein : null);
  const prop = useShard('mediation_proportion', inProp ? protein : null);

  const nGemKeys = gemKeys.data ? Object.keys(gemKeys.data.keys).length : 0;
  const nPropKeys = propKeys.data ? Object.keys(propKeys.data.keys).length : 0;

  const options = useMemo(() => {
    const all = new Set([
      ...(gemKeys.data ? Object.keys(gemKeys.data.keys) : []),
      ...(propKeys.data ? Object.keys(propKeys.data.keys) : []),
    ]);
    return [...all].sort().map((k) => ({ value: k, label: k }));
  }, [gemKeys.data, propKeys.data]);

  // Landscape: exposure-mediated HR against genetic-mediated HR, one point per
  // protein -> disease link, split by the exported mediation class.
  const gemTraces = useMemo(() => {
    const d = gem.data;
    if (!d || !rows(d)) return [];
    const cases = d.n_cases.map(Number);
    const lo = Math.min(...cases);
    const hi = Math.max(...cases);
    const size = (n) => 8 + 12 * Math.sqrt(hi > lo ? (n - lo) / (hi - lo) : 1);
    const xs = d.E_HR.map(Number).concat(1);
    const ys = d.G_HR.map(Number).concat(1);
    // HR = 1 drawn as data traces, not layout shapes: a shape anchored to a log
    // axis is re-read as a data value when plotly computes the autorange, which
    // drags the axis down to ~1e-68 and squashes every point into the corner.
    const ref = (x, y) => ({
      type: 'scatter',
      mode: 'lines',
      x,
      y,
      line: { color: '#999999', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false,
    });
    const span = (v) => [Math.min(...v) * 0.98, Math.max(...v) * 1.02];
    const [x0, x1] = span(xs);
    const [y0, y1] = span(ys);
    const guides = [ref([x0, x1], [1, 1]), ref([1, 1], [y0, y1])];
    return guides.concat(uniq(d.quad).map((q) => {
      const idx = idxOf(d).filter((i) => d.quad[i] === q);
      return {
        type: 'scattergl',
        mode: 'markers',
        name: q,
        x: idx.map((i) => Number(d.E_HR[i])),
        y: idx.map((i) => Number(d.G_HR[i])),
        customdata: idx.map((i) => [d.disease[i], Number(d.GEM[i]), Number(d.n_cases[i])]),
        hovertemplate:
          '<b>%{customdata[0]}</b>'
          + '<br>exposure-mediated HR = %{x:.3f}'
          + '<br>genetic-mediated HR = %{y:.3f}'
          + '<br>GEM = %{customdata[1]:.3f}'
          + '<br>%{customdata[2]:,} incident cases<extra>%{fullData.name}</extra>',
        marker: {
          size: idx.map((i) => size(Number(d.n_cases[i]))),
          color: quadColor(q),
          opacity: 0.75,
          line: { width: 0 },
        },
      };
    }));
  }, [gem.data]);

  // Forest of the mediated fraction per disease. Panel a is the exposome total
  // (one estimate per disease); panel b splits it by upstream driver.
  const forest = useMemo(() => {
    const d = prop.data;
    if (!d || !rows(d)) return { traces: [], diseases: [], nSig: 0, n: 0 };
    // A protein need not carry both panels; fall back to whichever it has so the
    // chart and the toggle never disagree about what is being shown.
    const avail = uniq(d.panel).sort();
    const use = avail.includes(panel) ? panel : avail[0];
    const idx = idxOf(d).filter((i) => d.panel[i] === use);
    const best = new Map();
    idx.forEach((i) => {
      const dz = d.disease[i];
      const pm = Number(d.pm_display[i]);
      if (!best.has(dz) || pm > best.get(dz)) best.set(dz, pm);
    });
    const diseases = [...best.keys()].sort((a, b) => best.get(a) - best.get(b));
    const traces = uniq(idx.map((i) => d.driver[i])).map((drv) => {
      const sel = idx.filter((i) => d.driver[i] === drv);
      return {
        type: 'scatter',
        mode: 'markers',
        name: prettyCategory(drv),
        x: sel.map((i) => Number(d.pm_display[i])),
        y: sel.map((i) => d.disease[i]),
        customdata: sel.map((i) => [
          Number(d.TE_HR[i]), Number(d.NIE_q[i]), Number(d.n_cases[i]),
        ]),
        hovertemplate:
          '<b>%{y}</b>'
          + '<br>proportion mediated = %{x:.3f}'
          + '<br>total effect HR = %{customdata[0]:.3f}'
          + '<br>NIE q = %{customdata[1]:.3g}'
          + '<br>%{customdata[2]:,} incident cases<extra>%{fullData.name}</extra>',
        marker: { size: 9, color: driverColor(drv), opacity: 0.8, line: { width: 0 } },
      };
    });
    const nSig = idx.filter((i) => Number(d.NIE_q[i]) < 0.05).length;
    return { traces, diseases, nSig, n: idx.length };
  }, [prop.data, panel]);

  const panels = prop.data ? uniq(prop.data.panel).sort() : [];
  const activePanel = panels.length && !panels.includes(panel) ? panels[0] : panel;

  return (
    <>
      <Box sx={{ minWidth: 300, maxWidth: 360, mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Protein</Typography>
        <Select
          options={options}
          value={{ value: protein, label: protein }}
          onChange={(o) => setProtein(o.value)}
          isSearchable
          placeholder="Search a protein…"
        />
      </Box>

      <SectionCard
        title="Genetic versus exposomic mediation landscape"
        subtitle={'One point per protein → disease link: the exposure-mediated indirect hazard '
          + 'ratio against the genetic-mediated one. Section gem_landscape (export of '
          + 'fig_gem_landscape), which carries only links the source figure classified.'}
        loading={gemKeys.loading || gem.loading}
        error={gemKeys.error || gem.error}
      >
        {!gemKeys.loading && !inGem && (
          <Alert severity="info" sx={{ my: 1 }}>
            {protein} is not one of the {nGemKeys.toLocaleString()} proteins in this section.
            {inProp
              ? ` It does appear in the proportion-mediated section (${nPropKeys.toLocaleString()} proteins), so it was tested there — absence here is absence of a classified link, not absence of a test.`
              : ` It does not appear in the proportion-mediated section (${nPropKeys.toLocaleString()} proteins) either.`}
          </Alert>
        )}
        {gem.data && rows(gem.data) > 0 && (
          <>
            <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`${rows(gem.data)} protein → disease links`} />
              {uniq(gem.data.quad).map((q) => (
                <Chip
                  key={q}
                  size="small"
                  variant="outlined"
                  label={`${gem.data.quad.filter((x) => x === q).length} ${q}`}
                  sx={{ borderColor: quadColor(q), color: quadColor(q) }}
                />
              ))}
              <Chip
                size="small"
                variant="outlined"
                label={`${Math.min(...gem.data.n_cases).toLocaleString()}–${Math.max(...gem.data.n_cases).toLocaleString()} incident cases`}
              />
            </Box>
            <PlotPanel
              data={gemTraces}
              height={480}
              layout={{
                title: { text: `${protein} — mediated disease links`, font: { size: 13 } },
                xaxis: { title: 'Exposure-mediated effect (indirect HR / SD)', type: 'log' },
                yaxis: { title: 'Genetic-mediated effect (indirect HR / SD)', type: 'log' },
                legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
                margin: { b: 90 },
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Marker area scales with incident cases. Dashed lines mark HR = 1 on each axis.
            </Typography>
          </>
        )}
        {gem.data && rows(gem.data) === 0 && (
          <Alert severity="info" sx={{ my: 1 }}>
            {protein} is listed in this section&apos;s key index but its shard has no rows.
          </Alert>
        )}
      </SectionCard>

      <SectionCard
        title="Proportion mediated, per disease"
        subtitle={'The fraction of the total effect on disease that runs through this protein '
          + '(NIE / total effect). Section mediation_proportion (export of fig_mediation_proportion).'}
        loading={propKeys.loading || prop.loading}
        error={propKeys.error || prop.error}
      >
        {!propKeys.loading && !inProp && (
          <Alert severity="info" sx={{ my: 1 }}>
            {protein} is not one of the {nPropKeys.toLocaleString()} proteins in this section.
            {inGem
              ? ` It does appear in the mediation-landscape section (${nGemKeys.toLocaleString()} proteins).`
              : ' It does not appear in the mediation-landscape section either.'}
          </Alert>
        )}
        {prop.data && rows(prop.data) > 0 && (
          <>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Driver resolution
                </Typography>
                <ToggleButtonGroup
                  size="small" exclusive value={activePanel}
                  onChange={(e, v) => v && setPanel(v)}
                >
                  {panels.map((p) => (
                    <ToggleButton key={p} value={p} sx={{ textTransform: 'none' }}>
                      {p === 'a' ? 'Exposome total' : 'By driver'}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${forest.n} estimates shown`} />
                <Chip size="small" variant="outlined" label={`${forest.diseases.length} diseases`} />
                <Chip size="small" variant="outlined" label={`${forest.traces.length} drivers`} />
                <Chip size="small" color="primary" label={`${forest.nSig} with NIE q < 0.05`} />
              </Box>
            </Box>
            <Caveat />
            {forest.n === 0 ? (
              <Alert severity="info" sx={{ my: 1 }}>
                No estimate for {protein} in this view of the section.
              </Alert>
            ) : (
              <PlotPanel
                data={forest.traces}
                height={Math.min(1000, 260 + 22 * forest.diseases.length)}
                layout={{
                  title: { text: `${protein} — proportion mediated`, font: { size: 13 } },
                  xaxis: { title: 'Proportion mediated (NIE / total effect)', range: [0, 1], tickformat: '.0%' },
                  yaxis: {
                    title: '',
                    automargin: true,
                    categoryorder: 'array',
                    categoryarray: forest.diseases,
                    tickfont: { size: 10 },
                  },
                  legend: { orientation: 'h', y: -0.12, font: { size: 10 } },
                  margin: { l: 240, b: 90 },
                }}
              />
            )}
            <ColumnarTable data={prop.data} initialRowsPerPage={10} />
          </>
        )}
      </SectionCard>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Exposure x disease scale grid.
 * ------------------------------------------------------------------ */
function ScaleGrid() {
  const { data, loading, error } = useSection('mediation_scale_main');
  const [metric, setMetric] = useState('n_prot');

  const { traces, diseases, total, nZero } = useMemo(() => {
    if (!data) return { traces: [], diseases: [], total: 0, nZero: 0 };
    const dz = uniq(data.disease); // payload order already groups diseases by system
    const t = uniq(data.category).map((cat) => {
      const idx = idxOf(data).filter((i) => data.category[i] === cat);
      return {
        type: 'bar',
        name: prettyCategory(cat),
        x: idx.map((i) => data.disease[i]),
        y: idx.map((i) => Number(data[metric][i])),
        customdata: idx.map((i) => [
          data.system[i], Number(data.n_prot[i]), Number(data.n_strong[i]), data.dcode[i],
        ]),
        hovertemplate:
          '<b>%{x}</b> (%{customdata[0]}, %{customdata[3]})'
          + '<br>%{customdata[1]} mediator proteins'
          + '<br>%{customdata[2]} above the strong-effect threshold'
          + '<extra>%{fullData.name}</extra>',
        marker: { color: ecatColor(cat) },
      };
    });
    return {
      traces: t,
      diseases: dz,
      total: data[metric].reduce((a, b) => a + Number(b), 0),
      nZero: data[metric].filter((v) => Number(v) === 0).length,
    };
  }, [data, metric]);

  return (
    <SectionCard
      title="How much mediation, and where"
      subtitle={'Proteins carrying an FDR-significant, sign-consistent mediated effect (NIE, '
        + 'n ≥ 100 cases) for each exposure category × disease cell, grouped by organ system. '
        + 'Section mediation_scale_main (export of fig_mediation_scale_main).'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 1 }}>
            <ToggleButtonGroup
              size="small" exclusive value={metric}
              onChange={(e, v) => v && setMetric(v)}
            >
              <ToggleButton value="n_prot" sx={{ textTransform: 'none' }}>All FDR-significant</ToggleButton>
              <ToggleButton value="n_strong" sx={{ textTransform: 'none' }}>Strong effect only</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`${rows(data)} exposure × disease cells`} />
              <Chip size="small" variant="outlined" label={`${diseases.length} diseases · ${uniq(data.system).length} organ systems`} />
              <Chip size="small" variant="outlined" label={`${total.toLocaleString()} protein counts summed`} />
              <Chip size="small" variant="outlined" label={`${nZero} cells at zero`} />
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            {metric === 'n_strong'
              ? 'Strong = |NIE| at or above the log(1.10) per-SD threshold used in scripts/support/module3_category_disease_full.R. A zero bar is a cell that was tested and had no protein reach that threshold — not an untested cell.'
              : 'Every cell shown was tested; the bar is the number of proteins that passed FDR in that cell.'}
          </Typography>
          <PlotPanel
            data={traces}
            height={480}
            layout={{
              barmode: 'group',
              xaxis: {
                title: 'disease (ordered by organ system)',
                categoryorder: 'array',
                categoryarray: diseases,
                tickangle: -35,
                automargin: true,
              },
              yaxis: { title: metric === 'n_prot' ? 'mediator proteins (FDR-significant)' : 'mediator proteins above the strong-effect threshold' },
              legend: { orientation: 'h', y: -0.42, font: { size: 10 } },
              margin: { b: 150 },
            }}
          />
        </>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ *
 * Keystone mediators: disease reach per protein.
 * ------------------------------------------------------------------ */
function Keystones() {
  const { data, loading, error } = useSection('mediation_keystones');

  const { traces, order } = useMemo(() => {
    if (!data) return { traces: [], order: [] };
    const idx = idxOf(data).sort((a, b) => Number(data.n_diseases[a]) - Number(data.n_diseases[b]));
    return {
      order: idx.map((i) => data.protID[i]),
      traces: [{
        type: 'bar',
        orientation: 'h',
        x: idx.map((i) => Number(data.n_diseases[i])),
        y: idx.map((i) => data.protID[i]),
        text: idx.map((i) => `${isTrue(data.drug[i]) ? '★' : ''}${isTrue(data.corrob[i]) ? '✓' : ''}`),
        textposition: 'outside',
        customdata: idx.map((i) => [
          data.drv[i],
          isTrue(data.corrob[i]) ? 'yes' : 'no',
          isTrue(data.drug[i]) ? 'yes' : 'no',
        ]),
        hovertemplate:
          '<b>%{y}</b><br>%{x} diseases mediated'
          + '<br>dominant driver: %{customdata[0]}'
          + '<br>cis-genetically corroborated: %{customdata[1]}'
          + '<br>known/candidate drug target: %{customdata[2]}<extra></extra>',
        marker: {
          color: idx.map((i) => ecatColor(KEYSTONE_DRIVER_ECAT[data.drv[i]] || 'Other')),
        },
      }],
    };
  }, [data]);

  return (
    <SectionCard
      title="Proteins with the widest disease reach"
      subtitle={'Diseases per protein with a strong, FDR-significant, sign-consistent mediated '
        + 'effect (≥ 300 cases). Bar color is the protein’s dominant lifestyle driver; '
        + '★ known/candidate drug target, ✓ cis-genetically corroborated. Section '
        + 'mediation_keystones (export of fig_mediation_keystones).'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${rows(data)} proteins`} />
            <Chip size="small" variant="outlined" label={`${data.corrob.filter(isTrue).length} cis-corroborated`} />
            <Chip size="small" variant="outlined" label={`${data.drug.filter(isTrue).length} drug targets`} />
            <Chip size="small" variant="outlined" label={`${uniq(data.drv).length} dominant drivers`} />
          </Box>
          <PlotPanel
            data={traces}
            height={80 + 30 * rows(data)}
            layout={{
              xaxis: { title: 'diseases mediated', dtick: 1 },
              yaxis: {
                title: '', automargin: true, categoryorder: 'array', categoryarray: order,
              },
              showlegend: false,
              margin: { l: 100, r: 60 },
            }}
          />
        </>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ *
 * Genetic vs exposure arm, one disease, dumbbell.
 * ------------------------------------------------------------------ */
function Dumbbell() {
  const { data, loading, error } = useSection('gem_disease_dumbbell');

  const { traces, order, disease } = useMemo(() => {
    if (!data) return { traces: [], order: [], disease: '' };
    // fig_gem_disease_dumbbell.R orders by GEM: exposure-driven at the bottom.
    const idx = idxOf(data).sort((a, b) => Number(data.GEM[a]) - Number(data.GEM[b]));
    const labels = idx.map((i) => data.protID[i]);
    const connector = {
      type: 'scatter',
      mode: 'lines',
      showlegend: false,
      hoverinfo: 'skip',
      x: idx.flatMap((i) => [Number(data.E_HR[i]), Number(data.G_HR[i]), null]),
      y: idx.flatMap((i) => [data.protID[i], data.protID[i], null]),
      line: { color: '#BBBBBB', width: 2 },
    };
    const arm = (name, hrCol, loCol, hiCol, color) => ({
      type: 'scatter',
      mode: 'markers',
      name,
      x: idx.map((i) => Number(data[hrCol][i])),
      y: labels,
      error_x: {
        type: 'data',
        symmetric: false,
        array: idx.map((i) => Number(data[hiCol][i]) - Number(data[hrCol][i])),
        arrayminus: idx.map((i) => Number(data[hrCol][i]) - Number(data[loCol][i])),
        color,
        thickness: 1.2,
        width: 0,
      },
      customdata: idx.map((i) => [
        Number(data[loCol][i]), Number(data[hiCol][i]),
        Number(data.GEM[i]), Number(data.n_cases[i]),
      ]),
      hovertemplate:
        '<b>%{y}</b><br>HR = %{x:.3f} (%{customdata[0]:.3f}–%{customdata[1]:.3f})'
        + '<br>GEM = %{customdata[2]:.3f}<br>%{customdata[3]:,} incident cases'
        + '<extra>%{fullData.name}</extra>',
      marker: { size: 10, color },
    });
    // HR = 1 as a data trace rather than a layout shape (see the landscape above).
    const guide = {
      type: 'scatter',
      mode: 'lines',
      x: [1, 1],
      y: [labels[0], labels[labels.length - 1]],
      line: { color: '#999999', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false,
    };
    return {
      order: labels,
      disease: uniq(data.disease).join(', '),
      traces: [
        guide,
        connector,
        arm('Exposure-mediated', 'E_HR', 'E_lo', 'E_hi', QUAD_COLORS['exposure-driven']),
        arm('Genetic-mediated', 'G_HR', 'G_lo', 'G_hi', QUAD_COLORS['genetic-driven']),
      ],
    };
  }, [data]);

  return (
    <SectionCard
      title="Genetic against exposure arm, per protein"
      subtitle={'Indirect (mediated) hazard ratio per SD with its 95% interval, for both arms of '
        + 'the same protein → disease link. Section gem_disease_dumbbell (export of '
        + 'fig_gem_disease_dumbbell).'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${rows(data)} proteins`} />
            <Chip size="small" variant="outlined" label={disease} />
            <Chip
              size="small"
              variant="outlined"
              label={`${Math.min(...data.n_cases).toLocaleString()}–${Math.max(...data.n_cases).toLocaleString()} incident cases`}
            />
          </Box>
          <PlotPanel
            data={traces}
            height={120 + 30 * rows(data)}
            layout={{
              xaxis: { title: 'Indirect (mediated) hazard ratio / SD', type: 'log' },
              yaxis: {
                title: '', automargin: true, categoryorder: 'array', categoryarray: order,
              },
              legend: { orientation: 'h', y: -0.16, font: { size: 10 } },
              margin: { l: 110, b: 80 },
            }}
          />
        </>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ *
 * Exemplar chains: which driver carries each protein's mediation.
 * ------------------------------------------------------------------ */
function Exemplars() {
  const { data, loading, error } = useSection('mediation_exemplars');
  const [chain, setChain] = useState(null);

  const panels = useMemo(() => (data ? uniq(data.panel) : []), [data]);
  const active = chain && panels.includes(chain) ? chain : panels[0];

  const { traces, order, nSig, nNoInstrument } = useMemo(() => {
    if (!data || !active) return { traces: [], order: [], nSig: 0, nNoInstrument: 0 };
    const idx = idxOf(data)
      .filter((i) => data.panel[i] === active)
      .sort((a, b) => Number(data.effect_logHR[a]) - Number(data.effect_logHR[b]));
    return {
      order: idx.map((i) => data.driver[i]),
      nSig: idx.filter((i) => isTrue(data.sig[i])).length,
      nNoInstrument: idx.filter((i) => !isTrue(data.instrument_present[i])).length,
      traces: [{
        type: 'bar',
        orientation: 'h',
        x: idx.map((i) => Number(data.effect_logHR[i])),
        y: idx.map((i) => data.driver[i]),
        customdata: idx.map((i) => [
          Number(data.effect_HR[i]), Number(data.delta_q[i]),
          isTrue(data.sig[i]) ? 'FDR-significant' : 'tested, not significant',
          isTrue(data.instrument_present[i]) ? 'instrument present' : 'no instrument (not testable)',
        ]),
        hovertemplate:
          '<b>%{y}</b><br>mediated HR = %{customdata[0]:.3f}'
          + '<br>log HR = %{x:.4f}<br>q = %{customdata[1]:.3g}'
          + '<br>%{customdata[2]}<br>%{customdata[3]}<extra></extra>',
        marker: {
          color: idx.map((i) => (data.category[i]
            ? ecatColor(data.category[i])
            : DRIVER_COLORS[data.driver[i]] || '#888888')),
          opacity: idx.map((i) => {
            if (!isTrue(data.instrument_present[i])) return 0.15;
            return isTrue(data.sig[i]) ? 0.95 : 0.35;
          }),
          line: { color: '#555', width: 0.6 },
        },
      }],
    };
  }, [data, active]);

  return (
    <SectionCard
      title="What drives each exemplar chain"
      subtitle={'Mediated hazard ratio (NIE) contributed by each upstream driver, through the '
        + 'named protein into the named disease. Section mediation_exemplars (export of '
        + 'fig_mediation_exemplars).'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ minWidth: 300, maxWidth: 520, mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Chain</Typography>
            <Select
              options={panels.map((p) => ({ value: p, label: p.replace(/\n/g, ' · ') }))}
              value={active ? { value: active, label: active.replace(/\n/g, ' · ') } : null}
              onChange={(o) => setChain(o.value)}
              isSearchable
            />
          </Box>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${order.length} drivers`} />
            <Chip size="small" color="primary" label={`${nSig} FDR-significant`} />
            <Chip size="small" variant="outlined" label={`${order.length - nSig - nNoInstrument} tested, not significant`} />
            <Chip size="small" variant="outlined" label={`${nNoInstrument} not testable (no instrument)`} />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Solid bars are FDR-significant, faded bars were tested and did not pass, and near-transparent
            bars had no instrument available, so they were never testable.
          </Typography>
          <PlotPanel
            data={traces}
            height={140 + 26 * order.length}
            layout={{
              title: { text: active ? active.replace(/\n/g, ' · ') : '', font: { size: 12 } },
              xaxis: { title: 'mediated log hazard ratio (NIE) through the protein  ·  0 = no effect', zeroline: true, zerolinecolor: '#999' },
              yaxis: {
                title: '', automargin: true, categoryorder: 'array', categoryarray: order, tickfont: { size: 10 },
              },
              showlegend: false,
              margin: { l: 190, t: 50 },
            }}
          />
          <ColumnarTable data={data} initialRowsPerPage={10} />
        </>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ *
 * Lifestyle -> protein -> disease conduits (table by design).
 * ------------------------------------------------------------------ */
function Conduits() {
  const { data, loading, error } = useSection('mediation_conduit');
  return (
    <SectionCard
      title="Lifestyle → protein → disease conduits"
      subtitle={'Every row is one FDR-significant, sign-consistent mediated link for a modifiable '
        + 'exposure domain. Section mediation_conduit (export of fig_mediation_conduit).'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${rows(data)} conduits`} />
            <Chip size="small" variant="outlined" label={`${uniq(data.Lifestyle).length} lifestyle domains`} />
            <Chip size="small" variant="outlined" label={`${uniq(data.protID).length} proteins`} />
            <Chip size="small" variant="outlined" label={`${uniq(data.disease).length} diseases`} />
          </Box>
          <Caveat />
          <ColumnarTable data={data} initialRowsPerPage={25} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            pm_display is the mediated fraction; NIE_HR the mediated hazard ratio per SD;
            protein_HR the protein&apos;s own hazard ratio for the disease.
          </Typography>
        </>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ *
 * Prioritization: three panels of a summary figure, one axis each.
 * ------------------------------------------------------------------ */
const PRIORITIZATION_PANELS = {
  a: {
    label: 'Proportion mediated',
    axis: 'Proportion mediated (NIE / total effect)',
    tickformat: '.0%',
    color: () => QUAD_COLORS['exposure-driven'],
  },
  b: {
    label: 'Mediated hazard ratio',
    axis: 'Mediated hazard ratio (NIE) per SD',
    tickformat: '',
    color: () => QUAD_COLORS['both (convergent)'],
  },
  c: {
    label: 'Exposure anchoring',
    axis: 'Spearman ρ between a protein’s exposure R² and its mediated effect',
    tickformat: '',
    color: (key) => ecatColor(String(key).replace(/ /g, '_')),
  },
};

function Prioritization() {
  const { data, loading, error } = useSection('mediation_prioritization');
  const [panel, setPanel] = useState('a');

  const panels = data ? uniq(data.panel).sort() : [];
  const active = panels.length && !panels.includes(panel) ? panels[0] : panel;
  const spec = PRIORITIZATION_PANELS[active] || PRIORITIZATION_PANELS.a;

  const { traces, order } = useMemo(() => {
    if (!data) return { traces: [], order: [] };
    const idx = idxOf(data)
      .filter((i) => data.panel[i] === active)
      .sort((a, b) => Number(data.value[a]) - Number(data.value[b]));
    return {
      order: idx.map((i) => data.key[i]),
      traces: [{
        type: 'bar',
        orientation: 'h',
        x: idx.map((i) => Number(data.value[i])),
        y: idx.map((i) => data.key[i]),
        hovertemplate: '<b>%{y}</b><br>%{x:.4f}<extra></extra>',
        marker: { color: idx.map((i) => spec.color(data.key[i])) },
      }],
    };
  }, [data, active, spec]);

  return (
    <SectionCard
      title="Prioritized links"
      subtitle={'The three summary panels of the prioritization figure: the mediated fraction of '
        + 'the strongest links, the mediated hazard ratio of the shortlist, and how strongly each '
        + 'exposure category’s proteomic reach tracks its mediated effect. Section '
        + 'mediation_prioritization (export of fig_mediation_prioritization).'}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 1 }}>
            <ToggleButtonGroup
              size="small" exclusive value={active}
              onChange={(e, v) => v && setPanel(v)}
            >
              {panels.map((p) => (
                <ToggleButton key={p} value={p} sx={{ textTransform: 'none' }}>
                  {(PRIORITIZATION_PANELS[p] || {}).label || p}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Chip size="small" label={`${order.length} rows in this panel`} />
          </Box>
          {active === 'a' && <Caveat />}
          <PlotPanel
            data={traces}
            height={140 + 26 * order.length}
            layout={{
              xaxis: { title: spec.axis, tickformat: spec.tickformat, zeroline: true, zerolinecolor: '#999' },
              yaxis: {
                title: '', automargin: true, categoryorder: 'array', categoryarray: order, tickfont: { size: 10 },
              },
              showlegend: false,
              margin: { l: 190 },
            }}
          />
        </>
      )}
    </SectionCard>
  );
}

export default function Mediation() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Disease links</Typography>
      <Typography variant="body1" sx={{ mb: 1, maxWidth: 900 }}>
        Each protein → disease link estimated by the mediation analysis: how much of an
        exposure&apos;s effect on disease is carried by the protein, how that compares with the
        genetic arm of the same link, and which lifestyle domain the exposure arm comes from.
        Every estimate here comes from proportional-hazards mediation models fitted in UK Biobank —
        not from a trial and not from an instrumental-variable design.
      </Typography>
      <Caveat withLink />

      {/* Four lead visuals, left all visible while the remaining partitioned
          specifications finish. Which one deserves to lead depends on how they
          read across five specifications rather than one, so the order here is
          provisional and the page says so. */}
      <PleiotropySpectrum />
      <MediationGrid />
      <DriverComparison />
      <MediationLandscape />

      <Disclosure
        title="the earlier panels"
        count={7}
        note={
          'Seven figure exports fixed at the base specification. Kept because several have no '
          + 'other view on the site.'
        }
      >
        <ProteinLinks />
        <ScaleGrid />
        <Keystones />
        <Dumbbell />
        <Exemplars />
        <Conduits />
        <Prioritization />
      </Disclosure>
    </Box>
  );
}
