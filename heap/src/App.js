// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import Downloads from './pages/Downloads';
import Header from './components/Header';
import './App.css';  // Import the CSS file
import AboutHeap from './pages/AboutHeap';
import DetailedMethods from './pages/DetailedMethods';
import FAQs from './pages/FAQs';

const App = () => {
  return (
    <div className="app-container">
      <Router>
        <Header />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results/*" element={<Results />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/documentation/about" element={<AboutHeap />} />
            <Route path="/documentation/methods" element={<DetailedMethods />} />
            <Route path="/documentation/faqs" element={<FAQs />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
};

export default App;

