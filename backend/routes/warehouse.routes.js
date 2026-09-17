const express = require('express');
const warehouseController = require('../controllers/warehouse.controller');
const locationController = require('../controllers/warehouseLocation.controller');
const { warehouseRules } = require('../validators/warehouse.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);

router.get('/', permit('warehouses.view'), warehouseController.list);
router.get('/:id', permit('warehouses.view'), warehouseController.getById);
router.post('/', permit('warehouses.create'), warehouseRules, validate, warehouseController.create);
router.put('/:id', permit('warehouses.edit'), warehouseController.update);

router.get('/:warehouseId/locations', permit('warehouses.view'), locationController.list);
router.post('/:warehouseId/locations', permit('warehouses.edit'), locationController.create);
router.put('/:warehouseId/locations/:id', permit('warehouses.edit'), locationController.update);
router.delete('/:warehouseId/locations/:id', permit('warehouses.edit'), locationController.remove);

module.exports = router;
