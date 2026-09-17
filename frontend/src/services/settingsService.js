import api from './api';

export default {
  publicInfo() {
    return api.get('/settings/public');
  },
  get() {
    return api.get('/settings');
  },
  update(payload) {
    return api.put('/settings', payload);
  },
  uploadLogo(file) {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/settings/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteLogo() {
    return api.delete('/settings/logo');
  },
};
