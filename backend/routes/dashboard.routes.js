const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);
router.use(permit('dashboard.view'));

router.get('/summary', dashboardController.summary);
router.get('/recent-movements', dashboardController.recentMovements);
router.get('/low-stock', dashboardController.lowStockProducts);
router.get('/out-of-stock', dashboardController.outOfStockProducts);
router.get('/product-activity', dashboardController.productActivity);
router.get('/movement-trend', dashboardController.movementTrend);
router.get('/value-by-warehouse', dashboardController.valueByWarehouse);

module.exports = router;
