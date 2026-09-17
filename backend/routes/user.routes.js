const express = require('express');
const userController = require('../controllers/user.controller');
const { createUserRules, updateUserRules, resetPasswordRules } = require('../validators/user.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();

router.use(authenticate);

router.get('/', permit('users.view'), userController.list);
router.get('/:id', permit('users.view'), userController.getById);
router.get('/:id/activity', permit('users.view'), userController.activity);
router.post('/', permit('users.manage'), createUserRules, validate, userController.create);
router.put('/:id', permit('users.manage'), updateUserRules, validate, userController.update);
router.post('/:id/enable', permit('users.manage'), userController.enable);
router.post('/:id/disable', permit('users.manage'), userController.disable);
router.post('/:id/reset-password', permit('users.manage'), resetPasswordRules, validate, userController.resetPassword);

module.exports = router;
