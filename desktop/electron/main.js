const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const BACKEND_PORT = process.env.PORT || 5000;
const DEV_FRONTEND_URL = 'http://localhost:5173';

let mainWindow = null;
let backendProcess = null;

function resolveBackendEntry() {
  // Packaged layout: resources/backend/server.js (see build config in package.json's
  // `extraResources`). Dev layout: ../../backend/server.js relative to this file.
  return isDev
    ? path.join(__dirname, '..', '..', 'backend', 'server.js')
    : path.join(process.resourcesPath, 'backend', 'server.js');
}

function waitForBackend(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) return resolve();
          retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Backend did not become ready in time'));
      setTimeout(attempt, 400);
    };
    attempt();
  });
}

// Only the packaged production build spawns the backend itself — in dev,
// `npm run dev` in backend/ and frontend/ are expected to already be running
// (the normal Electron+Vite workflow), so main.js just points at them.
function startBackend() {
  const entry = resolveBackendEntry();
  backendProcess = spawn(process.execPath, [entry], {
    env: { ...process.env, NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });
  backendProcess.on('exit', (code) => {
    console.error(`[Electron] Backend process exited unexpectedly (code ${code})`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    title: 'نظام إدارة المخزون',
    autoHideMenuBar: !isDev,
    webPreferences: {
      // Never enable nodeIntegration / disable contextIsolation here — the
      // renderer loads a remote-ish web app (built Vue bundle) and must be
      // treated like any other web page with no direct Node.js access.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_FRONTEND_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('app:get-version', () => app.getVersion());

app.whenReady().then(async () => {
  if (!isDev) {
    Menu.setApplicationMenu(null);
    startBackend();
    try {
      await waitForBackend(`http://localhost:${BACKEND_PORT}/api/health`);
    } catch (err) {
      console.error('[Electron] Backend failed to start:', err.message);
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
