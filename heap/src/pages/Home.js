// src/pages/Home.js
import React from 'react';

const Home = () => {
  return (
    <div className="content">
      <h1>Welcome to HEAP!</h1>
      <p>This webpage provides HEAP summary statistics generated from: **INSERT PAPER LINK** </p>
      <p>HEAP is a method applied to the UK Biobank Genetics, Exposures, Proteomics, and Disease Codes on approximately 50k individuals on 2686 proteins.</p>
      <p>HEAP contains 4 modules:</p>

      <p>1. **HEAP-Exposome**: Exposome-protein-disease associations</p>
      <p>2. **HEAP-Genetics**: Genetic-protein-disease associations</p>
      <p>3. **HEAP-Exposome-Genetics**: Exposome-protein-disease associations with genetic-protein-disease associations</p>
      <p>4. **HEAP-Exposome-Genetics-Intervention**: Exposome-protein-disease associations with genetic-protein-disease associations and intervention results</p>
      
      <p>HEAP provides the following results:</p>
      <p>Variance decomposition of genetic and exposomic effects using a polygenic score (PGS) and polyexposure score (PXS) for each protein.</p>
      <p>Polygenic scores were utilized from **OMICSPRED** resource, while polyexposure scores were built under a lasso framework.</p>
      <p>Partitioned R2 of genetics, exposures, and covariates are shared</p>
      <p>Individual exposures and polygenic gene-by-environment interactions association statistics are shared</p>
      <p>Mediation results depicting genetic-protein-disease and exposure-protein-disease links are shared</p>
      <p>The GEM statistic highlighting how modifiable a protein is under lifesyle exposures is shared</p>
      <p>Validation of results with interventional cohorts such as exercise intervention, HERITAGE, and GLP1 agonist randomized control trials, STEP1/STEP2, are shared</p>
      <p>Results were generated under various model specifications covering covariates such as age, sex, BMI, population structure, comorbidities, and medication history.</p>
      <img src="/HEAP_summ.png" alt="HEAP Logo" style={{ width: '5000px', marginTop: '20px' }} />
      <p> </p>
    </div>
  );
};

export default Home;

