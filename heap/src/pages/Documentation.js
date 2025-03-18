import React from 'react';
import { Route, Routes } from 'react-router-dom';
import AboutHeap from './subpages/AboutHeap';
import DetailedMethods from './subpages/DetailedMethods';
import FAQs from './subpages/FAQs';

function Documentation() {
  return (
    <div className="flex p-6">
      <div className="flex-1">
        <h2 className="text-2xl font-bold">Documentation</h2>
        <Routes>
          <Route path="about" element={<AboutHeap />} />
          <Route path="methods" element={<DetailedMethods />} />
          <Route path="faqs" element={<FAQs />} />
        </Routes>
      </div>
    </div>
  );
}

export default Documentation;
