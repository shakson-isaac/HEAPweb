// src/pages/Results.js
import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Link } from 'react-router-dom';
import TableComponent from '../components/TableComponent';  // Import the TableComponent

function Results() {
  const [data, setData] = useState({
    x: [1, 2, 3, 4],
    y: [10, 11, 12, 13],
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: 'blue' },
  });

  return (
    <div className="flex p-6">
      <div className="flex-1">
        <h2 className="text-2xl font-bold">Results</h2>
        
        {/* Plotly chart */}
        <div className="mt-4">
          <Plot
            data={[data]}
            layout={{
              title: 'Prediction Data',
              xaxis: { title: 'X-Axis' },
              yaxis: { title: 'Y-Axis' },
            }}
          />
        </div>
        
        {/* Interactive Table */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold">Omics Data Table</h3>
          <TableComponent />  {/* Display the interactive table */}
        </div>
        
        {/* Link to navigate back to Home */}
        <div className="mt-4">
          <Link to="/" className="text-blue-500 hover:text-blue-700">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

export default Results;

