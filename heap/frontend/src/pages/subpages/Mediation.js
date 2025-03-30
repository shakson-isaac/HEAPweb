import React from 'react';
import TableComponent from '../../components/TableComponent';

function Mediation() {
  return (
    <div>
      <div className="mt-8">
        <h3 className="text-xl font-semibold">Mediation</h3>
        <p>Here you can provide details about the mediation analysis...</p>
        {/* Add more content for the Mediation page */}
      </div>

      <div className="interactive-plot">
        <iframe
          title="Interactive Plot"
          src={`${process.env.REACT_APP_BACKEND_URL}/data/generic/GEMplot.html`} // Use relative URL
          width="1200px"
          height="600px"
          frameBorder="0"
        />
      </div>

      {/* Interactive Table of GvE table */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold">Mediation Results for the Proteome</h3>
        <TableComponent
          csvFilePath={`${process.env.REACT_APP_BACKEND_URL}/fetch_data/MediationResults.csv`} // Use relative URL
        />
      </div>
    </div>
  );
}

export default Mediation;
