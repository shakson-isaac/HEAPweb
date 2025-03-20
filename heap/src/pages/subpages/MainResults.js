import React from 'react';
import TableComponent from '../../components/TableComponent';

function MainResults() {
  return (
    <div>
      <div className="interactive-plot">
        <iframe
          title="Interactive Plot"
          src={`http://127.0.0.1:5000/data/generic/GvEplot.html`}
          width="600px"
          height="400px" 
          frameBorder="0"
        />
      </div>
      
      {/* Interactive Table of GvE table */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold">Partitioned R2: Genetics, Exposures, and its Interactions</h3>
        <TableComponent csvFilePath="http://127.0.0.1:5000/fetch_data/GxE_R2table.csv" />
      </div>
    </div>
  );
}

export default MainResults;
