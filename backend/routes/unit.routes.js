const express = require('express');
const unitController = require('../controllers/unit.controller');
const { unitRules } = require('../validators/unit.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);

router.get('/', permit('units.manage'), unitController.list);
router.post('/', permit('units.manage'), unitRules, validate, unitController.create);
router.put('/:id', permit('units.manage'), unitController.update);
router.delete('/:id', permit('units.manage'), unitController.remove);

module.exports = router;
