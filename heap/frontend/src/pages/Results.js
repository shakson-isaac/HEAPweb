// src/pages/Results.js
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import MainResults from './subpages/MainResults';
import HeapSummary from './subpages/HeapSummary';
import Associations from './subpages/Associations';
import Mediation from './subpages/Mediation';
import Intervention from './subpages/Intervention';
import Interactions from './subpages/Interactions';

function Results() {
  return (
    <div className="flex p-6">
      <div className="flex-1">
        <h2 className="text-2xl font-bold">Results</h2>
        <Routes>
          <Route path="main" element={<MainResults />} />
          <Route path="summary" element={<HeapSummary />} />
          <Route path="associations" element={<Associations />} />
          <Route path="interactions" element={<Interactions />} />
          <Route path="mediation" element={<Mediation />} />
          <Route path="intervention" element={<Intervention />} />
        </Routes>
      </div>
    </div>
  );
}

export default Results;

