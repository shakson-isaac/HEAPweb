import React from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';
import { useSection } from '../lib/useSection';

// HEAP instruments proteins from two pQTL sources on two different assay
// platforms: UK Biobank (Olink) and deCODE (SomaScan). Before comparing an
// edge across panels, a reader needs to know whether the platforms agree about
// that protein at all -- 41% of the 587 proteins with a published correlation
// fall below r = 0.5.
//
// Correlations are from Eldjarn et al., Nature 2023, integrated per the HEAP
// Online Methods ("we integrated correlations between SomaScan and Olink
// platforms for proteins described in Eldjarn et al., 2023 to reference
// potential transferability").
const COLOR = { high: 'success', moderate: 'default', low: 'warning' };

export function useConcordance(protein) {
  const { data } = useSection('platform_concordance');
  if (!data || !protein) return null;
  const i = data.protein.indexOf(protein);
  if (i < 0) return null;
  return {
    r: Number(data.olink_soma_r[i]),
    band: data.transferability[i],
    source: data.source[i],
  };
}

export default function PlatformConcordance({ protein }) {
  const c = useConcordance(protein);
  if (!c) {
    return (
      <Alert severity="warning" sx={{ my: 2 }}>
        No published Olink&ndash;SomaScan correlation for <b>{protein}</b>. A
        difference between the two panels below cannot be attributed to biology
        rather than to the assays measuring this protein differently.
      </Alert>
    );
  }
  return (
    <Alert severity={c.band === 'low' ? 'warning' : 'info'} sx={{ my: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        <b>{protein}</b>
        <Chip size="small" color={COLOR[c.band] || 'default'}
              label={`Olink ↔ SomaScan r = ${c.r.toFixed(3)} (${c.band})`} />
      </Box>
      {c.band === 'low' ? (
        <>The two platforms agree poorly about this protein, so an edge holding in
        one panel and not the other is <b>not</b> evidence of biological
        disagreement &mdash; the panels are not measuring the same quantity
        closely.</>
      ) : (
        <>The two platforms agree well about this protein, so a difference between
        the panels below is more likely to reflect the instruments than the assay.</>
      )}
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
        Source: {c.source}
      </Typography>
    </Alert>
  );
}
