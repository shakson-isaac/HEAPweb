import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Menu, MenuItem, Divider } from '@mui/material';
import { DOC_PAGES } from '../lib/docPages';

const heapLogo = `${process.env.PUBLIC_URL}/HEAPlogo.png`;

function Header() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [docAnchorEl, setDocAnchorEl] = useState(null); // State for documentation menu

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (page) => {
    setAnchorEl(null);
    if (page) {
      navigate(`/results/${page}`);
    }
  };

  const handleDocMenuClick = (event) => {
    setDocAnchorEl(event.currentTarget);
  };

  const handleDocMenuClose = (page) => {
    setDocAnchorEl(null);
    if (page) {
      navigate(`/documentation/${page}`);
    }
  };

  return (
    <AppBar position="static" className="app-bar"> {/* Ensure the class name matches */}
      <Toolbar style={{ justifyContent: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src={heapLogo} alt="HEAP Logo" style={{ width: '40px', height: '40px', marginRight: '10px' }} />
          <Typography variant="h6" style={{ fontFamily: 'Inter, Arial, sans-serif', marginRight: '20px' }}>
            <strong>HEAP</strong>
          </Typography>
        </div>
        <nav className="nav-links" style={{ display: 'flex', gap: '20px', marginLeft: '30px' }}>
          <Link to="/">Home</Link>
          <div onClick={handleDocMenuClick} style={{ cursor: 'pointer' }}>
            Documentation <span style={{ fontSize: '0.7em', marginLeft: '-3px', display: 'inline-block', transform: 'scaleY(0.7)', verticalAlign: '0.2em' }}>▼</span>
          </div>
          <div onClick={handleMenuClick} style={{ cursor: 'pointer' }}>
            Results <span style={{ fontSize: '0.7em', marginLeft: '-3px', display: 'inline-block', transform: 'scaleY(0.7)', verticalAlign: '0.2em' }}>▼</span>
          </div>
          <Link to="/downloads">Downloads</Link>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => handleMenuClose(null)}
          >
            <MenuItem onClick={() => handleMenuClose('main')}>Main Results</MenuItem>
            <MenuItem onClick={() => handleMenuClose('summary')}>Lifestyle Categories</MenuItem>
            <MenuItem onClick={() => handleMenuClose('associations')}>Associations</MenuItem>
            <MenuItem onClick={() => handleMenuClose('mediation')}>Disease Links</MenuItem>
            <MenuItem onClick={() => handleMenuClose('intervention')}>Intervention</MenuItem>
            <MenuItem onClick={() => handleMenuClose('enrichment')}>Tissues &amp; Pathways</MenuItem>
            <MenuItem onClick={() => handleMenuClose('causal')}>Causal Evidence (MR)</MenuItem>
            <MenuItem onClick={() => handleMenuClose('pes')}>Exposure Scores (PES)</MenuItem>
            <MenuItem onClick={() => handleMenuClose('gwas')}>Exposure GWAS</MenuItem>
            <Divider />
            <MenuItem onClick={() => handleMenuClose('architecture')}>
              Genetic &amp; Exposomic Architecture
            </MenuItem>
          </Menu>
          <Menu
            anchorEl={docAnchorEl}
            open={Boolean(docAnchorEl)}
            onClose={() => handleDocMenuClose(null)}
          >
              {DOC_PAGES.map((d) => (
                <React.Fragment key={d.path}>
                  {d.group && <Divider />}
                  <MenuItem onClick={() => handleDocMenuClose(d.path)}>{d.label}</MenuItem>
                </React.Fragment>
              ))}
          </Menu>
        </nav>
      </Toolbar>
    </AppBar>
  );
}

export default Header;

