import axios from 'axios';

// Inside Electron, the backend URL is resolved at *runtime* by the main
// process (env var or a user-editable config file — see
// desktop/electron/main.js) and handed to this page via contextBridge, not
// baked into the bundle at build time — the same packaged .exe can then
// point at a local or remote backend without rebuilding. The web build is
// unaffected: window.desktopApp doesn't exist there, so it falls through to
// the normal build-time VITE_API_URL as before.
const baseURL =
  (typeof window !== 'undefined' && window.desktopApp?.apiBaseUrl) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // sends the httpOnly refresh-token cookie
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue = [];

function resolveQueue(error, token) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

// Clears all local auth state and tells the rest of the app the session is
// gone, for good — used both by the SESSION_REVOKED fast path below and by
// an ordinary failed-refresh. `detail.code` lets App.vue show "logged out by
// an administrator" instead of the generic "your session expired" message
// when that's specifically what happened (see middleware/auth.js on the
// backend, which is the only place that ever sets this code).
function forceLogout(code) {
  localStorage.removeItem('accessToken');
  window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { code } }));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response || response.status !== 401 || config?._retry || config?.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    // An admin-forced logout (Platform Admin "revoke sessions") invalidates
    // the refresh token server-side too (see backend tokenService.js
    // revokeAllForUser), so attempting /auth/refresh here would only fail a
    // moment later anyway — skip straight to logging out, both to avoid a
    // pointless round-trip and because this is the one place that reliably
    // carries the SESSION_REVOKED code (a failed /auth/refresh reports a
    // generic expired-session message instead, see auth.controller.js).
    if (response.data?.code === 'SESSION_REVOKED') {
      forceLogout('SESSION_REVOKED');
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        config.headers.Authorization = `Bearer ${token}`;
        config._retry = true;
        return api(config);
      });
    }

    config._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post('/auth/refresh');
      const newToken = data.data.accessToken;
      localStorage.setItem('accessToken', newToken);
      resolveQueue(null, newToken);
      config.headers.Authorization = `Bearer ${newToken}`;
      return api(config);
    } catch (refreshError) {
      resolveQueue(refreshError, null);
      forceLogout(refreshError.response?.data?.code);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
