const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// The backend is an external, independently-run service (dev: whatever's on
// http://localhost:5000; production: wherever the config below points) —
// Electron never spawns or manages it. This is a deliberate simplification:
// the previous version spawned backend/server.js itself and waited for it,
// but if Mongo wasn't reachable in the packaged environment the backend
// never came up, the wait silently timed out, and the window was left
// pointed at nothing — a blank white screen with no visible cause. Loading
// the UI shell is now completely decoupled from backend availability; the
// app's own connectivity check (frontend/src/App.vue) shows a proper
// "can't reach the server" screen with a retry button instead.
const isDev = !app.isPackaged;
const DEFAULT_DEV_SERVER_URL = 'http://localhost:5173';
const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';

let mainWindow = null;

// --- Backend URL resolution (dev: fixed; production: configurable) --------
//
// Resolution order:
//   1. API_BASE_URL environment variable (advanced/dev override).
//   2. <userData>/config.json's `apiBaseUrl` (the supported way to point an
//      installed app at a different backend without rebuilding — main.js
//      creates this file with the default value on first run so it's
//      discoverable).
//   3. Hard fallback default (http://localhost:5000/api).
function resolveApiBaseUrl() {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;

  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed?.apiBaseUrl) return parsed.apiBaseUrl;
    } else {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({ apiBaseUrl: DEFAULT_API_BASE_URL }, null, 2));
    }
  } catch (err) {
    console.error('[Electron] Failed to read/create config.json, using default API URL:', err.message);
  }
  return DEFAULT_API_BASE_URL;
}

function resolveDevServerUrl() {
  return process.env.VITE_DEV_SERVER_URL || DEFAULT_DEV_SERVER_URL;
}

function resolveProdIndexPath() {
  // extraResources in package.json copies frontend/dist-electron here as
  // "frontend" (production-only resource; see build.extraResources below).
  return path.join(process.resourcesPath, 'frontend', 'index.html');
}

// Waiting for the dev server here is a safety net on top of the `npm run
// dev` orchestration (desktop/package.json already waits on the Vite port
// before even launching Electron) — this retries the actual page load in
// case Electron still won the race, instead of showing a dead window.
function loadWithRetry(win, loadFn, { attempts = 15, delayMs = 500, label = '' } = {}) {
  let attempt = 0;
  const tryLoad = () => {
    attempt += 1;
    loadFn().catch((err) => {
      console.error(`[Electron] Load attempt ${attempt}/${attempts} failed${label ? ` (${label})` : ''}:`, err.message);
      if (attempt >= attempts) {
        console.error(`[Electron] Giving up after ${attempts} attempts.`);
        return;
      }
      setTimeout(tryLoad, delayMs);
    });
  };
  tryLoad();
}

function createWindow() {
  const apiBaseUrl = resolveApiBaseUrl();
  console.log(`[Electron] Using API base URL: ${apiBaseUrl}`);

  // No app icon has been designed yet (see desktop/README.md) — falling
  // back to Electron's own default icon rather than pointing at a path that
  // doesn't exist.
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    title: 'نظام إدارة المخزون',
    autoHideMenuBar: !isDev,
    show: false,
    webPreferences: {
      // Never enable nodeIntegration / disable contextIsolation / disable
      // sandbox here — the renderer loads a web app (built Vue bundle) and
      // must be treated like any other untrusted web page with zero direct
      // Node.js access. No @electron/remote is used anywhere in this app.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      // The sandboxed preload can't read process.env/files itself; this is
      // how the resolved API URL reaches it (parsed back out of argv there).
      additionalArguments: [`--api-base-url=${apiBaseUrl}`],
    },
  });

  // Maximize *before* showing (the window was created with `show: false`),
  // so it appears already maximized with no visible resize/flicker — never
  // maximize an already-visible window. Production only: dev keeps a normal
  // sized, resizable window since that's more convenient while debugging.
  // Still a normal window either way (no kiosk mode, no `fullscreen: true`)
  // — minimize/maximize/restore/close all keep working exactly as usual.
  mainWindow.once('ready-to-show', () => {
    if (!isDev) mainWindow.maximize();
    mainWindow.show();
  });

  // Clear, specific diagnostics instead of a silent blank window — these
  // fire for both dev (Vite not up yet) and production (bad resource path,
  // corrupt build) load failures.
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] did-fail-load: ${errorDescription} (${errorCode}) for ${validatedURL}`);
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Electron] Renderer process gone:', details.reason);
  });

  // External links (target=_blank, window.open, absolute non-app URLs)
  // open in the user's real browser instead of inside the app shell —
  // never navigate the app window itself to arbitrary external content.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDevServer = isDev && url.startsWith(resolveDevServerUrl());
    const isAppFile = !isDev && url.startsWith('file://');
    if (!isDevServer && !isAppFile) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    const devServerUrl = resolveDevServerUrl();
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    loadWithRetry(mainWindow, () => mainWindow.loadURL(devServerUrl), { label: `dev server ${devServerUrl}` });
  } else {
    const indexPath = resolveProdIndexPath();
    if (!fs.existsSync(indexPath)) {
      console.error(`[Electron] Built frontend not found at ${indexPath}. Did the build step run?`);
    }
    loadWithRetry(mainWindow, () => mainWindow.loadFile(indexPath), { attempts: 3, label: `production build ${indexPath}` });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('app:get-version', () => app.getVersion());

app.whenReady().then(() => {
  if (!isDev) Menu.setApplicationMenu(null);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
