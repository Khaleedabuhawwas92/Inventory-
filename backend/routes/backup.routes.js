const express = require('express');
const controller = require('../controllers/backup.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');

const router = express.Router();
router.use(authenticate);

router.get('/', permit('settings.manage'), controller.list);
router.post('/', permit('settings.manage'), controller.create);
router.post('/:id/restore', permit('settings.manage'), requireSuperAdmin, controller.restore);
router.delete('/:id', permit('settings.manage'), requireSuperAdmin, controller.remove);

module.exports = router;
