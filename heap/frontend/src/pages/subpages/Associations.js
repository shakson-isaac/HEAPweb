import React, { useMemo, useState } from 'react';
import Select from 'react-select';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Chip, Alert } from '@mui/material';
import SectionCard from '../../components/SectionCard';
import ColumnarTable from '../../components/ColumnarTable';
import PlotPanel from '../../components/PlotPanel';
import { useKeys, useShard } from '../../lib/useSection';
import { ecatColor, prettyExposure, prettyCategory } from '../../lib/palette';

// The packer recovers whole-column types, so a TSV "TRUE" arrives as a real
// JSON boolean. Accept either form rather than assuming one.
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

// Covariate specifications, from HEAP/config/covariates/covariate_sets.yml.
// `base` is PRIMARY and is what every main figure uses; the rest are
// supplementary sensitivity layers built on top of it. base_ses is deliberately
// absent -- it is Module-2 only and over-adjusts by pulling deprivation out of
// the exposome, and the site used to serve it unlabelled as "Type6".
const SPECS = [
  { id: 'assoc_base', label: 'Primary', note: 'base: age, age², sex, their interactions, assessment centre, 20 genetic PCs' },
  { id: 'assoc_base_plus_bmi', label: '+ BMI', note: 'base + BMI. A sensitivity layer, NOT a mediation test — attenuation here cannot separate mediation from confounding' },
  { id: 'assoc_base_plus_blood_draw', label: '+ blood draw', note: 'base + fasting time and assessment season' },
  { id: 'assoc_base_plus_clinical', label: '+ clinical', note: 'base + BMI, fasting, season and 5 medication classes (maximal explicit adjustment)' },
  { id: 'assoc_exclude_prevalent_disease', label: 'Healthy at baseline', note: 'base, restricted to participants without prevalent major disease' },
];

export default function Associations() {
  const [specId, setSpecId] = useState('assoc_base');
  const [protein, setProtein] = useState('LEP');
  const [testOnly, setTestOnly] = useState(false);

  const { data: keyIndex, loading: kLoading, error: kError } = useKeys('assoc_base');
  const { data, loading, error } = useShard(specId, protein);
  const spec = SPECS.find((s) => s.id === specId);

  const options = useMemo(
    () => (keyIndex ? Object.keys(keyIndex.keys).sort().map((k) => ({ value: k, label: k })) : []),
    [keyIndex]
  );

  // Miami plot: signed −log10(p) so direction is readable at a glance, exposures
  // ordered and colored by category so related exposures cluster.
  const { traces, nRepl } = useMemo(() => {
    if (!data) return { traces: [], nRepl: 0 };
    const beta = testOnly ? data.beta_test : data.beta_train;
    const pval = testOnly ? data.p_test : data.p_train;
    const se = testOnly ? data.SE_test : data.SE_train;
    const n = testOnly ? data.N_test : data.N_train;

    const order = data.Term.map((_, i) => i).sort((a, b) => {
      const c = String(data.Category[a]).localeCompare(String(data.Category[b]));
      return c || String(data.Exposure[a]).localeCompare(String(data.Exposure[b]));
    });
    const pos = new Map(order.map((rowIdx, x) => [rowIdx, x]));

    const cats = [...new Set(order.map((i) => data.Category[i]))];
    const out = cats.map((cat) => {
      const idx = order.filter((i) => data.Category[i] === cat);
      return {
        type: 'scattergl',
        mode: 'markers',
        name: prettyCategory(cat),
        x: idx.map((i) => pos.get(i)),
        y: idx.map((i) => {
          const p = Number(pval[i]);
          const lp = p > 0 ? -Math.log10(p) : 320;
          return Math.sign(Number(beta[i]) || 0) * lp;
        }),
        customdata: idx.map((i) => [
          prettyExposure(data.Exposure[i]), data.Term[i],
          Number(beta[i]), Number(se[i]), Number(pval[i]),
          Number(n[i]), isTrue(data.replicated[i]) ? 'yes' : 'no',
        ]),
        hovertemplate:
          '<b>%{customdata[0]}</b><br>term: %{customdata[1]}'
          + '<br>β = %{customdata[2]:.4f} ± %{customdata[3]:.4f}'
          + '<br>p = %{customdata[4]:.3g}'
          + '<br>N = %{customdata[5]:,}'
          + '<br>replicated: %{customdata[6]}<extra>%{fullData.name}</extra>',
        marker: {
          size: idx.map((i) => (isTrue(data.replicated[i]) ? 7 : 4.5)),
          color: ecatColor(cat),
          opacity: idx.map((i) => (isTrue(data.replicated[i]) ? 0.95 : 0.35)),
          line: { width: 0 },
        },
      };
    });
    const repl = data.replicated.filter(isTrue).length;
    return { traces: out, nRepl: repl };
  }, [data, testOnly]);

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 2, maxWidth: 900 }}>
        Every lifestyle exposure tested against the selected protein. Points above zero are
        positive associations, below zero negative; solid points replicated across the
        train/test split. Hover for effect size, standard error, p-value and sample size.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 1 }}>
        <Box sx={{ minWidth: 300 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Protein</Typography>
          <Select
            options={options}
            value={{ value: protein, label: protein }}
            onChange={(o) => setProtein(o.value)}
            isSearchable
            placeholder="Search a protein…"
          />
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Covariate specification
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={specId}
            onChange={(e, v) => v && setSpecId(v)}
          >
            {SPECS.map((s) => (
              <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none' }}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Split
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={testOnly}
            onChange={(e, v) => v !== null && setTestOnly(v)}
          >
            <ToggleButton value={false} sx={{ textTransform: 'none' }}>Train</ToggleButton>
            <ToggleButton value={true} sx={{ textTransform: 'none' }}>Test</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        {spec?.note}
      </Typography>

      <SectionCard loading={kLoading || loading} error={kError || error}>
        {data && (
          <>
            <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip size="small" label={`${data.Term.length} terms tested`} />
              <Chip size="small" color="primary" label={`${nRepl} replicated`} />
              <Chip size="small" variant="outlined" label={`${new Set(data.Exposure).size} exposures`} />
            </Box>
            <PlotPanel
              data={traces}
              height={520}
              layout={{
                xaxis: { title: 'exposures, ordered by category', showticklabels: false, type: 'linear' },
                yaxis: { title: 'signed −log10 p', zeroline: true, zerolinecolor: '#999', type: 'linear' },
                title: { text: `${protein} — ${spec?.label}`, font: { size: 13 } },
                legend: { orientation: 'h', y: -0.18, font: { size: 10 } },
                margin: { b: 110 },
              }}
            />
            <Alert severity="info" sx={{ my: 2 }}>
              These are <b>per-term</b> tests (one row per model term × protein). The abstract's
              headline of 22,240 replicated associations counts <b>exposure–protein pairs</b> via a
              block F-test, which is a different test — the two counts are not interconvertible.
            </Alert>
            <ColumnarTable data={data} initialRowsPerPage={25} />
          </>
        )}
      </SectionCard>
    </Box>
  );
}
