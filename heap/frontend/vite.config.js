import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite replaced Create React App on 2026-10-05. react-scripts@5.0.1 was last
// published in April 2022 and has no patched release, so the ~70 build-time
// advisories under it could not be fixed -- only removed with the tool.
//
// THE ONE THING THAT WILL BITE: this project keeps JSX in .js files, 74 of
// them. Vite's esbuild treats .js as plain JavaScript and fails on the first
// angle bracket, so both settings below are required -- `loader` for our own
// source, and the optimizeDeps override for any dependency that ships JSX in
// .js (react-plotly.js does).
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  build: {
    outDir: 'build',        // Firebase Hosting serves `build`; firebase.json says so
    sourcemap: false,
  },
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
