const express = require('express');
const controller = require('../controllers/inventoryCount.controller');
const { inventoryCountRules, recordCountsRules } = require('../validators/inventoryCount.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);

router.get('/', permit('inventory.view'), controller.list);
router.get('/:id', permit('inventory.view'), controller.getById);
router.post('/', permit('inventory.create'), inventoryCountRules, validate, controller.create);
router.put('/:id/counts', permit('inventory.create'), recordCountsRules, validate, controller.recordCounts);
router.post('/:id/submit', permit('inventory.create'), controller.submitForReview);
router.post('/:id/approve', permit('inventory.approve'), controller.approve);
router.post('/:id/cancel', permit('inventory.create'), controller.cancel);

module.exports = router;
