// src/pages/Home.js
import React from 'react';

const Home = () => {
  return (
    <div className="content">
      <h1>Welcome to HEAP!</h1>
      <p>This webpage provides HEAP summary statistics generated from:</p>
      <p>UK Biobank Genetics, Exposures, and Proteomics</p>
      <img src="/HEAP_summ.png" alt="HEAP Logo" style={{ width: '5000px', marginTop: '20px' }} />
    </div>
  );
};

export default Home;

