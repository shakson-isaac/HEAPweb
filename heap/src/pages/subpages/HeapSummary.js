import React from 'react';
import TableComponent from '../../components/TableComponent';

function HeapSummary() {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold">HEAP Summary</h3>
      <TableComponent csvFilePath="http://127.0.0.1:5000/fetch_data/GxE_Cat_R2table.csv" />
    </div>
  );
}

export default HeapSummary;
