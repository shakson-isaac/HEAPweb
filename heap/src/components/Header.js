import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Menu, MenuItem } from '@mui/material';

const heapLogo = `${process.env.PUBLIC_URL}/HEAPlogo.png`;

function Header() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (page) => {
    setAnchorEl(null);
    if (page) {
      navigate(`/results/${page}`);
    }
  };

  return (
    <AppBar position="static" className="header">
      <Toolbar style={{ justifyContent: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src={heapLogo} alt="HEAP Logo" style={{ width: '30px', height: '30px', marginRight: '10px' }} />
          <Typography variant="h6" style={{ fontFamily: 'Inter, Arial, sans-serif', marginRight: '20px' }}>
            <strong>HEAP</strong>
          </Typography>
        </div>
        <nav className="nav-links" style={{ display: 'flex', gap: '20px', marginLeft: '20px' }}>
          <Link to="/">Home</Link>
          <div onClick={handleMenuClick} style={{ cursor: 'pointer' }}>
            Results
          </div>
          <Link to="/downloads">Downloads</Link>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => handleMenuClose(null)}
          >
            <MenuItem onClick={() => handleMenuClose('main')}>Main Results</MenuItem>
            <MenuItem onClick={() => handleMenuClose('summary')}>HEAP Summary</MenuItem>
          </Menu>
        </nav>
      </Toolbar>
    </AppBar>
  );
}

export default Header;

