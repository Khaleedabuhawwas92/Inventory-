const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const uploadCompanyLogo = makeUploader('logo');

router.get('/public', settingsController.publicInfo);
router.get('/', authenticate, permit('settings.manage'), settingsController.getSettings);
router.put('/', authenticate, permit('settings.manage'), settingsController.updateSettings);
router.post(
  '/logo',
  authenticate,
  permit('settings.manage'),
  uploadCompanyLogo.single('logo'),
  settingsController.uploadCompanyLogo
);
router.delete('/logo', authenticate, permit('settings.manage'), settingsController.deleteCompanyLogo);

module.exports = router;
