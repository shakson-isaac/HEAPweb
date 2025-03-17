import React from 'react';
import Plot from 'react-plotly.js';
import TableComponent from './TableComponent';

function MainResults() {
  return (
    <div>
      {/* Plotly chart */}
      <div className="mt-4">
        <Plot
          data={[{
            x: [1, 2, 3, 4],
            y: [10, 11, 12, 13],
            type: 'scatter',
            mode: 'lines+markers',
            marker: { color: 'blue' },
          }]}
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
    </div>
  );
}

export default MainResults;
