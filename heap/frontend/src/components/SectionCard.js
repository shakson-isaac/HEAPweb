import React from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';

// Uniform frame for one result section: title, loading state, and a failure
// that names the section instead of leaving an empty panel.
export default function SectionCard({ title, subtitle, loading, error, empty, children }) {
  return (
    <Box sx={{ mb: 5 }}>
      {title && (
        <Typography variant="h6" sx={{ fontWeight: 600, mb: subtitle ? 0.25 : 1 }}>
          {title}
        </Typography>
      )}
      {subtitle && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {subtitle}
        </Typography>
      )}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ my: 1 }}>
          Could not load {title || 'this section'}: {String(error.message || error)}
        </Alert>
      )}
      {!loading && !error && empty && (
        <Alert severity="info" sx={{ my: 1 }}>No data in this section.</Alert>
      )}
      {!loading && !error && !empty && children}
    </Box>
  );
}
