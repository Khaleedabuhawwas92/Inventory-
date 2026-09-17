import api from './api';

export default {
  login(identifier, password) {
    return api.post('/auth/login', { identifier, password });
  },
  logout() {
    return api.post('/auth/logout');
  },
  me() {
    return api.get('/auth/me');
  },
  refresh() {
    return api.post('/auth/refresh');
  },
  changePassword(currentPassword, newPassword) {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  },
  updateMe(payload) {
    return api.put('/auth/me', payload);
  },
  uploadAvatar(file) {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/auth/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  setupStatus() {
    return api.get('/setup/status');
  },
  runSetup(payload) {
    return api.post('/setup', payload);
  },
};
