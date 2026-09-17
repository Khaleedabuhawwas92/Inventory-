import api from './api';

export default {
  currentStock(params) {
    return api.get('/reports/current-stock', { params });
  },
  stockValuation(params) {
    return api.get('/reports/stock-valuation', { params });
  },
  lowStock() {
    return api.get('/reports/low-stock');
  },
  outOfStock() {
    return api.get('/reports/out-of-stock');
  },
  deadStock(params) {
    return api.get('/reports/dead-stock', { params });
  },
  productMovementRanking(params) {
    return api.get('/reports/product-movement-ranking', { params });
  },
  inventoryDifferences(params) {
    return api.get('/reports/inventory-differences', { params });
  },
  supplierPurchases(params) {
    return api.get('/reports/supplier-purchases', { params });
  },
};
