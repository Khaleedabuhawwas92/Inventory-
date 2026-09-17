import api from './api';

export default {
  summary() {
    return api.get('/dashboard/summary');
  },
  recentMovements(params) {
    return api.get('/dashboard/recent-movements', { params });
  },
  lowStock() {
    return api.get('/dashboard/low-stock');
  },
  outOfStock() {
    return api.get('/dashboard/out-of-stock');
  },
  productActivity() {
    return api.get('/dashboard/product-activity');
  },
  movementTrend() {
    return api.get('/dashboard/movement-trend');
  },
  valueByWarehouse() {
    return api.get('/dashboard/value-by-warehouse');
  },
};
