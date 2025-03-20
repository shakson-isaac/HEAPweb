import React from 'react';
import Plot from 'react-plotly.js';
import TableComponent from '../../components/TableComponent';

function MainResults() {
  return (
    <div>
      <div className="interactive-plot">
          <iframe
            title="Interactive Plot"
            src={`http://127.0.0.1:5000/data/generic/GvEplot.html`}  // Dynamically set iframe source based on selected protein
            width="100%" 
            height="600px" 
            frameBorder="0"
          />
      </div>
      
      {/* Interactive Table of GvE table*/}
      <div className="mt-8">
        <h3 className="text-xl font-semibold">Omics Data Table</h3>
        <TableComponent />  {/* Display the interactive table */}
      </div>
    </div>
  );
}

export default MainResults;
