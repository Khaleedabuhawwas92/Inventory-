import api from './api';

export default {
  list(params) {
    return api.get('/products', { params });
  },
  get(id) {
    return api.get(`/products/${id}`);
  },
  create(payload) {
    return api.post('/products', payload);
  },
  update(id, payload) {
    return api.put(`/products/${id}`, payload);
  },
  uploadImage(id, file) {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`/products/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  findByBarcode(barcode) {
    return api.get(`/products/barcode/${barcode}`);
  },
  stockByWarehouse(id) {
    return api.get(`/products/${id}/stock`);
  },
  movements(id, params) {
    return api.get(`/products/${id}/movements`, { params });
  },
};
