const express = require('express');
const { sendSuccess } = require('../utils/apiResponse');

const router = express.Router();

router.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  sendSuccess(res, {
    message: 'الخادم يعمل بشكل طبيعي',
    data: {
      status: 'ok',
      dbConnected: mongoose.connection.readyState === 1,
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/setup', require('./setup.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/roles', require('./role.routes'));
router.use('/settings', require('./settings.routes'));
router.use('/warehouses', require('./warehouse.routes'));
router.use('/categories', require('./category.routes'));
router.use('/units', require('./unit.routes'));
router.use('/products', require('./product.routes'));
router.use('/stock', require('./stock.routes'));
router.use('/suppliers', require('./supplier.routes'));
router.use('/inventory-counts', require('./inventoryCount.routes'));
router.use('/purchases', require('./purchase.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/search', require('./search.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/audit-logs', require('./auditLog.routes'));
router.use('/backups', require('./backup.routes'));

// Feature routes are mounted here as later phases are implemented.

module.exports = router;
