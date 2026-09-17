import api from './api';

export default {
  list(params) {
    return api.get('/inventory-counts', { params });
  },
  get(id) {
    return api.get(`/inventory-counts/${id}`);
  },
  create(payload) {
    return api.post('/inventory-counts', payload);
  },
  recordCounts(id, items) {
    return api.put(`/inventory-counts/${id}/counts`, { items });
  },
  submit(id) {
    return api.post(`/inventory-counts/${id}/submit`);
  },
  approve(id) {
    return api.post(`/inventory-counts/${id}/approve`);
  },
  cancel(id) {
    return api.post(`/inventory-counts/${id}/cancel`);
  },
};
