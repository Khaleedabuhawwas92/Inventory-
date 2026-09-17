import api from './api';

export default {
  list(params) {
    return api.get('/suppliers', { params });
  },
  get(id) {
    return api.get(`/suppliers/${id}`);
  },
  history(id) {
    return api.get(`/suppliers/${id}/history`);
  },
  create(payload) {
    return api.post('/suppliers', payload);
  },
  update(id, payload) {
    return api.put(`/suppliers/${id}`, payload);
  },
};
