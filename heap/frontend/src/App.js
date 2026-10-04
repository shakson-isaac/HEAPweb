// src/App.js
import React, { useMemo } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { makeTheme } from './theme';
import { ColorModeProvider, useColorMode } from './lib/colorMode';
import Home from './pages/Home';
import EntityProtein from './pages/EntityProtein';
import Results from './pages/Results';
import Downloads from './pages/Downloads';
import NotFound from './pages/NotFound';
import Header from './components/Header';
import './App.css';  // Ensure this path is correct
import Documentation from './pages/Documentation';

// The theme is rebuilt only when the mode changes, and `data-mode` on <html>
// lets the plain CSS files (App.css, Home.css) follow the same switch.
function Themed() {
  const { mode } = useColorMode();
  const theme = useMemo(() => makeTheme(mode), [mode]);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="app-container">
        <Router>
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/results/*" element={<Results />} />
              <Route path="/explore/protein/:symbol" element={<EntityProtein />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/documentation/*" element={<Documentation />} />
              {/* Anything the router does not know. Without this an unknown
                  path rendered a blank shell and read as a broken site. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </Router>
      </div>
    </ThemeProvider>
  );
}

const App = () => (
  <ColorModeProvider>
    <Themed />
  </ColorModeProvider>
);

export default App;
