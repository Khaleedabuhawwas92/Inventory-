import api from './api';

export default {
  movements(params) {
    return api.get('/stock/movements', { params });
  },

  listIn(params) {
    return api.get('/stock/in', { params });
  },
  getIn(id) {
    return api.get(`/stock/in/${id}`);
  },
  createIn(payload) {
    return api.post('/stock/in', payload);
  },
  approveIn(id) {
    return api.post(`/stock/in/${id}/approve`);
  },
  cancelIn(id) {
    return api.post(`/stock/in/${id}/cancel`);
  },

  listOut(params) {
    return api.get('/stock/out', { params });
  },
  getOut(id) {
    return api.get(`/stock/out/${id}`);
  },
  createOut(payload) {
    return api.post('/stock/out', payload);
  },
  approveOut(id) {
    return api.post(`/stock/out/${id}/approve`);
  },
  cancelOut(id) {
    return api.post(`/stock/out/${id}/cancel`);
  },

  listAdjustments(params) {
    return api.get('/stock/adjustments', { params });
  },
  getAdjustment(id) {
    return api.get(`/stock/adjustments/${id}`);
  },
  createAdjustment(payload) {
    return api.post('/stock/adjustments', payload);
  },
  approveAdjustment(id) {
    return api.post(`/stock/adjustments/${id}/approve`);
  },

  listTransfers(params) {
    return api.get('/stock/transfers', { params });
  },
  getTransfer(id) {
    return api.get(`/stock/transfers/${id}`);
  },
  createTransfer(payload) {
    return api.post('/stock/transfers', payload);
  },
  shipTransfer(id) {
    return api.post(`/stock/transfers/${id}/ship`);
  },
  receiveTransfer(id) {
    return api.post(`/stock/transfers/${id}/receive`);
  },
  cancelTransfer(id) {
    return api.post(`/stock/transfers/${id}/cancel`);
  },

  listReturns(params) {
    return api.get('/stock/returns', { params });
  },
  getReturn(id) {
    return api.get(`/stock/returns/${id}`);
  },
  createReturn(payload) {
    return api.post('/stock/returns', payload);
  },
  approveReturn(id) {
    return api.post(`/stock/returns/${id}/approve`);
  },
};
