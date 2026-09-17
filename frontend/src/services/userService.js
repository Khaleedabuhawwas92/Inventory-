import api from './api';

export default {
  list(params) {
    return api.get('/users', { params });
  },
  get(id) {
    return api.get(`/users/${id}`);
  },
  create(payload) {
    return api.post('/users', payload);
  },
  update(id, payload) {
    return api.put(`/users/${id}`, payload);
  },
  enable(id) {
    return api.post(`/users/${id}/enable`);
  },
  disable(id) {
    return api.post(`/users/${id}/disable`);
  },
  resetPassword(id, newPassword) {
    return api.post(`/users/${id}/reset-password`, { newPassword });
  },
  activity(id, params) {
    return api.get(`/users/${id}/activity`, { params });
  },
};
