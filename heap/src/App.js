// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import './App.css';  // Import the CSS file

const App = () => {
  return (
    <div className="app-container">
      <Router>
        <Header />
        <div className="main-content">
          <Sidebar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
};

export default App;

