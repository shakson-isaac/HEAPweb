// src/components/Header.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Menu, MenuItem } from '@mui/material';

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
      <Toolbar>
        <Typography variant="h6" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
          <strong>HEAP</strong>
        </Typography>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <div onClick={handleMenuClick} style={{ cursor: 'pointer' }}>
            Results
          </div>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => handleMenuClose(null)}
          >
            <MenuItem onClick={() => handleMenuClose('main')}>Main Results</MenuItem>
            <MenuItem onClick={() => handleMenuClose('summary')}>HEAP Summary</MenuItem>
          </Menu>
          {/* Add more links as needed */}
        </nav>
      </Toolbar>
    </AppBar>
  );
}

export default Header;

