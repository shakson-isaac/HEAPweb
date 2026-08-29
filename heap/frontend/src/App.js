// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import Downloads from './pages/Downloads';
import NotFound from './pages/NotFound';
import Header from './components/Header';
import './App.css';  // Ensure this path is correct
import Documentation from './pages/Documentation';

const App = () => {
  return (
    <div className="app-container">
      <Router>
        <Header /> {/* Remove the surrounding <header> tag */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results/*" element={<Results />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/documentation/*" element={<Documentation />} />
            {/* Anything the router does not know. Without this an unknown
                path rendered a blank shell and read as a broken site. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </Router>
    </div>
  );
};

export default App;

