import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DataTable from 'react-data-table-component';

const TableComponent = () => {
  const [data, setData] = useState([]);  // Data to display in the table
  const [loading, setLoading] = useState(true);  // Loading state
  const [page, setPage] = useState(1);  // Current page
  const [rowsPerPage, setRowsPerPage] = useState(5);  // Rows per page
  const [totalRows, setTotalRows] = useState(0);  // Total number of rows
  const [searchTerm, setSearchTerm] = useState('');  // Search term for filtering

  // Memoize fetchData to avoid unnecessary re-renders
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:5000/fetch_data', {
        params: {
          start: (page - 1) * rowsPerPage,  // Page offset for pagination
          length: rowsPerPage,  // Rows per page
          search: searchTerm  // Search term for filtering
        }
      });

      console.log('Response data:', response.data);  // Log the response data

      setData(response.data.data);  // Update the table data
      setTotalRows(response.data.recordsTotal);  // Update the total rows for pagination
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  }, [page, rowsPerPage, searchTerm]); // Dependencies

  // Handle pagination change
  const handlePageChange = (page) => {
    setPage(page);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (newPerPage) => {
    setRowsPerPage(newPerPage);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Fetch data when pagination or search term changes
  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, searchTerm, fetchData]); // Now `fetchData` is included safely

  // Define columns for the DataTable
  const columns = [
    { name: 'Disease', selector: 'Disease', sortable: true },
    { name: 'Gene', selector: 'Gene', sortable: true },
    { name: 'Protein', selector: 'Protein', sortable: true },
    { name: 'Score', selector: 'Score', sortable: true }
  ];

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={handleSearchChange}
        placeholder="Search..."
      />
      {data && data.length > 0 ? (
        <DataTable
          title="Omics Data"
          columns={columns}
          data={data}
          progressPending={loading}
          pagination
          paginationServer
          paginationTotalRows={totalRows}
          onChangePage={handlePageChange}
          onChangeRowsPerPage={handleRowsPerPageChange}
        />
      ) : (
        <p>There are no records to display</p>
      )}
    </div>
  );
};

export default TableComponent;

