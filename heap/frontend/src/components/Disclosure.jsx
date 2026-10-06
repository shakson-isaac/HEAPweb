import React, { useState } from 'react';
import { Box, Button, Divider, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// ---------------------------------------------------------------------------
// The rest of a page, folded.
//
// Every export got its own chart, so these pages opened with five to nine of
// them and the reader had to work out which one carried the claim. The lead
// visual now answers the page's question and everything else moves in here.
//
// FOLDED, NOT DELETED. The older panels are the only view of several exports,
// and someone who came for one of them should still find it -- one click, with
// a count so they know how much is behind it rather than a bare chevron.
// ---------------------------------------------------------------------------

export default function Disclosure({ title, count, children, note }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 2 }} />
      <Button
        onClick={() => setOpen((v) => !v)}
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ textTransform: 'none', fontWeight: 700 }}
      >
        {open ? 'Hide' : 'Show'}
        {' '}
        {title}
        {count ? ` (${count})` : ''}
      </Button>
      {note && !open && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5, maxWidth: 900 }}>
          {note}
        </Typography>
      )}
      {open && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
}
