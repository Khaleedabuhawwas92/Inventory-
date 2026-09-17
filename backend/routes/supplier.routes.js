const express = require('express');
const supplierController = require('../controllers/supplier.controller');
const { supplierRules } = require('../validators/supplier.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);

router.get('/', permit('suppliers.view'), supplierController.list);
router.get('/:id', permit('suppliers.view'), supplierController.getById);
router.get('/:id/history', permit('suppliers.view'), supplierController.purchaseHistory);
router.post('/', permit('suppliers.manage'), supplierRules, validate, supplierController.create);
router.put('/:id', permit('suppliers.manage'), supplierRules, validate, supplierController.update);

module.exports = router;
