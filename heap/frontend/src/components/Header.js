import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Menu, MenuItem } from '@mui/material';

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
            <MenuItem onClick={() => handleMenuClose('summary')}>HEAP Summary</MenuItem>
            <MenuItem onClick={() => handleMenuClose('associations')}>Associations</MenuItem>
            <MenuItem onClick={() => handleMenuClose('mediation')}>Mediation</MenuItem>
            <MenuItem onClick={() => handleMenuClose('intervention')}>Intervention</MenuItem>
            <MenuItem onClick={() => handleMenuClose('interactions')}>Interactions</MenuItem>
          </Menu>
          <Menu
            anchorEl={docAnchorEl}
            open={Boolean(docAnchorEl)}
            onClose={() => handleDocMenuClose(null)}
          >
            <MenuItem onClick={() => handleDocMenuClose('about')}>About HEAP</MenuItem>
            <MenuItem onClick={() => handleDocMenuClose('methods')}>Detailed Methods</MenuItem>
            <MenuItem onClick={() => handleDocMenuClose('faqs')}>FAQs</MenuItem>
          </Menu>
        </nav>
      </Toolbar>
    </AppBar>
  );
}

export default Header;

