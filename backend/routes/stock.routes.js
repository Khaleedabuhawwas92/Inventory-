const express = require('express');
const stockInController = require('../controllers/stockIn.controller');
const stockOutController = require('../controllers/stockOut.controller');
const stockAdjustmentController = require('../controllers/stockAdjustment.controller');
const stockMovementController = require('../controllers/stockMovement.controller');
const stockTransferController = require('../controllers/stockTransfer.controller');
const stockReturnController = require('../controllers/stockReturn.controller');
const { stockInRules } = require('../validators/stockIn.validator');
const { stockOutRules } = require('../validators/stockOut.validator');
const { stockAdjustmentRules } = require('../validators/stockAdjustment.validator');
const { stockTransferRules } = require('../validators/stockTransfer.validator');
const { stockReturnRules } = require('../validators/stockReturn.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);

router.get('/movements', permit('stock.view'), stockMovementController.list);

router.get('/in', permit('stock.in'), stockInController.list);
router.get('/in/:id', permit('stock.in'), stockInController.getById);
router.post('/in', permit('stock.in'), stockInRules, validate, stockInController.create);
router.post('/in/:id/approve', permit('stock.in'), stockInController.approve);
router.post('/in/:id/cancel', permit('stock.in'), stockInController.cancel);

router.get('/out', permit('stock.out'), stockOutController.list);
router.get('/out/:id', permit('stock.out'), stockOutController.getById);
router.post('/out', permit('stock.out'), stockOutRules, validate, stockOutController.create);
router.post('/out/:id/approve', permit('stock.out'), stockOutController.approve);
router.post('/out/:id/cancel', permit('stock.out'), stockOutController.cancel);

router.get('/adjustments', permit('stock.adjust'), stockAdjustmentController.list);
router.get('/adjustments/:id', permit('stock.adjust'), stockAdjustmentController.getById);
router.post('/adjustments', permit('stock.adjust'), stockAdjustmentRules, validate, stockAdjustmentController.create);
router.post('/adjustments/:id/approve', permit('stock.adjust'), stockAdjustmentController.approve);

router.get('/transfers', permit('stock.transfer'), stockTransferController.list);
router.get('/transfers/:id', permit('stock.transfer'), stockTransferController.getById);
router.post('/transfers', permit('stock.transfer'), stockTransferRules, validate, stockTransferController.create);
router.post('/transfers/:id/ship', permit('stock.transfer'), stockTransferController.ship);
router.post('/transfers/:id/receive', permit('stock.transfer'), stockTransferController.receive);
router.post('/transfers/:id/cancel', permit('stock.transfer'), stockTransferController.cancel);

router.get('/returns', permit('stock.view'), stockReturnController.list);
router.get('/returns/:id', permit('stock.view'), stockReturnController.getById);
// Required permission depends on direction (TO_SUPPLIER behaves like an OUT,
// FROM_CUSTOMER like an IN), so it's checked inside the controller instead
// of a single fixed permission here.
router.post('/returns', stockReturnRules, validate, stockReturnController.create);
router.post('/returns/:id/approve', stockReturnController.approve);

module.exports = router;
