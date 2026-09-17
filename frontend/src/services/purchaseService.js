import api from './api';

export default {
  listOrders(params) {
    return api.get('/purchases/orders', { params });
  },
  getOrder(id) {
    return api.get(`/purchases/orders/${id}`);
  },
  createOrder(payload) {
    return api.post('/purchases/orders', payload);
  },
  approveOrder(id) {
    return api.post(`/purchases/orders/${id}/approve`);
  },
  cancelOrder(id) {
    return api.post(`/purchases/orders/${id}/cancel`);
  },
  openLines(poId) {
    return api.get(`/purchases/orders/${poId}/open-lines`);
  },

  listReceipts(params) {
    return api.get('/purchases/receipts', { params });
  },
  getReceipt(id) {
    return api.get(`/purchases/receipts/${id}`);
  },
  createReceipt(payload) {
    return api.post('/purchases/receipts', payload);
  },
  approveReceipt(id) {
    return api.post(`/purchases/receipts/${id}/approve`);
  },
};
