import api from './api';

// Reuses the exact same auth endpoints the tenant frontend uses — no
// platform-specific login endpoint exists or is needed (spec §4). The
// isPlatformAdmin check happens client-side in stores/auth.js after these
// calls resolve; the *real* enforcement is server-side
// (backend/middleware/requirePlatformAdmin.js on every /api/platform/* route).
export default {
  login(identifier, password) {
    return api.post('/auth/login', { identifier, password });
  },
  logout() {
    return api.post('/auth/logout');
  },
  me() {
    return api.get('/auth/me');
  },
  refresh() {
    return api.post('/auth/refresh');
  },
};
