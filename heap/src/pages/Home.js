// src/pages/Home.js
import React from 'react';
import './Home.css';  // Import the CSS file

const Home = () => {
  return (
    <div className="content container">
      <h1 className="heading">Welcome to HEAP!</h1>
      <div className="section">
        <p className="paragraph">
          This webpage provides HEAP summary statistics generated from: 
          <a href="**INSERT PAPER LINK**" target="_blank" rel="noopener noreferrer">**INSERT PAPER LINK**</a>
        </p>
        <p className="paragraph">
          HEAP is a method applied to the UK Biobank Genetics, Exposures, Proteomics, and Disease Codes on approximately 50k individuals on 2686 proteins.
        </p>
      </div>
      <div className="section">
        <p className="paragraph">HEAP contains 4 modules:</p>
        <ul className="list">
          <li className="list-item"><strong>Variance Decomposition</strong>: Partitioned R2 of genetics and exposures</li>
          <li className="list-item"><strong>Gene-by-Environment Associations</strong>: Statistical analysis of individual exposure and polygenic GxE associations</li>
          <li className="list-item"><strong>Mediation Analysis</strong>: Link exposure-disease and genetic-disease links using proteins</li>
          <li className="list-item"><strong>Interventional Cohort Validation</strong>: Correlate HEAP associations with interventional studies</li>
        </ul>
      </div>
      <div className="section">
        <p className="paragraph">HEAP provides the following results:</p>
        <ul className="list">
          <li className="list-item">Variance decomposition of genetic and exposomic effects using a polygenic score (PGS) and polyexposure score (PXS) for each protein.</li>
          <li className="list-item">Polygenic scores were utilized from <a href="https://www.omicspred.org" target="_blank" rel="noopener noreferrer">OMICSPRED</a> resource, while polyexposure scores were built under a lasso framework.</li>
          <li className="list-item">Partitioned R2 of genetics, exposures, and covariates are shared</li>
          <li className="list-item">Individual exposures and polygenic gene-by-environment interactions association statistics are shared</li>
          <li className="list-item">Mediation results depicting genetic-protein-disease and exposure-protein-disease links are shared</li>
          <li className="list-item">The GEM statistic highlighting how modifiable a protein is under lifestyle exposures is shared</li>
          <li className="list-item">Validation of results with interventional cohorts such as exercise intervention, HERITAGE, and GLP1 agonist randomized control trials, STEP1/STEP2, are shared</li>
          <li className="list-item">Results were generated under various model specifications covering covariates such as age, sex, BMI, population structure, comorbidities, and medication history.</li>
        </ul>
      </div>
      <img src="/HEAP_summ.png" alt="HEAP Logo" className="image" />
    </div>
  );
};

export default Home;

