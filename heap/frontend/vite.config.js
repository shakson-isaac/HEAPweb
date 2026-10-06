import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite replaced Create React App on 2026-10-05. react-scripts@5.0.1 was last
// published in April 2022 and has no patched release, so roughly seventy
// build-time advisories under it could not be fixed, only removed with the
// tool.
//
// JSX LIVES IN .jsx FILES. Under CRA it lived in .js, which Vite's esbuild
// treats as plain JavaScript -- it fails on the first angle bracket. Forcing
// the jsx loader onto every .js file works but costs a great deal: the build
// step ran 195-334s in CI that way, against 24-42s for CRA, because all 1,754
// modules went through the JSX loader. Renaming the 73 files that actually
// contain JSX lets esbuild use its fast path for everything else.
//
// `optimizeDeps` stays. react-plotly.js ships JSX inside .js, and that is a
// dependency we do not control.
export default defineConfig({
  plugins: [react()],
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
