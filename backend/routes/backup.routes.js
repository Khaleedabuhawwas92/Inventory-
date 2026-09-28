const express = require('express');
const controller = require('../controllers/backup.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');
const requirePlatformAdmin = require('../middleware/requirePlatformAdmin');

const router = express.Router();
router.use(authenticate);

// Backups dump/restore the *entire* database — every organization's data at
// once, via the raw MongoDB driver (see services/backupService.js) — so in a
// multi-tenant system this can only ever be a platform-level action, never an
// individual organization's. requirePlatformAdmin gates all four actions,
// not just restore, so an ordinary organization admin (who holds
// 'settings.manage' for their own org) cannot trigger a whole-database dump
// or see backup metadata for organizations other than their own.
router.get('/', permit('settings.manage'), requirePlatformAdmin, controller.list);
router.post('/', permit('settings.manage'), requirePlatformAdmin, controller.create);
router.post('/:id/restore', permit('settings.manage'), requirePlatformAdmin, controller.restore);
router.delete('/:id', permit('settings.manage'), requirePlatformAdmin, controller.remove);

module.exports = router;
