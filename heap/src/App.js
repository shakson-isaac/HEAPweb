// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';  // Assuming you will create a Home component
import Results from './pages/Results';  // The Results page will render the TableComponent
import TableComponent from './components/TableComponent';  // Import the TableComponent

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </Router>
  );
};

export default App;

