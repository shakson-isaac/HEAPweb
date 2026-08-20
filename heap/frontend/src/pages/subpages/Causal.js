import React, { useMemo, useState } from 'react';
import Select from 'react-select';
import {
  Alert, Box, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../../components/SectionCard';
import ColumnarTable from '../../components/ColumnarTable';
import PlotPanel from '../../components/PlotPanel';
import ArmNotice, { ArmChip } from '../../components/ArmNotice';
import ColocRegional from '../../components/ColocRegional';
import MotifKey from '../../components/MotifKey';
import EntityMotifBrowser from '../../components/EntityMotifBrowser';
import PDEffects from '../../components/PDEffects';
import PlatformConcordance from '../../components/PlatformConcordance';
import MotifTrace from '../../components/MotifTrace';
import TriadDAG from '../../components/TriadDAG';
import { useSection } from '../../lib/useSection';
import { ecatColor } from '../../lib/palette';

const STATUS_COLOR = {
  'Colocalized (shared variant)': '#1b7837',
  'LD-confounded (distinct variants)': '#b2182b',
  Inconclusive: '#999999',
};

// The packer recovers whole-column types, so a TSV "TRUE" arrives as a real
// JSON boolean. Accept either form rather than assuming one.
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

// "smoking_status_f20116_0_0_Never" -> "Smoking status (Never)". Keeping the
// factor level matters here: three of the six Tier-1 mediator triads are keyed
// on a level, and dropping it merges them with the continuous field.
const prettyExposure = (x) => {
  const s = String(x);
  const m = s.match(/^(.*?)_f\d+_\d+_\d+(?:_(.+))?$/);
  const base = (m ? m[1] : s).replace(/_/g, ' ');
  const level = m && m[2] ? ` (${m[2].replace(/_/g, ' ')})` : '';
  return base.replace(/^\w/, (c) => c.toUpperCase()) + level;
};

// FinnGen endpoint ids are opaque, but every row carries the matched UK Biobank
// first-occurrence field, whose name is the ICD-10 rubric in words. Read the
// label out of the payload rather than hand-typing a code map (S8).
//   age_e78_first_reported_disorders_of_lipoprotein_metabolism…_f130814_0_0
//   -> "Disorders of lipoprotein metabolism and other lipidaemias"
const prettyDisease = (x, ukbField) => {
  if (ukbField) {
    const s = String(ukbField)
      .replace(/^age_/, '')
      .replace(/_f\d+.*$/, '')
      .replace(/^[a-z]\d+[a-z0-9]*_/, '')
      .replace(/^first_reported_/, '')
      .replace(/_/g, ' ');
    if (s) return s.replace(/^\w/, (c) => c.toUpperCase());
  }
  return String(x).replace(/^finngen_R12_/, '').replace(/_/g, ' ');
};

const idxWhere = (arr, val) =>
  arr.reduce((acc, v, i) => (v === val ? (acc.push(i), acc) : acc), []);

// ---------------------------------------------------------------------------
// Triad DAG explorer — the interactive counterpart of panel e of Figure 4.
// ---------------------------------------------------------------------------

// The five motif rules, transcribed from the definitions in
// HEAP/scripts/analysis_summaries/summarize_mr_triads.R. Every clause is a
// Tier-1 edge-set membership test, and the absences are as load-bearing as the
// presences — which is why the diagram draws all six directions.
const MOTIFS = {
  A: {
    letter: 'A',
    name: 'Mediator (E → P → D)',
    rule: 'E→P, P→D and E→D all in the Tier-1 edge set; P→E, D→P and D→E all absent',
    shape: 'All three forward edges are present and none of the three reverse edges are.',
  },
  B: {
    letter: 'B',
    name: 'Biomarker',
    rule: 'E→P, E→D and D→P present; P→D, P→E and D→E absent',
    shape: 'The exposure edges are present, protein→disease is absent, and disease→protein is present.',
  },
  C: {
    letter: 'C',
    name: 'Exposure-marker',
    rule: 'E→P and E→D present; P→D, P→E and D→P absent',
    shape: 'The exposure edges are present and no Tier-1 edge runs between protein and disease.',
  },
  D: {
    letter: 'D',
    name: 'Reverse (P → E)',
    rule: 'P→E present and E→P absent',
    shape: 'The only Tier-1 edge between exposure and protein runs from protein to exposure.',
  },
  E: {
    letter: 'E',
    name: 'Disease-liability (D → P)',
    rule: 'D→P and D→E both present',
    shape: 'Disease liability carries a Tier-1 edge to both the protein and the exposure.',
  },
};

const EST_KEYS = ['EP', 'PDcis', 'PDtrans', 'ED', 'PEcis', 'PEtrans', 'DP', 'DE'];
const FLAG_KEYS = ['pEP', 'pPD', 'pED', 'pPE', 'pDP', 'pDE'];
const OPTION_CAP = 300;

function TriadExplorer({ motif: motifProp, onMotif, query: queryProp, onQuery }) {
  const { data, loading, error } = useSection('mr_triads');
  // deCODE corroboration for the same 18,780 triads, joined on (E, P, D).
  // Protein-involving edges only -- E->D and D->E have no protein for the
  // alternative panel to instrument and are identical across panels.
  const { data: dec } = useSection('mr_triads_decode');
  // per-edge mr_tier_final, both panels -- so Tier 1+ is visible rather than
  // collapsed into the presence flags the motif rules use
  const { data: tierTbl } = useSection('mr_triad_tiers');
  const [picked, setPicked] = useState(null);
  // Controlled when the page supplies a filter (clicking a pattern in the
  // reading key or the browser above), self-managed otherwise, so the explorer
  // still works standalone.
  const [motifLocal, setMotifLocal] = useState('all');
  const [queryLocal, setQueryLocal] = useState('');
  const motif = motifProp ?? motifLocal;
  const query = queryProp ?? queryLocal;
  const setMotif = onMotif ?? setMotifLocal;
  const setQuery = onQuery ?? setQueryLocal;
  const [instrument, setInstrument] = useState('cis');

  // One pass over the 18,780 triads builds the display labels and a lowercase
  // haystack; the selector then filters indices instead of rebuilding strings.
  const meta = useMemo(() => {
    if (!data) return null;
    const n = data.Exposure.length;
    const out = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const e = prettyExposure(data.Exposure[i]);
      const p = data.Protein[i];
      const d = prettyDisease(data.Disease[i], data.Disease_UKB && data.Disease_UKB[i]);
      const code = String(data.Disease[i]).replace(/^finngen_R12_/, '');
      out[i] = {
        i,
        letters: String(data.motif[i]).split(';').map((s) => s.trim().charAt(0)),
        label: `${e} → ${p} → ${d} · ${code}`,
        hay: `${e} ${p} ${d} ${code} ${data.Exposure[i]}`.toLowerCase(),
      };
    }
    return out;
  }, [data]);

  // Default: the first Tier-1 mediator triad in the published table, which is
  // also the strongest of the six by the weakest of its three required edges.
  const fallback = useMemo(
    () => (data ? Math.max(0, data.motif.findIndex((m) => String(m).charAt(0) === 'A')) : 0),
    [data]
  );
  const sel = picked === null ? fallback : picked;

  const decIndex = useMemo(() => {
    if (!dec) return null;
    const m = new Map();
    for (let i = 0; i < dec.Exposure.length; i += 1) {
      m.set(`${dec.Exposure[i]}|${dec.Protein[i]}|${dec.Disease[i]}`, i);
    }
    return m;
  }, [dec]);

  // Final tier per direction for the selected triad, read from the same flags
  // the motif rules use, so step 2 of the trace shows values rather than prose.
  const edgeTiers = useMemo(() => {
    if (!data) return null;
    const out = {};
    for (const [k, label] of [['pEP', 'E→P'], ['pPD', 'P→D'], ['pED', 'E→D'],
                              ['pPE', 'P→E'], ['pDP', 'D→P'], ['pDE', 'D→E']]) {
      const on = data[k] && (data[k][sel] === true || String(data[k][sel]).toUpperCase() === 'TRUE');
      out[label] = on ? 'Tier 1 or better' : 'below Tier 1';
    }
    return out;
  }, [data, sel]);

  const triadTiers = useMemo(() => {
    if (!data || !tierTbl) return null;
    const key = `${data.Exposure[sel]}|${data.Protein[sel]}|${data.Disease[sel]}`;
    for (let i = 0; i < tierTbl.Exposure.length; i += 1) {
      if (`${tierTbl.Exposure[i]}|${tierTbl.Protein[i]}|${tierTbl.Disease[i]}` === key) {
        const out = {};
        for (const c of Object.keys(tierTbl)) {
          if (c.startsWith('tier_')) out[c] = tierTbl[c][i];
        }
        return out;
      }
    }
    return null;
  }, [data, tierTbl, sel]);

  const decodeEst = useMemo(() => {
    if (!data || !dec || !decIndex) return null;
    const i = decIndex.get(`${data.Exposure[sel]}|${data.Protein[sel]}|${data.Disease[sel]}`);
    if (i === undefined) return null;
    const out = {};
    for (const col of ['EP', 'PDcis', 'PDtrans', 'PEcis', 'PEtrans', 'DP']) {
      out[col] = {
        beta: dec[`beta_${col}`] ? dec[`beta_${col}`][i] : null,
        se: dec[`se_${col}`] ? dec[`se_${col}`][i] : null,
        padj: dec[`padj_${col}`] ? dec[`padj_${col}`][i] : null,
      };
    }
    return out;
  }, [data, dec, decIndex, sel]);

  const mediators = useMemo(
    () => (meta ? meta.filter((m) => m.letters.includes('A')) : []),
    [meta]
  );

  // 18,780 options is far too many to hand react-select, so the search box
  // drives the filter and only the first OPTION_CAP matches are materialized.
  const { options, nMatch } = useMemo(() => {
    if (!meta) return { options: [], nMatch: 0 };
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    let count = 0;
    for (const m of meta) {
      if (motif !== 'all' && !m.letters.includes(motif)) continue;
      if (terms.length && !terms.every((t) => m.hay.includes(t))) continue;
      count += 1;
      if (out.length < OPTION_CAP) out.push({ value: m.i, label: m.label });
    }
    return { options: out, nMatch: count };
  }, [meta, motif, query]);

  const triad = useMemo(() => {
    if (!data || !meta) return null;
    const i = sel;
    const est = {};
    for (const k of EST_KEYS) {
      est[k] = {
        beta: data[`beta_${k}`] ? data[`beta_${k}`][i] : null,
        se: data[`se_${k}`] ? data[`se_${k}`][i] : null,
        padj: data[`padj_${k}`] ? data[`padj_${k}`][i] : null,
      };
    }
    const flags = {};
    for (const k of FLAG_KEYS) flags[k] = isTrue(data[k][i]);
    return {
      exposure: data.Exposure[i],
      exposureLabel: prettyExposure(data.Exposure[i]),
      category: data['Exposure category'][i],
      protein: data.Protein[i],
      disease: data.Disease[i],
      diseaseLabel: prettyDisease(data.Disease[i], data.Disease_UKB && data.Disease_UKB[i]),
      icd10: data.ICD10 ? data.ICD10[i] : '',
      motif: String(data.motif[i]),
      flags,
      est,
    };
  }, [data, meta, sel]);

  const nPresent = triad ? FLAG_KEYS.filter((k) => triad.flags[k]).length : 0;
  const motifKeys = triad ? triad.motif.split(';').map((s) => s.trim().charAt(0)) : [];

  return (
    <SectionCard
      title="Triad explorer — the six directed relationships"
      subtitle={
        'Pick any exposure → protein → disease triad and read its whole Mendelian randomization '
        + 'edge set at once. The three reverse edges are drawn alongside the forward ones because '
        + 'the motif rules are defined by which reverse edges are absent.'
      }
      loading={loading}
      error={error}
    >
      {data && triad && (
        <>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap', mb: 1.5 }}>
            <Box sx={{ flex: '1 1 460px', minWidth: 320 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Triad — type to search {data.Exposure.length.toLocaleString()} of them by exposure,
                protein or disease
              </Typography>
              <Select
                options={options}
                value={{ value: sel, label: meta[sel].label }}
                onChange={(o) => setPicked(o.value)}
                onInputChange={(v, a) => { if (a.action === 'input-change') setQuery(v); }}
                filterOption={null}
                isSearchable
                placeholder="Search FURIN, hypertension, pack years…"
                noOptionsMessage={() => 'No triad matches that search in this motif'}
                styles={{ menu: (b) => ({ ...b, zIndex: 20 }) }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {nMatch.toLocaleString()} triad{nMatch === 1 ? '' : 's'} match
                {nMatch > OPTION_CAP ? ` — first ${OPTION_CAP} listed; keep typing to narrow` : ''}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Motif
              </Typography>
              <ToggleButtonGroup
                size="small" exclusive value={motif}
                onChange={(e, v) => v && setMotif(v)}
              >
                <ToggleButton value="all" sx={{ textTransform: 'none' }}>All</ToggleButton>
                {Object.keys(MOTIFS).map((k) => (
                  <ToggleButton key={k} value={k} sx={{ textTransform: 'none' }}>
                    {k}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Protein instruments
              </Typography>
              <ToggleButtonGroup
                size="small" exclusive value={instrument}
                onChange={(e, v) => v && setInstrument(v)}
              >
                <ToggleButton value="cis" sx={{ textTransform: 'none' }}>cis</ToggleButton>
                <ToggleButton value="trans" sx={{ textTransform: 'none' }}>trans</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Six Tier-1 mediator triads:
            </Typography>
            {mediators.map((m) => (
              <Chip
                key={m.i}
                size="small"
                title={m.label}
                label={
                  m.label.split(' · ')[0].length > 46
                    ? `${m.label.split(' · ')[0].slice(0, 45)}…`
                    : m.label.split(' · ')[0]
                }
                onClick={() => { setPicked(m.i); setMotif('all'); }}
                color={m.i === sel ? 'primary' : 'default'}
                variant={m.i === sel ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          <PlatformConcordance protein={data.Protein[sel]} />
          <MotifTrace triad={triad} tiers={edgeTiers} tierTable={triadTiers} />
          <TriadDAG triad={triad} decode={decodeEst} tiers={triadTiers} instrument={instrument} />

          <Box sx={{ mt: 3, p: 1.75, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
              <Chip
                size="small"
                label={triad.motif}
                sx={{ bgcolor: '#1f4e79', color: '#fff', fontWeight: 600 }}
              />
              <Chip
                size="small" variant="outlined"
                label={`${nPresent} of 6 directions in the Tier-1 edge set`}
              />
              <Chip
                size="small" variant="outlined"
                label={`ICD-10 ${triad.icd10 || 'n/a'}`}
              />
              <Chip
                size="small"
                label={String(triad.category).replace(/_/g, ' ')}
                sx={{ bgcolor: ecatColor(triad.category), color: '#fff' }}
              />
            </Box>
            {motifKeys.map((k) => (
              MOTIFS[k] ? (
                <Box key={k} sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Motif {MOTIFS[k].letter} — {MOTIFS[k].name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Rule: {MOTIFS[k].rule}. {MOTIFS[k].shape}
                  </Typography>
                </Box>
              ) : null
            ))}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Motifs are assigned per (exposure, protein, disease) triad, never per protein: the
              same protein carries different motifs against different diseases.
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            The <b>protein → disease</b> and <b>protein → exposure</b> directions are instrumented
            twice, by cis- and by trans-pQTLs; the toggle above chooses which estimate the diagram
            labels, and the table under it always shows both. Tier-1 membership is recorded once per
            direction over the pooled instruments. Absent edges are shown, not hidden — an edge that
            was never tested is drawn differently from one that was tested and missed the threshold.
          </Alert>
        </>
      )}
    </SectionCard>
  );
}

function MotifCounts() {
  const { data, loading, error } = useSection('mr_motif_counts');
  const traces = useMemo(() => {
    if (!data) return [];
    // Both evidence bars, side by side. The two motif sets are NOT nested, so
    // these are paired bars, never a stack or a "share reaching Tier 1".
    return [
      {
        type: 'bar', name: 'Nominal significance',
        x: data.motif, y: data.nominal_triads,
        text: data.nominal_proteins.map((p) => `${p} proteins`),
        hovertemplate: '<b>%{x}</b><br>%{y:,} triads<br>%{text}<extra>Nominal</extra>',
        marker: { color: '#c9c9c9' },
      },
      {
        type: 'bar', name: 'Tier 1 (used in the paper)',
        x: data.motif, y: data.tier1_triads,
        text: data.tier1_proteins.map((p) => `${p} proteins`),
        hovertemplate: '<b>%{x}</b><br>%{y:,} triads<br>%{text}<extra>Tier 1</extra>',
        marker: { color: '#1f4e79' },
      },
    ];
  }, [data]);

  return (
    <SectionCard
      title={<>Motif counts under both evidence bars <ArmChip sectionId="mr_motif_counts" /></>}
      subtitle="Raising the bar from nominal significance to Tier 1 collapses the mediator motif from 84 triads to 6, while disease-liability stays large. The two sets are not nested, so the bars are paired rather than stacked."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={430}
        layout={{
          barmode: 'group',
          yaxis: { title: 'triads (log scale)', type: 'log' },
          margin: { b: 120 },
          legend: { orientation: 'h', y: -0.35 },
        }}
      />
      {data && <ColumnarTable data={data} />}
    </SectionCard>
  );
}

function TierOneTriads() {
  const { data, loading, error } = useSection('mr_triads');
  const mediators = useMemo(() => {
    if (!data) return null;
    const idx = data.motif
      .map((m, i) => (String(m).startsWith('A') ? i : -1))
      .filter((i) => i >= 0);
    return idx.map((i) => ({
      exposure: data.Exposure[i],
      protein: data.Protein[i],
      disease: data.Disease[i],
      diseaseUkb: data.Disease_UKB ? data.Disease_UKB[i] : '',
      icd: data.ICD10 ? data.ICD10[i] : '',
    }));
  }, [data]);

  return (
    <SectionCard
      title={<>Tier-1 mediator triads <ArmChip sectionId="mr_triads" /></>}
      subtitle="Every exposure → protein → disease triad carrying the mediator motif under the Tier-1 rule — the definition the paper quotes. Six triads across three proteins."
      loading={loading}
      error={error}
    >
      {mediators && (
        <Box sx={{ display: 'grid', gap: 1.5, mb: 3 }}>
          {mediators.map((m) => (
            <Box
              key={`${m.exposure}|${m.protein}|${m.disease}`}
              sx={{
                p: 1.5, border: '1px solid #d8d8d8', borderRadius: 1,
                display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {prettyExposure(m.exposure)}
              </Typography>
              <Typography variant="body2">&rarr;</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.protein}</Typography>
              <Typography variant="body2">&rarr;</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {prettyDisease(m.disease, m.diseaseUkb)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {data && <ColumnarTable data={data} initialRowsPerPage={25} />}
    </SectionCard>
  );
}

function Coloc() {
  const { data, loading, error } = useSection('mr_coloc');
  // Which locus the regional plot shows. Defaults to the first pair that
  // clears the gate, so the panel opens on a colocalization rather than a null.
  const [locus, setLocus] = useState(null);
  const traces = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.status)].map((s) => {
      const idx = idxWhere(data.status, s);
      return {
        type: 'scatter',
        mode: 'markers',
        name: s,
        x: idx.map((i) => data['PP.H3'][i]),
        y: idx.map((i) => data['PP.H4'][i]),
        text: idx.map(
          (i) => `${data.protID[i]} — ${data.target[i]} (${data.arm[i]}, ${data.lead_snp[i]})`
        ),
        hovertemplate: '%{text}<br>PP.H3 %{x:.2f} · PP.H4 %{y:.2f}'
          + '<br><i>click to see the region</i><extra>%{fullData.name}</extra>',
        marker: { size: 10, opacity: 0.85, color: STATUS_COLOR[s] || '#666' },
        // the row this point came from, so a click can name the locus
        customdata: idx,
      };
    });
  }, [data]);

  const sel = useMemo(() => {
    if (!data?.protID) return null;
    if (locus != null) return { i: locus };
    const i = data['PP.H4'].findIndex((v) => Number(v) >= 0.8);
    return i >= 0 ? { i } : null;
  }, [data, locus]);

  return (
    <SectionCard
      title={<>Colocalization of cis-pQTL and outcome signals <ArmChip sectionId="mr_coloc" /></>}
      subtitle="PP.H4 &ge; 0.8 is the hard tier gate: one shared causal variant rather than two distinct variants in LD."
      loading={loading}
      error={error}
    >
      <PlotPanel
        data={traces}
        height={450}
        onPointClick={(pt) => setLocus(pt.customdata)}
        layout={{
          xaxis: { title: 'PP.H3 (distinct variants)', range: [-0.03, 1.03] },
          yaxis: { title: 'PP.H4 (shared variant)', range: [-0.03, 1.03] },
          shapes: [{
            type: 'line', x0: -0.03, x1: 1.03, y0: 0.8, y1: 0.8,
            line: { dash: 'dot', width: 1, color: '#1b7837' },
          }],
          annotations: [{
            x: 0.02, y: 0.83, text: 'PP.H4 = 0.8', showarrow: false,
            font: { size: 10, color: '#1b7837' }, xanchor: 'left',
          }],
          legend: { orientation: 'h', y: -0.25 },
          margin: { b: 100 },
        }}
      />
      {data && (
        <ColocRegional
          locusId={sel ? `${data.arm[sel.i]}__${data.protID[sel.i]}__${data.target[sel.i]}` : null}
          protein={sel ? data.protID[sel.i] : null}
          target={sel ? data.target[sel.i] : null}
          pph4={sel ? data['PP.H4'][sel.i] : null}
          pph3={sel ? data['PP.H3'][sel.i] : null}
        />
      )}
      {data && <ColumnarTable data={data} />}
    </SectionCard>
  );
}

export default function Causal() {
  // The reading key, the entity browser and the explorer are three depths of
  // one question, so the filter is held here rather than in any of them.
  const [motif, setMotif] = useState('all');
  const [entity, setEntity] = useState(null);
  const [query, setQuery] = useState('');
  const { data: edgeKey } = useSection('mr_edge_key');
  const { data: motifKey } = useSection('mr_motif_key');

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 900 }}>
        Every edge below is a <b>two-sample Mendelian randomization</b> estimate: the
        instrument&ndash;exposure and instrument&ndash;outcome effects come from
        different samples, so no individual contributes to both sides.
        <Box component="span" sx={{ display: 'block', mt: 1 }}>
          Exposure and protein effects are estimated within UK Biobank on{' '}
          <b>non-overlapping participants</b> (a split-sample design adapted from
          Deng et al., 2025). Proteins are instrumented from two pQTL sources on two
          assay platforms &mdash; <b>UK Biobank (Olink)</b> and, as an external
          replication arm, <b>deCODE (SomaScan)</b> &mdash; deliberately, to account
          for differences in the genetic variants tied to each platform
          (Ferkingstad et al., 2021; Eldjarn et al., 2023; Wang et al., 2025).
          Disease instruments are drawn from <b>FinnGen Release 12</b> (Kurki et al.,
          2023).
        </Box>
        <Box component="span" sx={{ display: 'block', mt: 1 }}>
          A triad therefore draws on all three sources, and only edges involving the
          protein can differ between the two panels. Tier 1 requires a Steiger test
          that is both significant and forward-oriented; Tier 1+ additionally requires
          the edge to be cis-anchored, colocalized and replicated across both panels.
        </Box>
      </Typography>
      <ArmNotice />
      <MotifKey
        edges={edgeKey}
        motifs={motifKey}
        selected={motif === 'all' ? null : motif}
        onSelect={(m) => { setMotif(m || 'all'); setEntity(null); }}
      />
      <EntityMotifBrowser
        motifs={motifKey}
        selectedMotif={motif === 'all' ? null : motif}
        onSelectMotif={(m) => setMotif(m || 'all')}
        picked={entity}
        onPick={(e) => {
          setEntity(e);
          // Selecting an entity narrows the explorer's search to it, so the
          // deep view opens on what was just picked instead of making the
          // reader retype it.
          setQuery(e ? e.id : '');
        }}
      />
      <TriadExplorer
        motif={motif}
        onMotif={setMotif}
        query={query}
        onQuery={setQuery}
      />
      <PDEffects />
      <MotifCounts />
      <TierOneTriads />
      <Coloc />
    </Box>
  );
}
