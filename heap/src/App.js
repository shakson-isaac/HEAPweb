// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';  // Assuming you will create a Home component
import Results from './pages/Results';  // The Results page will render the TableComponent
import TableComponent from './components/TableComponent';  // Import the TableComponent

function App() {
  return (
    <Router>
      <div>
        {/* Navigation Links */}
        <nav>
          <Link to="/">Home</Link>
          <Link to="/results">Results</Link>
        </nav>

        <Routes>
          {/* Home route */}
          <Route path="/" element={<Home />} />

          {/* Results route where TableComponent is displayed */}
          <Route path="/results" element={<Results />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

