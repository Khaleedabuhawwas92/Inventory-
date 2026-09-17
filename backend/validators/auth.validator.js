const { body } = require('express-validator');

const loginRules = [
  body('identifier').trim().notEmpty().withMessage('اسم المستخدم أو البريد الإلكتروني مطلوب'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  body('newPassword').isLength({ min: 8 }).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'),
];

module.exports = { loginRules, changePasswordRules };
