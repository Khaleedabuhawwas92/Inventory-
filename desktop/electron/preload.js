// Runs in an isolated world (contextIsolation: true) with no direct access to
// Node.js APIs (nodeIntegration: false, sandbox: true) — only what's
// explicitly exposed here via contextBridge ever reaches the renderer's
// `window` object. The app itself talks to the backend purely over HTTP
// (same as the web build), so this stays intentionally minimal: a few
// read-only facts the UI can use.
const { contextBridge, ipcRenderer } = require('electron');

// main.js can't call into a sandboxed preload script directly to hand it
// data (no exposed IPC channel for that), so it passes the resolved backend
// URL as a CLI-style flag via BrowserWindow's webPreferences.additionalArguments,
// which Electron appends to this process's argv — readable here even
// sandboxed.
function readApiBaseUrl() {
  const flag = process.argv.find((arg) => arg.startsWith('--api-base-url='));
  return flag ? flag.slice('--api-base-url='.length) : null;
}

contextBridge.exposeInMainWorld('desktopApp', {
  isElectron: true,
  platform: process.platform,
  apiBaseUrl: readApiBaseUrl(),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
});
