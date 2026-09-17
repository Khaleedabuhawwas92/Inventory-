// Runs in an isolated world (contextIsolation: true) with no direct access to
// Node.js APIs (nodeIntegration: false) — only what's explicitly exposed here
// via contextBridge ever reaches the renderer's `window` object. The app
// itself talks to the backend purely over HTTP (same as the web build), so
// this stays intentionally minimal: a few read-only facts the UI can use to
// tell it's running inside the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
});
