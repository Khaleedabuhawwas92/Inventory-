// Centralized resolver for backend-served assets (organization logos, etc.).
// The API base (VITE_API_URL, default http://localhost:5000/api) and the
// backend's static file origin are the same host — just without the
// trailing /api — so this derives it once instead of hardcoding localhost.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export function resolveAssetUrl(assetPath) {
  if (!assetPath) return '';
  if (/^(https?:|blob:|data:)/i.test(assetPath)) return assetPath;
  return `${BACKEND_ORIGIN}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
}
