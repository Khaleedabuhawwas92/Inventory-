const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { loginRules, changePasswordRules } = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const uploadAvatar = makeUploader('avatars');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'عدد محاولات دخول كبير جداً، الرجاء المحاولة لاحقاً', errors: [] },
});

router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/me', authenticate, authController.updateMe);
router.post('/me/avatar', authenticate, uploadAvatar.single('image'), authController.updateMyAvatar);
router.post('/change-password', authenticate, changePasswordRules, validate, authController.changePassword);

module.exports = router;
