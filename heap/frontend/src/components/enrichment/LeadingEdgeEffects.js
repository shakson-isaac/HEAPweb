import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Chip, FormControlLabel, Switch, Typography,
} from '@mui/material';
import PlotPanel from '../PlotPanel';
import Disclosure from '../Disclosure';
import { useShard } from '../../lib/useSection';
import { getShard } from '../../lib/heapdata';
import { assocSectionFor } from '../../lib/covariateSpecs';

// The leading edge and the effect sizes, as ONE list.
//
// They were two panels with two explanations and 238 words between them, over
// the same 30 proteins. The leading-edge table ranked them by two derived counts
// -- how many of this exposure's other tissues and pathways also carry the
// protein -- because the leading edge has no per-protein statistic: every row of
// a term repeats that term's NES and q. The panel underneath had exactly the
// missing statistic, for a subset of the same list.
//
// So this ranks the leading edge by the thing that actually varies protein to
// protein: how hard this exposure moves it, held out, with its interval.
//
// MISSING IS NOT ZERO. A leading-edge protein with no association row for this
// exposure is reported as untested, never plotted at zero.
const ACCENT = '#D55E00';
const PATHWAY = '#117733';
const SHORTLIST = 24;   // fetched, then re-ranked by the beta actually returned

export default function LeadingEdgeEffects({ exposure, tissue, spec = 'base', onPickGene, selected }) {
  const [byPathway, setByPathway] = useState(false);
  const { data: le, loading } = useShard('bodymap_leading_edge', exposure);
  const [rows, setRows] = useState(null);

  const genes = useMemo(() => {
    if (!le?.gene) return null;
    const out = [];
    for (let i = 0; i < le.gene.length; i += 1) {
      if (le.term[i] === tissue && le.spec[i] === spec) out.push(le.gene[i]);
    }
    return out;
  }, [le, tissue, spec]);

  // Did the protein carry a PATHWAY enrichment too, or only this tissue's?
  //
  // The same shard already holds the exposure's enriched pathways and their
  // leading edges -- 364 pathway rows beside 786 tissue rows for this exposure
  // -- so the answer costs no extra request and was simply never asked. For
  // strenuous sports in artery aorta it is a real split: 7 of the 30 also carry
  // ECM proteoglycans and 23 carry no enriched pathway at all.
  const pathwayOf = useMemo(() => {
    if (!le?.gene) return null;
    const m = new Map();
    for (let i = 0; i < le.gene.length; i += 1) {
      if (le.kind[i] !== 'pathway' || le.spec[i] !== spec) continue;
      const g = le.gene[i];
      if (!m.has(g)) m.set(g, []);
      const list = m.get(g);
      if (!list.includes(le.term_label[i])) list.push(le.term_label[i]);
    }
    return m;
  }, [le, spec]);

  useEffect(() => {
    let alive = true;
    if (!genes) return undefined;
    setRows(null);
    (async () => {
      const section = assocSectionFor(spec);
      const got = await Promise.all(genes.slice(0, SHORTLIST).map(async (g) => {
        try {
          const d = await getShard(section, g);
          // Term carries the FULL exposure id, suffix included. Matching the
          // bare tail finds nothing and the plot renders empty, which looks
          // like a layout bug rather than a failed join.
          const k = d.Term.findIndex((t) => t === exposure);
          if (k < 0) return { gene: g, missing: true };
          return {
            gene: g,
            beta: Number(d.beta_test[k]),
            se: Number(d.SE_test[k]),
            repl: String(d.replicated[k]).toUpperCase() === 'TRUE',
          };
        } catch { return { gene: g, missing: true }; }
      }));
      if (!alive) return;
      const ok = got.filter((r) => !r.missing)
        .sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
      setRows({ ok, missing: got.filter((r) => r.missing).map((r) => r.gene), total: genes.length });
      if (ok.length && onPickGene) onPickGene(ok[0].gene);
    })();
    return () => { alive = false; };
    // onPickGene is intentionally not a dependency: it seeds the sibling panel
    // once per list, and including it would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genes, spec, exposure]);

  if (loading || !rows) return <Typography variant="body2">Loading the leading edge…</Typography>;
  if (!rows.ok.length) {
    return <Alert severity="info">No association rows for these proteins under this specification.</Alert>;
  }

  const ok = rows.ok;
  const inPathway = ok.filter((r) => pathwayOf?.get(r.gene)?.length);
  const pathwayNames = [...new Set(inPathway.flatMap((r) => pathwayOf.get(r.gene)))];

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        The proteins that carried this enrichment, ranked by effect size
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Held-out β with a 95% interval.
        {byPathway
          ? ' Filled = also carried an enriched pathway.'
          : ' Filled = replicated in both splits.'}
        {' '}
        <b>Click a protein</b> for where it is expressed.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip size="small" label={`${ok.length} of ${rows.total} leading-edge proteins`} />
        {rows.missing.length > 0 && (
          <Chip size="small" variant="outlined" color="warning"
                label={`${rows.missing.length} with no association row — missing, not zero`} />
        )}
        {pathwayNames.length > 0 && (
          <FormControlLabel
            sx={{ ml: 0.5 }}
            control={<Switch size="small" checked={byPathway}
                             onChange={(e) => setByPathway(e.target.checked)} />}
            label={<Typography variant="body2">Mark pathway membership</Typography>}
          />
        )}
      </Box>

      {byPathway && (
        <Alert severity="info" sx={{ mb: 1 }}>
          <b>{`${inPathway.length} of these ${ok.length}`}</b>
          {` also carried an enriched pathway for this exposure; ${ok.length - inPathway.length} carried
            this tissue only. `}
          {pathwayNames.length
            ? `Pathways involved: ${pathwayNames.join(', ')}.`
            : ''}
        </Alert>
      )}
      <PlotPanel
        data={[{
          type: 'scatter',
          mode: 'markers',
          x: ok.map((r) => r.beta).reverse(),
          y: ok.map((r) => r.gene).reverse(),
          error_x: {
            type: 'data',
            array: ok.map((r) => 1.96 * r.se).reverse(),
            color: '#888', thickness: 1.2, width: 0,
          },
          marker: {
            // The selected protein grows and takes a dark ring, so the row
            // driving the panel below is identifiable without reading it.
            size: ok.map((r) => (r.gene === selected ? 17 : 11)).reverse(),
            // With the toggle on, fill encodes pathway membership instead of
            // replication -- one fill can only carry one meaning, and the
            // legend line above says which it is.
            color: ok.map((r) => {
              if (byPathway) return pathwayOf?.get(r.gene)?.length ? PATHWAY : '#ffffff';
              return r.repl ? ACCENT : '#ffffff';
            }).reverse(),
            line: {
              color: ok.map((r) => {
                if (r.gene === selected) return '#23282D';
                return byPathway && pathwayOf?.get(r.gene)?.length ? PATHWAY : ACCENT;
              }).reverse(),
              width: ok.map((r) => (r.gene === selected ? 3 : 2)).reverse(),
            },
          },
          text: ok.map((r) => {
            const ps = pathwayOf?.get(r.gene) || [];
            return ps.length ? ps.join(', ') : 'this tissue only';
          }).reverse(),
          hovertemplate: '%{y}<br>β %{x:+.3f}<br>%{text}<br><i>click for expression</i><extra></extra>',
        }]}
        onPointClick={(pt) => onPickGene && pt?.y && onPickGene(String(pt.y))}
        layout={{
          height: 60 + ok.length * 26,
          margin: { l: 96, r: 34, t: 8, b: 48 },
          xaxis: { title: 'held-out β per SD of exposure', zeroline: true, zerolinecolor: '#bbb' },
          yaxis: { automargin: true },
        }}
      />
      <Disclosure title="how these were estimated and chosen" count={1}>
        <Typography variant="body2" sx={{ maxWidth: 900 }}>
          Held-out β with a 95% Wald interval (β ± 1.96 × SE), from the test split — the same
          estimate the rest of the site plots, never the discovery-split β. The leading edge is
          stored in GSEA ranked-list order, so the first {SHORTLIST} are fetched and then re-ranked
          by the β actually returned; that proxy has a median |ρ| of about 0.85 against |β|, so a
          protein just outside the shortlist can outrank one inside it. Adjusting for BMI or the
          clinical covariates attenuates many adiposity-linked effects; attenuation under
          adjustment cannot on its own separate mediation from confounding, so read the
          specification buttons as a sensitivity check rather than a mechanism.
        </Typography>
      </Disclosure>
    </Box>
  );
}
