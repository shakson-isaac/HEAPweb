// src/components/Header.js
import React from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';

function Header() {
  return (
    <AppBar position="static" className="header">
      <Toolbar>
        <Typography variant="h6" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
          <strong>HEAP: </strong> 
          <strong>H</strong>uman <strong>E</strong>xposomic <strong>A</strong>rchitecture of the <strong>P</strong>roteome
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

export default Header;

