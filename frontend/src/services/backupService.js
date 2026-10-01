import api from './api';

// /org-backups — the tenant-scoped feature (each organization's own admin
// backs up/restores only its own data). Not /backups, which dumps/restores
// the *entire* database across every organization and is Platform-Admin-only
// (see backend/routes/backup.routes.js vs routes/orgBackup.routes.js).
export default {
  list() {
    return api.get('/org-backups');
  },
  create() {
    return api.post('/org-backups');
  },
  restore(id) {
    return api.post(`/org-backups/${id}/restore`);
  },
  remove(id) {
    return api.delete(`/org-backups/${id}`);
  },
};
