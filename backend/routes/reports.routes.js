const express = require('express');
const reportsController = require('../controllers/reports.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');
const requireFeature = require('../middleware/requireFeature');

const router = express.Router();
router.use(authenticate);
router.use(permit('reports.view'));

// Basic reports (current/low/out-of-stock) are always available — only the
// deeper analytical reports are gated behind the advancedReports flag.
router.get('/current-stock', reportsController.currentStock);
router.get('/low-stock', reportsController.lowStock);
router.get('/out-of-stock', reportsController.outOfStock);
router.get('/stock-valuation', requireFeature('advancedReports'), reportsController.stockValuation);
router.get('/dead-stock', requireFeature('advancedReports'), reportsController.deadStock);
router.get('/product-movement-ranking', requireFeature('advancedReports'), reportsController.productMovementRanking);
router.get('/inventory-differences', requireFeature('advancedReports'), reportsController.inventoryDifferences);
router.get('/supplier-purchases', requireFeature('advancedReports'), reportsController.supplierPurchases);

module.exports = router;
