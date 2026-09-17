const express = require('express');
const purchaseOrderController = require('../controllers/purchaseOrder.controller');
const goodsReceiptController = require('../controllers/goodsReceipt.controller');
const { purchaseOrderRules } = require('../validators/purchaseOrder.validator');
const { goodsReceiptRules } = require('../validators/goodsReceipt.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);

router.get('/orders', permit('purchases.view'), purchaseOrderController.list);
router.get('/orders/:id', permit('purchases.view'), purchaseOrderController.getById);
router.post('/orders', permit('purchases.create'), purchaseOrderRules, validate, purchaseOrderController.create);
router.post('/orders/:id/approve', permit('purchases.approve'), purchaseOrderController.approve);
router.post('/orders/:id/cancel', permit('purchases.create'), purchaseOrderController.cancel);

router.get('/receipts', permit('purchases.view'), goodsReceiptController.list);
router.get('/receipts/:id', permit('purchases.view'), goodsReceiptController.getById);
router.get('/orders/:poId/open-lines', permit('purchases.view'), goodsReceiptController.fromPurchaseOrder);
router.post('/receipts', permit('purchases.create'), goodsReceiptRules, validate, goodsReceiptController.create);
router.post('/receipts/:id/approve', permit('purchases.create'), goodsReceiptController.approve);

module.exports = router;
