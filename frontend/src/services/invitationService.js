import api from './api';

export default {
  list(params = {}) {
    return api.get('/invitations', { params });
  },
  create(payload) {
    return api.post('/invitations', payload);
  },
  revoke(id) {
    return api.post(`/invitations/${id}/revoke`);
  },
};
