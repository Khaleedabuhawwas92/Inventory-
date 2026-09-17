const express = require('express');
const controller = require('../controllers/auditLog.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);
router.get('/', permit('audit.view'), controller.list);

module.exports = router;
