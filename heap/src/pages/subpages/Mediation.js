import React from 'react';
import TableComponent from '../../components/TableComponent'; // Add this import

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
          src={`http://127.0.0.1:5000/data/generic/GEMplot.html`}
          width="1200px"
          height="600px" 
          frameBorder="0"
        />
      </div>

      {/* Interactive Table of GvE table */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold">Mediation Results for the Proteome</h3>
        <TableComponent csvFilePath="http://127.0.0.1:5000/fetch_data/MediationResults.csv" />
      </div>
    </div>
  );
}

export default Mediation;
