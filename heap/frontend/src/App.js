// src/App.js
import React, { useMemo } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import usePageViews from './lib/analytics';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { makeTheme } from './theme';
import { ColorModeProvider, useColorMode } from './lib/colorMode';
import Home from './pages/Home';
import Results from './pages/Results';
import Downloads from './pages/Downloads';
import NotFound from './pages/NotFound';
import Header from './components/Header';
import './App.css';  // Ensure this path is correct
import Documentation from './pages/Documentation';

/** Renders nothing. Exists so usePageViews() runs inside the Router context --
    it calls useLocation(), which throws anywhere above <Router>. */
function PageViews() {
  usePageViews();
  return null;
}

// `data-mode` on <html> is what the plain CSS files (App.css, Home.css) read.
// It is pinned to light -- see lib/colorMode.js -- and `colorScheme` is set
// alongside it so the browser's own chrome (scrollbars, form controls, the
// autofill tint) stays light even when the operating system is in dark mode.
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
          <PageViews />
          <Header />
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
    </ThemeProvider>
  );
}

const App = () => (
  <ColorModeProvider>
    <Themed />
  </ColorModeProvider>
);

export default App;
