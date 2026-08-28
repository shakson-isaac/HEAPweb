import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Menu, MenuItem, Divider } from '@mui/material';
import { DOC_PAGES } from '../lib/docPages';

const heapLogo = `${process.env.PUBLIC_URL}/HEAPlogo.png`;

// Every destination in the Results menu. A list rather than ten hand-written
// MenuItems so each one can be rendered as a real <Link>, the same way the
// documentation menu renders DOC_PAGES.
const RESULT_PAGES = [
  { path: 'main', label: 'Main Results' },
  { path: 'summary', label: 'Lifestyle Categories' },
  { path: 'associations', label: 'Associations' },
  { path: 'mediation', label: 'Disease Links' },
  { path: 'intervention', label: 'Intervention' },
  { path: 'enrichment', label: 'Tissues & Pathways' },
  // Side-by-side reorganization, kept until one of the two is chosen.
  { path: 'enrichment-guide', label: 'Tissues & Pathways — guided (new)' },
  { path: 'causal', label: 'Causal Evidence (MR)' },
  { path: 'pes', label: 'Exposure Scores (PES)' },
  { path: 'pes-guide', label: 'Exposure Scores — guided (new)' },
  { path: 'gwas', label: 'Exposure GWAS' },
  { path: 'architecture', label: 'Genetic & Exposomic Architecture', group: true },
];

// Menu items are real anchors, not click handlers.
//
// These used to be `<MenuItem onClick={() => navigate(path)}>`, which renders
// no <a> at all. The destination worked, but nothing else about a link did:
// no cmd/middle-click into a new tab, no right-click copy, no link semantics
// for a screen reader, and nothing for a crawler to follow. A site whose
// documentation cannot be linked to is a site whose documentation cannot be
// cited.
//
// `component={Link}` keeps the menu behaviour and gives back the anchor.
function NavMenuItem({ to, onClose, children }) {
  return (
    <MenuItem component={Link} to={to} onClick={onClose}>
      {children}
    </MenuItem>
  );
}

function Header() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [docAnchorEl, setDocAnchorEl] = useState(null); // State for documentation menu

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleDocMenuClick = (event) => {
    setDocAnchorEl(event.currentTarget);
  };

  const handleDocMenuClose = () => setDocAnchorEl(null);

  return (
    <AppBar position="static" className="app-bar"> {/* Ensure the class name matches */}
      <Toolbar style={{ justifyContent: 'flex-start' }}>
        {/* The logo is a link for the same reason the menu items are: a masthead
            that cannot be cmd-clicked is a button wearing a link's clothes. */}
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
        >
          <img src={heapLogo} alt="HEAP Logo" style={{ width: '40px', height: '40px', marginRight: '10px' }} />
          <Typography variant="h6" style={{ fontFamily: 'Inter, Arial, sans-serif', marginRight: '20px' }}>
            <strong>HEAP</strong>
          </Typography>
        </Link>
        <nav className="nav-links" style={{ display: 'flex', gap: '20px', marginLeft: '30px' }}>
          <Link to="/">Home</Link>
          <div
            onClick={handleDocMenuClick}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleDocMenuClick(e)}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            style={{ cursor: 'pointer' }}
          >
            Documentation <span style={{ fontSize: '0.7em', marginLeft: '-3px', display: 'inline-block', transform: 'scaleY(0.7)', verticalAlign: '0.2em' }}>▼</span>
          </div>
          <div
            onClick={handleMenuClick}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleMenuClick(e)}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            style={{ cursor: 'pointer' }}
          >
            Results <span style={{ fontSize: '0.7em', marginLeft: '-3px', display: 'inline-block', transform: 'scaleY(0.7)', verticalAlign: '0.2em' }}>▼</span>
          </div>
          <Link to="/downloads">Downloads</Link>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => handleMenuClose(null)}
          >
            {RESULT_PAGES.map((r) => (
              <React.Fragment key={r.path}>
                {r.group && <Divider />}
                <NavMenuItem to={`/results/${r.path}`} onClose={handleMenuClose}>
                  {r.label}
                </NavMenuItem>
              </React.Fragment>
            ))}
          </Menu>
          <Menu
            anchorEl={docAnchorEl}
            open={Boolean(docAnchorEl)}
            onClose={() => handleDocMenuClose(null)}
          >
              {DOC_PAGES.map((d) => (
                <React.Fragment key={d.path}>
                  {d.group && <Divider />}
                  <NavMenuItem to={`/documentation/${d.path}`} onClose={handleDocMenuClose}>
                    {d.label}
                  </NavMenuItem>
                </React.Fragment>
              ))}
          </Menu>
        </nav>
      </Toolbar>
    </AppBar>
  );
}

export default Header;

