// src/pages/Home.js
import React from 'react';
import Sidebar from '../components/Sidebar';
import { Container, Typography } from '@mui/material';

function Home() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold">Welcome to HEAP</h1>
        <p className="mt-4 text-lg">This site visualizes the relationship between lifestyle exposures and proteomics for disease risk prediction</p>
      </main>
    </div>
  );
}

export default Home;

