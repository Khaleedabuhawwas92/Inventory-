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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response || response.status !== 401 || config?._retry || config?.url?.includes('/auth/')) {
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
      localStorage.removeItem('accessToken');
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
