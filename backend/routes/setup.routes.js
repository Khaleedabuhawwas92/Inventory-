const express = require('express');
const setupController = require('../controllers/setup.controller');
const { setupRules } = require('../validators/setup.validator');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/status', setupController.status);
router.post('/', setupRules, validate, setupController.runSetup);

module.exports = router;
