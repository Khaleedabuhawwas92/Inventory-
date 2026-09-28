const { body } = require('express-validator');

const registerCompanyRules = [
  body('organizationName').trim().notEmpty().withMessage('اسم المؤسسة مطلوب'),
  body('admin.fullName').trim().notEmpty().withMessage('اسم المدير مطلوب'),
  body('admin.username').trim().isLength({ min: 3 }).withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  body('admin.email').trim().isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('admin.password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  body('warehouse.name').trim().notEmpty().withMessage('اسم المخزن الرئيسي مطلوب'),
  body('warehouse.code').trim().notEmpty().withMessage('رمز المخزن مطلوب'),
  body('currency').optional().trim(),
  body('units').optional().isArray(),
];

const joinByInvitationRules = [
  body('code').trim().notEmpty().withMessage('رمز الدعوة مطلوب'),
  body('fullName').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
  body('username').trim().isLength({ min: 3 }).withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  body('email').trim().isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
];

module.exports = { registerCompanyRules, joinByInvitationRules };
