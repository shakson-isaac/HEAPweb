import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DataTable from 'react-data-table-component';

const TableComponent = () => {
  const [data, setData] = useState([]);  // Data to display in the table
  const [columns, setColumns] = useState([]);  // Columns for the table
  const [loading, setLoading] = useState(true);  // Loading state
  const [page, setPage] = useState(1);  // Current page
  const [rowsPerPage, setRowsPerPage] = useState(5);  // Rows per page
  const [totalRows, setTotalRows] = useState(0);  // Total number of rows
  const [searchTerm, setSearchTerm] = useState('');  // Search term for filtering
  const [sortColumn, setSortColumn] = useState('Gene');  // Sort column
  const [sortDirection, setSortDirection] = useState('asc');  // Sort direction

  // Memoize fetchData to avoid unnecessary re-renders
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:5000/fetch_data', {
        params: {
          start: (page - 1) * rowsPerPage,  // Page offset for pagination
          length: rowsPerPage,  // Rows per page
          'search[value]': searchTerm,  // Search term for filtering
          'order[0][column]': sortColumn,  // Sorting column
          'order[0][dir]': sortDirection  // Sorting direction
        }
      });

      console.log('Response data:', response.data);  // Log the response data
      console.log('Data structure:', response.data.data);  // Log the data structure

      setData(response.data.data);  // Update the table data
      setTotalRows(response.data.recordsTotal);  // Update the total rows for pagination

      // Dynamically generate columns based on the data structure
      const dynamicColumns = response.data.columns.map(column => ({
        name: column,
        selector: row => row[column],
        sortable: true
      }));
      setColumns(dynamicColumns);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  }, [page, rowsPerPage, searchTerm, sortColumn, sortDirection]); // Dependencies

  // Handle pagination change
  const handlePageChange = (page) => {
    console.log('Page changed:', page);  // Log page change
    setPage(page);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (newPerPage) => {
    console.log('Rows per page changed:', newPerPage);  // Log rows per page change
    setRowsPerPage(newPerPage);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    console.log('Search term changed:', e.target.value);  // Log search term change
    setSearchTerm(e.target.value);
  };

  // Handle column sort change
  const handleSort = (column, sortDirection) => {
    console.log('Sort column changed:', column.name);  // Log sort column change
    console.log('Sort direction changed:', sortDirection);  // Log sort direction change
    setSortColumn(column.name);
    setSortDirection(sortDirection);
  };

  // Fetch data when pagination, search term, or sorting changes
  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, searchTerm, sortColumn, sortDirection, fetchData]); // Now `fetchData` is included safely

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
          onSort={handleSort}
        />
      ) : (
        <p>There are no records to display</p>
      )}
    </div>
  );
};

export default TableComponent;

