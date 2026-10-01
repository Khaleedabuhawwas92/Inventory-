const express = require('express');
const controller = require('../controllers/orgBackup.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');
const requireFeature = require('../middleware/requireFeature');

// Ordinary, tenant-scoped backups — any organization's own admin can back up
// and restore their OWN organization's data, gated by the same 'settings.manage'
// permission as the rest of the Settings page and by the organization's own
// 'backups' feature flag (models/Organization.js). Distinct from
// routes/backup.routes.js, which dumps/restores the *entire* database across
// every organization and is Platform-Admin-only — never confuse the two.
const router = express.Router();
router.use(authenticate);
router.use(permit('settings.manage'), requireFeature('backups'));

router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/restore', controller.restore);
router.delete('/:id', controller.remove);

module.exports = router;
