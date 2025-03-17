// src/pages/Results.js
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import MainResults from '../components/MainResults';
import HeapSummary from '../components/HeapSummary';

function Results() {
  return (
    <div className="flex p-6">
      <div className="flex-1">
        <h2 className="text-2xl font-bold">Results</h2>
        <Routes>
          <Route path="main" element={<MainResults />} />
          <Route path="summary" element={<HeapSummary />} />
        </Routes>
      </div>
    </div>
  );
}

export default Results;

