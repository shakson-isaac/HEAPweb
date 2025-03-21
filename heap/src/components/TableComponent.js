import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Paper, TextField, CircularProgress, Button } from '@mui/material';

const TableComponent = ({ csvFilePath }) => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(csvFilePath, {
        params: {
          search: currentSearchTerm,
          sortColumn,
          sortDirection,
          page,
          rowsPerPage,
          searchTrigger: true
        },
      });
      console.log('Fetched data:', response.data); // Log the fetched data
      setColumns(response.data.columns);
      setData(response.data.data); // Ensure this matches the response structure
      setTotalRows(response.data.recordsFiltered); // Ensure this matches the response structure
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  }, [csvFilePath, currentSearchTerm, sortColumn, sortDirection, page, rowsPerPage]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchClick = () => {
    setCurrentSearchTerm(searchTerm);
    setPage(0); // Reset to the first page when a new search is triggered
  };

  const handleSort = (column) => {
    const isAsc = sortColumn === column && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortColumn(column);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Paper>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px' }}>
        <TextField
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search..."
          fullWidth
          margin="normal"
        />
        <Button onClick={handleSearchClick} variant="contained" color="primary" style={{ marginLeft: '16px' }}>
          Search
        </Button>
      </div>
      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column}
                    sortDirection={sortColumn === column ? sortDirection : false}
                    onClick={() => handleSort(column)}
                  >
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column}>{row[column]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={totalRows}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default TableComponent;

