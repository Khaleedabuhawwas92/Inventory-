// Safe print helper usable by any page's "طباعة" button.
//
// The desktop shell's preload (desktop/electron/preload.js) only exposes
// `window.desktopApp` (isElectron/platform/getVersion) — it does not expose a
// native `electronAPI.print()` bridge today. Calling something like
// `window.electronAPI.print()` directly would throw
// "Cannot read properties of undefined (reading 'print')" in the browser
// build (no electronAPI at all) and in the current desktop build alike
// (electronAPI was never the exposed name, and no print method exists yet).
//
// This helper detects Electron safely (no unguarded property access) and
// uses a native print bridge only if one is ever exposed under
// `window.electronAPI.print` or `window.desktopApp.print`; otherwise it
// always falls back to the standard `window.print()`, which works in both
// plain browsers and Electron's renderer.
export function safePrint() {
  try {
    const electronPrint =
      (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.print === 'function'
        ? window.electronAPI.print
        : null) ||
      (typeof window !== 'undefined' && window.desktopApp && typeof window.desktopApp.print === 'function'
        ? window.desktopApp.print
        : null);

    if (electronPrint) {
      electronPrint();
      return;
    }
  } catch (err) {
    console.error('Electron print bridge failed, falling back to window.print():', err);
  }

  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}
