const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const onboardingController = require('../controllers/onboarding.controller');
const { loginRules, changePasswordRules } = require('../validators/auth.validator');
const { registerCompanyRules, joinByInvitationRules } = require('../validators/onboarding.validator');
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

// Registration/join create new accounts and organizations — rate-limited
// separately from login so an abuse attempt against one can't lock out the
// other, but still capped to slow down automated account creation.
const onboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'عدد محاولات كبير جداً، الرجاء المحاولة لاحقاً', errors: [] },
});

router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/me', authenticate, authController.updateMe);
router.post('/me/avatar', authenticate, uploadAvatar.single('image'), authController.updateMyAvatar);
router.post('/change-password', authenticate, changePasswordRules, validate, authController.changePassword);

// Organization onboarding (replaces the old system-wide /api/setup wizard —
// each organization now onboards itself, independently, at any time).
router.post('/register', onboardingLimiter, registerCompanyRules, validate, onboardingController.registerCompany);
router.get('/invitations/:code', onboardingController.invitationInfo);
router.post('/join', onboardingLimiter, joinByInvitationRules, validate, onboardingController.joinByInvitation);

module.exports = router;
