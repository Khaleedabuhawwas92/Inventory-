import api from './api';

export default {
  list(params) {
    return api.get('/warehouses', { params });
  },
  get(id) {
    return api.get(`/warehouses/${id}`);
  },
  create(payload) {
    return api.post('/warehouses', payload);
  },
  update(id, payload) {
    return api.put(`/warehouses/${id}`, payload);
  },
  locations(warehouseId) {
    return api.get(`/warehouses/${warehouseId}/locations`);
  },
  createLocation(warehouseId, payload) {
    return api.post(`/warehouses/${warehouseId}/locations`, payload);
  },
  removeLocation(warehouseId, id) {
    return api.delete(`/warehouses/${warehouseId}/locations/${id}`);
  },
};
