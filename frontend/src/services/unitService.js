import api from './api';

export default {
  list() {
    return api.get('/units');
  },
  create(payload) {
    return api.post('/units', payload);
  },
  update(id, payload) {
    return api.put(`/units/${id}`, payload);
  },
  remove(id) {
    return api.delete(`/units/${id}`);
  },
};
