import React from 'react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';

// Uniform frame for one result section: title, loading state, and a failure
// that names the section instead of leaving an empty panel.
//
// The frame is a hairline, never a shadow -- panels sit on the page the way a
// figure sits on a journal page. Border and background come from the theme, so
// one definition serves light and dark.
export default function SectionCard({ title, subtitle, loading, error, empty, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 4, p: { xs: 2, md: 3 }, bgcolor: 'background.paper' }}>
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
    </Paper>
  );
}
