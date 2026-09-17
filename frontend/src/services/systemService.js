import api from './api';

export default {
  checkHealth() {
    return api.get('/health', { timeout: 8000 });
  },
};
