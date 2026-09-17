import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Chip, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SectionCard from '../SectionCard';
import PlotPanel from '../PlotPanel';
import { compColor, ecatColor } from '../../lib/palette';
import { useSection } from '../../lib/useSection';
import {
  COMPONENTS, COMPONENT_LABEL, catProteinIndex, proteinIndex, specLabel, specList,
} from '../../lib/varcomp';

// ---------------------------------------------------------------------------
// MAIN RESULTS -- the partition itself, as a composition.
//
// The reach curves say how far a component gets and the spectrum says which
// proteins are exposure-responsive. Neither shows what a protein's variance is
// actually MADE OF, which is the thing the framework claims to deliver: a
// protein is some covariate share, some genetic share, some exposomic share,
// some interaction, and a large remainder nobody explains.
//
// TWO SCALES, ONE CHART.
//   coarse  the four components, disjoint by construction
//   fine    the exposomic share opened into its 13 exposure categories
//
// THE UNEXPLAINED REMAINDER IS DRAWN. Stacking only the explained components
// rescales every bar to its own total and makes a protein with 4% explained look
// like a protein with 60% explained. The bar runs to 100% and the grey is the
// part the model does not account for, because that is most of it for most
// proteins and a composition that hides it is not a composition.
//
// FINE SCALE DOES NOT SUM TO THE COARSE EXPOSOME SHARE. The 13 category R2 come
// from separate per-category fits, not from decomposing the joint exposomic
// component, so overlapping exposures are counted in more than one category.
// The chart says so rather than letting the two scales look interchangeable.
// ---------------------------------------------------------------------------

const N_BARS = 25;
const prettyCat = (c) => String(c).replace(/_/g, ' ');

export default function VarianceStack() {
  const pr = useSection('varcomp_protein');
  const vc = useSection('varcat_protein');
  const mt = useSection('varcomp_specs_meta');
  const [exp, setExp] = useState('M1_base_lasso');
  const [scale, setScale] = useState('coarse');
  const [group, setGroup] = useState('responsive');
  // A LIST, not one protein. Comparing a handful side by side is the thing this
  // chart is for -- one protein's composition is not interpretable without
  // something to hold it against, and the predefined groups answer a different
  // question than "these six, specifically".
  const [pick, setPick] = useState([]);

  const loading = pr.loading || vc.loading || mt.loading;
  const error = pr.error || vc.error || mt.error;

  const specs = useMemo(() => specList(mt.data), [mt.data]);
  const specById = useMemo(() => new Map(specs.map((s) => [s.id, s])), [specs]);
  const prot = useMemo(() => proteinIndex(pr.data), [pr.data]);
  const cats = useMemo(() => catProteinIndex(vc.data), [vc.data]);

  // Which proteins each bar covers. "responsive" splits the proteome on the same
  // 1%-of-variance rule the spectrum uses, so the two panels agree on who counts
  // as exposure-responsive.
  const groups = useMemo(() => {
    const bs = prot?.bySpec?.[exp];
    if (!bs) return null;
    const E = bs.E?.r2;
    const G = bs.G?.r2;
    if (!E || !G) return null;
    const idx = prot.proteins.map((_, i) => i);
    if (group === 'responsive') {
      return [
        { name: 'exposure-responsive (E ≥ 1%)', ix: idx.filter((i) => (E[i] || 0) >= 0.01) },
        { name: 'the rest', ix: idx.filter((i) => (E[i] || 0) < 0.01) },
      ];
    }
    if (group === 'leaning') {
      return [
        { name: 'exposome-leaning', ix: idx.filter((i) => (E[i] || 0) > (G[i] || 0)) },
        { name: 'genetics-leaning', ix: idx.filter((i) => (E[i] || 0) <= (G[i] || 0)) },
      ];
    }
    return [{ name: `all ${idx.length.toLocaleString()} proteins`, ix: idx }];
  }, [prot, exp, group]);

  const view = useMemo(() => {
    if (!prot || !groups) return null;
    // Chosen proteins win over the grouping when any are picked, and they keep
    // the order they were picked in rather than being re-sorted, so a comparison
    // the reader set up does not rearrange itself when the specification changes.
    const chosen = (pick || [])
      .map((p) => ({ p, i: prot.index.get(p) }))
      .filter((d) => d.i !== undefined);

    let bars;
    if (chosen.length) {
      bars = chosen.map((d) => ({ name: d.p, ix: [d.i] }));
    } else if (group === 'proteins') {
      const E = prot.bySpec[exp]?.E?.r2 || [];
      const order = prot.proteins.map((_, i) => i)
        .filter((i) => E[i] != null)
        .sort((a, b) => E[b] - E[a]).slice(0, N_BARS);
      bars = order.map((i) => ({ name: prot.proteins[i], ix: [i] }));
    } else {
      bars = groups;
    }

    const mean = (arr, ix) => {
      if (!arr) return 0;
      let s = 0; let n = 0;
      ix.forEach((i) => { if (arr[i] != null) { s += Math.max(0, arr[i]); n += 1; } });
      return n ? s / n : 0;
    };

    const names = bars.map((b) => b.name);
    let traces;
    if (scale === 'coarse') {
      traces = COMPONENTS.map((k) => {
        const label = COMPONENT_LABEL[k] || k;
        return {
          type: 'bar', name: label, orientation: 'h',
          y: names,
          x: bars.map((b) => 100 * mean(prot.bySpec[exp]?.[k]?.r2, b.ix)),
          marker: { color: compColor(k) },
          hovertemplate: `<b>%{y}</b><br>${label}: %{x:.2f}% of variance<extra></extra>`,
        };
      });
    } else {
      const list = cats ? cats.categories : [];
      traces = list.map((cat) => ({
        type: 'bar', name: prettyCat(cat), orientation: 'h',
        y: names,
        x: bars.map((b) => {
          const arr = cats.bySpec[exp]?.[cat];
          const ix = b.ix.map((i) => cats.index.get(prot.proteins[i]))
            .filter((k) => k !== undefined);
          return 100 * mean(arr, ix);
        }),
        marker: { color: ecatColor(cat) },
        hovertemplate: `<b>%{y}</b><br>${prettyCat(cat)}: %{x:.3f}% of variance<extra></extra>`,
      }));
    }

    // The remainder, only on the coarse scale where the components are disjoint
    // and the arithmetic is honest.
    if (scale === 'coarse') {
      const explained = bars.map((_, j) => traces.reduce((s, t) => s + t.x[j], 0));
      traces.push({
        type: 'bar', name: 'unexplained', orientation: 'h',
        y: names, x: explained.map((e) => Math.max(0, 100 - e)),
        marker: { color: '#EAECEF' },
        hovertemplate: '<b>%{y}</b><br>unexplained: %{x:.2f}%<extra></extra>',
      });
    }
    return { traces, n: names.length, single: chosen.length > 0 };
  }, [prot, cats, groups, exp, scale, group, pick]);

  return (
    <SectionCard
      title="What is a protein's variance made of?"
      subtitle={
        'The partition as a composition — covariates, genetics, exposome and interaction, '
        + 'against the share no model accounts for. Open the exposome into its 13 categories '
        + 'with the scale switch.'
      }
      loading={loading}
      error={error}
    >
      {prot && view && specs.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
            <Box sx={{ minWidth: 250, flex: '1 1 250px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Specification
              </Typography>
              <Autocomplete
                size="small" disableClearable options={specs.map((x) => x.id)} value={exp}
                onChange={(_, x) => x && setExp(x)}
                getOptionLabel={(o) => specLabel(specById.get(o))}
                renderInput={(p) => <TextField {...p} />}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Scale
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={scale} onChange={(_, x) => x && setScale(x)}>
                <ToggleButton value="coarse" sx={{ textTransform: 'none' }}>four components</ToggleButton>
                <ToggleButton value="fine" sx={{ textTransform: 'none' }}>13 categories</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Bars are
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={group}
                                 onChange={(_, x) => { if (x) { setGroup(x); setPick([]); } }}>
                <ToggleButton value="responsive" sx={{ textTransform: 'none' }}>responsive vs rest</ToggleButton>
                <ToggleButton value="leaning" sx={{ textTransform: 'none' }}>which side leads</ToggleButton>
                <ToggleButton value="all" sx={{ textTransform: 'none' }}>whole proteome</ToggleButton>
                <ToggleButton value="proteins" sx={{ textTransform: 'none' }}>top proteins</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ minWidth: 300, flex: '1 1 300px' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
                Or compare chosen proteins
              </Typography>
              <Autocomplete
                multiple
                size="small"
                limitTags={4}
                filterSelectedOptions
                options={prot.proteins}
                value={pick}
                onChange={(_, x) => setPick(x.slice(0, 20))}
                renderInput={(p) => (
                  <TextField {...p} placeholder={pick.length ? '' : 'e.g. LEP, FABP4, IL1RN'} />
                )}
              />
            </Box>
          </Box>

          {scale === 'fine' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <b>The 13 categories do not add up to the exposome bar above.</b> Each category R²
              comes from its own fit rather than from splitting the joint exposomic component, so
              exposures shared between categories are counted more than once. Read the fine scale
              as which categories carry signal, not as a partition of the exposome.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Chip size="small" variant="outlined"
                  label={view.single
                    ? `${view.n} chosen protein${view.n === 1 ? '' : 's'}`
                    : `${view.n} bar${view.n === 1 ? '' : 's'}`} />
            {view.single && (
              <Chip size="small" variant="outlined" label="clear the list to return to groups"
                    onDelete={() => setPick([])} />
            )}
            {!view.single && group !== 'proteins' && (
              <Chip size="small" variant="outlined" label="each bar is the mean over its proteins" />
            )}
          </Box>

          <PlotPanel
            data={view.traces}
            height={Math.max(280, 30 * view.n + 150)}
            layout={{
              barmode: 'stack',
              xaxis: {
                title: scale === 'coarse'
                  ? 'share of protein variance (%)'
                  : 'variance explained per category (%)',
                range: scale === 'coarse' ? [0, 100] : undefined,
              },
              yaxis: { automargin: true, autorange: 'reversed' },
              legend: { orientation: 'h', y: -0.18, x: 0 },
              margin: { l: 200, r: 30, t: 20, b: 110 },
            }}
          />
        </>
      )}
    </SectionCard>
  );
}
