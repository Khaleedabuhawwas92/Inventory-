// Centralized resolver for backend-served assets (company logo, product
// images, etc.). The API base (VITE_API_URL, default http://localhost:5000/api)
// and the backend's static file origin are the same host — just without the
// trailing /api — so this derives it once instead of hardcoding localhost:5000
// (or any other host) anywhere a logo/image is rendered.
//
// In dev, frontend (5173) and backend (5000) are different origins and there
// is no Vite proxy for /uploads, so a bare relative path like
// "/uploads/logo/x.png" resolves against the frontend's own origin and 404s.
// This makes it resolve against the backend origin instead.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export function resolveAssetUrl(assetPath) {
  if (!assetPath) return '';
  // Already absolute (http/https) or a local blob:/data: preview URL — leave as-is.
  if (/^(https?:|blob:|data:)/i.test(assetPath)) return assetPath;
  return `${BACKEND_ORIGIN}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
}
