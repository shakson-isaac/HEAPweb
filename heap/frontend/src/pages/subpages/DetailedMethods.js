import React from 'react';
import { Link } from 'react-router-dom';

const DetailedMethods = () => {
  return (
    <div className="content container">
      <h1 className="heading">Detailed Methods</h1>
      <div className="section">
      <p className="paragraph">
        This section provides a brief description of the methods used in the HEAP resource. 
        HEAP results are generated utilizing the UK Biobank genetics, exposures, proteomics, and disease codes on 53,014 individuals.
        Specifically, using over 90 million imputed genetic variants, 2686 normalized and batch corrected plasma protein expression levels, 135 lifestyle exposures, and 270 disease codes.
        For further details on methods please refer to: <a href="**INSERT PAPER LINK**" target="_blank" rel="noopener noreferrer">**INSERT PAPER LINK**</a>
      </p>
      </div>
      <div className="section">
        <p className="paragraph">HEAP contains the following results:</p>
        <ul className="list">
          <li className="list-item">Variance decomposition: R<sup>2</sup> of genetic, exposure, and covariates using a polygenic score (PGS) and polyexposure score (PXS) for each protein. 
            Polygenic scores were utilized from <a href="https://www.omicspred.org" target="_blank" rel="noopener noreferrer">OMICSPRED</a> resource, while polyexposure scores were built under a lasso framework.</li>
          <li className="list-item">Gene-by-Environment Assocations: Summary statistics of individual exposures and polygenic gene-by-environment interactions across the proteome.</li>
          <li className="list-item">Mediation Analysis: G-computation with 2 regression models 
            (Mediator Model: Protein ~ PGS + PXS + Covariates; Outcome Model: Disease ~ Protein + PGS + PXS + Covariates).
            We report indirect effects (genetic-protein-disease and exposure-protein-disease) and direct effects (genetic-disease and exposure-disease). 
            Additionally, we created a statistic, GEM, which summarizes how modifable a protein is under lifestyle exposures across 270 disease codes </li>
          <li className="list-item">Interventional Cohort Validation: We correlate exposure-protein associations with proteomic changes (post intervention - baseline) in interventional studies. 
            We utilized a 20-week endurance training intervention, HERITAGE, and 68-week GLP1 agonist treatment randomized control trials, STEP1 and STEP2.</li>
        </ul>
      </div>    
      <div className="section"> 
        <p className="paragraph">HEAP applies methods across various covariate specifications:</p>
        <ul className="list">   
          <li className="list-item">Model specifications included: age, sex, BMI, population structure, comorbidities, and medication history.</li>
          <li className="list-item">We display results from the maximally specified model on this webpage</li>
          <li className="list-item">
            All significant results are available in the <Link to="/downloads">Downloads</Link> section
          </li>
        </ul>
      </div>
      <div className="section">
        <h3 className="text-lg font-semibold">Covariate Specifications</h3>
        <table className="table-auto border-collapse border border-gray-300 w-full mt-4">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2">Label</th>
              <th className="border border-gray-300 px-4 py-2">Covariate Specification</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Model 1</td>
              <td className="border border-gray-300 px-4 py-2">Age, Sex</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Model 2</td>
              <td className="border border-gray-300 px-4 py-2">Age, Sex, BMI, Fasting Time</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Model 3</td>
              <td className="border border-gray-300 px-4 py-2">Age, Sex, Age * Sex, Age², Age² * Sex, BMI, Fasting Time, Assessment Center, 20 Genetic PCs</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Model 4</td>
              <td className="border border-gray-300 px-4 py-2">Age, Sex, Age * Sex, Age², Age² * Sex, BMI, Fasting Time, Assessment Center, 20 Genetic PCs, Medications (Blood Pressure, Hormone Replacement, Insulin, Cholesterol Lowering, Contraceptives)</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Model 5</td>
              <td className="border border-gray-300 px-4 py-2">Age, Sex, Age * Sex, Age², Age² * Sex, BMI, Fasting Time, Assessment Center, 40 Genetic PCs, Medications (Blood Pressure, Hormone Replacement, Insulin, Cholesterol Lowering, Contraceptives)</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Model 6</td>
              <td className="border border-gray-300 px-4 py-2">Age, Sex, Age * Sex, Age², Age² * Sex, BMI, Fasting Time, Assessment Center, 40 Genetic PCs, Medications (Blood Pressure, Hormone Replacement, Insulin, Cholesterol Lowering, Contraceptives), Multiple Deprivation Indices</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DetailedMethods;
