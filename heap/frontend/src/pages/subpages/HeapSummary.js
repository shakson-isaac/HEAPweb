import React from 'react';
import TableComponent from '../../components/TableComponent';

function HeapSummary() {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold">Lifestyle Categories</h3>
      <TableComponent
        csvFilePath={`${process.env.REACT_APP_BACKEND_URL}/fetch_data/GxE_Cat_R2table.csv`} // Use relative URL
      />
    </div>
  );
}

export default HeapSummary;
