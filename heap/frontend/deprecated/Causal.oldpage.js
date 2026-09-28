// ARCHIVED 2026-08-27 -- the original /results/causal page body.
//
// Superseded by the guided version, which is now what /results/causal renders.
// This is the page as it last shipped: a 175-word preamble, then five panels
// stacked with no stated order -- reading key, entity browser, triad explorer,
// protein-disease effects, colocalization. Its own comment called them "three
// depths of one question", which was right and was never said to the reader.
//
// NOT COMPILED. This directory sits outside src/, so CRA never builds it.
//
// The PANELS are not archived: TriadExplorer, Coloc, PDEffects, MotifKey and
// ArmNotice all still live in src/ and are rendered by the current page. Only
// this stacked composition and EntityMotifBrowser (its single-entity browser,
// archived beside this file) went.
//
// The import block below is the page's own, reproduced for reference.

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
      <Coloc />
    </Box>
  );
}


// ---- the page's imports as they stood ----
// import React, { useEffect, useMemo, useState } from 'react';
// import Select from 'react-select';
// import {
// import SectionCard from '../../components/SectionCard';
// import ColumnarTable from '../../components/ColumnarTable';
// import PlotPanel from '../../components/PlotPanel';
// import ArmNotice, { ArmChip } from '../../components/ArmNotice';
// import ColocRegional from '../../components/ColocRegional';
// import MotifKey from '../../components/MotifKey';
// import EntityMotifBrowser from '../../components/EntityMotifBrowser';
// import PDEffects from '../../components/PDEffects';
// import PlatformConcordance from '../../components/PlatformConcordance';
// import MotifTrace from '../../components/MotifTrace';
// import TriadDAG from '../../components/TriadDAG';
// import { useSection } from '../../lib/useSection';
// import { ecatColor, prettyDisease } from '../../lib/palette';
