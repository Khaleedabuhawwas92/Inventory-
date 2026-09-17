import api from './api';

export default {
  list() {
    return api.get('/roles');
  },
  permissions() {
    return api.get('/roles/permissions');
  },
  get(id) {
    return api.get(`/roles/${id}`);
  },
  create(payload) {
    return api.post('/roles', payload);
  },
  update(id, payload) {
    return api.put(`/roles/${id}`, payload);
  },
  remove(id) {
    return api.delete(`/roles/${id}`);
  },
};
