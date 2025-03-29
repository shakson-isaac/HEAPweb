import React from 'react';
import TableComponent from '../../components/TableComponent';

function MainResults() {
  return (
    <div>
      <div className="interactive-plot">
        <iframe
          title="Interactive Plot"
          src={`/data/generic/GvEplot.html`} // Use relative URL
          width="600px"
          height="400px"
          frameBorder="0"
        />
      </div>
      
      {/* Interactive Table of GvE table */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold">Partitioned R<sup>2</sup>: Genetics, Exposures, and its Interactions</h3>
        <TableComponent
          csvFilePath={`/fetch_data/GxE_R2table.csv`} // Use relative URL
        />
      </div>
    </div>
  );
}

export default MainResults;
