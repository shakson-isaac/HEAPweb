// src/pages/Home.js
import React from 'react';
import './Home.css';  // Import the CSS file

const Home = () => {
  return (
    <div className="content container">
      <h1 className="heading">Welcome to HEAP!</h1>
      <div className="section">
        <p className="paragraph">
          Welcome to the HEAP (<strong>H</strong>uman <strong>E</strong>xposomic <strong>A</strong>rchitecture of the <strong>P</strong>roteome) resource!
        </p>

        <p className="paragraph">
          This webpage provides HEAP summary statistics and interactive plots generated from: 
          <a href="https://doi.org/10.1101/2025.05.07.25327178" target="_blank" rel="noopener noreferrer">https://doi.org/10.1101/2025.05.07.25327178</a>
        </p>
        <p className="paragraph">
          HEAP results are generated from UK Biobank Genetics, Exposures, Proteomics, and Disease Codes on 53,014 individuals across 2686 plasma proteins.
        </p>
      </div>
      <div className="section">
        <img src="/HEAP_summ.png" alt="HEAP Logo" className="image" />
      </div>
      <div className="section">
        <p className="paragraph">HEAP contains 4 modules:</p>
        <ul className="list">
          <li className="list-item"><strong>Variance Decomposition</strong>: Partitioned R<sup>2</sup> of genetics and exposures</li>
          <li className="list-item"><strong>Gene-by-Environment Associations</strong>: Statistical analysis of individual exposure and polygenic GxE associations</li>
          <li className="list-item"><strong>Mediation Analysis</strong>: Link exposure-disease and genetic-disease links using proteins</li>
          <li className="list-item"><strong>Interventional Cohort Validation</strong>: Correlate HEAP associations with interventional studies</li>
        </ul>
      </div>
      <div className="section">
        <p className="paragraph"><strong>DATA USAGE AGREEMENT AND LICENSES:</strong></p>
        <ul className="list">
          <li className="list-item">
            This work is licensed under a{' '}
            <a 
              href="https://creativecommons.org/licenses/by-nc-nd/4.0/" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License (CC BY-NC-ND)
            </a>.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Home;

