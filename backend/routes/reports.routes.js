const express = require('express');
const reportsController = require('../controllers/reports.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);
router.use(permit('reports.view'));

router.get('/current-stock', reportsController.currentStock);
router.get('/stock-valuation', reportsController.stockValuation);
router.get('/low-stock', reportsController.lowStock);
router.get('/out-of-stock', reportsController.outOfStock);
router.get('/dead-stock', reportsController.deadStock);
router.get('/product-movement-ranking', reportsController.productMovementRanking);
router.get('/inventory-differences', reportsController.inventoryDifferences);
router.get('/supplier-purchases', reportsController.supplierPurchases);

module.exports = router;
