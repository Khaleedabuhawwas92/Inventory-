import api from './api';

export default {
  list() {
    return api.get('/backups');
  },
  create() {
    return api.post('/backups');
  },
  restore(id) {
    return api.post(`/backups/${id}/restore`);
  },
  remove(id) {
    return api.delete(`/backups/${id}`);
  },
};
