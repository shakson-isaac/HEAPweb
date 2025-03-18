// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import Downloads from './pages/Downloads';
import Header from './components/Header';
import './App.css';  // Ensure this path is correct
import Documentation from './pages/Documentation';

const App = () => {
  return (
    <div className="app-container">
      <Router>
        <header className="header">
          <Header />
        </header>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results/*" element={<Results />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/documentation/*" element={<Documentation />} />
          </Routes>
        </main>
      </Router>
    </div>
  );
};

export default App;

