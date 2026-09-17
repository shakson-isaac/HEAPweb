import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';

// Any URL the router does not recognize.
//
// Before this, an unknown path rendered a blank shell: /results/<garbage> gave
// 8 words on an empty page and /documentation/<garbage> rendered the whole
// documentation chrome as though the page were real. Both looked like the site
// was broken rather than like the address was wrong, and a mistyped or stale
// link failed silently -- which matters more now that URLs carry state and are
// meant to be shared.
export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <Box sx={{ mt: 4, maxWidth: 760 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        That page does not exist
      </Typography>
      <Alert severity="info" sx={{ my: 2 }}>
        Nothing is published at <b>{pathname}</b>.
      </Alert>
      <Typography variant="body1" sx={{ mb: 2 }}>
        The address may be mistyped, or it may be a link from an older version of
        the site. Everything HEAP publishes is reachable from these:
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button component={RouterLink} to="/" variant="contained" sx={{ textTransform: 'none' }}>
          Home
        </Button>
        <Button component={RouterLink} to="/results/main" variant="outlined" sx={{ textTransform: 'none' }}>
          Results
        </Button>
        <Button component={RouterLink} to="/documentation/about" variant="outlined" sx={{ textTransform: 'none' }}>
          Documentation
        </Button>
        <Button component={RouterLink} to="/downloads" variant="outlined" sx={{ textTransform: 'none' }}>
          Downloads
        </Button>
      </Box>
    </Box>
  );
}
