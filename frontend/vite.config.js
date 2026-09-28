import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// `mode === 'electron'` is a separate build (see desktop/package.json's
// `build:frontend:electron` script: `vite build --mode electron --outDir
// dist-electron`), never the default `npm run build` used for the web
// deployment (frontend/dist, unaffected by this branch).
//
// Electron loads the built index.html via `file://` (BrowserWindow.loadFile),
// not over HTTP. The default absolute base (`/assets/...`) resolves against
// the filesystem root under file:// and 404s every asset — a relative base
// (`./assets/...`) resolves correctly relative to index.html's own folder
// under both file:// and a normal HTTP root deployment. It's Electron-only
// here (not applied to the web build) because a *relative* base breaks the
// opposite way for the web build's deep-link routes (e.g. a browser refresh
// on /products/123 served by the backend's history-mode fallback) — see
// src/router/index.js, which pairs this with hash-based routing for
// Electron specifically, so this never applies to a history-mode deep link.
export default defineConfig(({ mode }) => ({
  base: mode === 'electron' ? './' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
}));
