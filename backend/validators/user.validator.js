const { body } = require('express-validator');

const createUserRules = [
  body('fullName').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
  body('username').trim().isLength({ min: 3 }).withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  body('email').trim().isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  body('role').notEmpty().withMessage('الدور مطلوب'),
];

const updateUserRules = [
  body('fullName').optional().trim().notEmpty().withMessage('الاسم الكامل لا يمكن أن يكون فارغاً'),
  body('email').optional().trim().isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('role').optional().notEmpty().withMessage('الدور لا يمكن أن يكون فارغاً'),
];

const resetPasswordRules = [
  body('newPassword').isLength({ min: 8 }).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'),
];

module.exports = { createUserRules, updateUserRules, resetPasswordRules };
