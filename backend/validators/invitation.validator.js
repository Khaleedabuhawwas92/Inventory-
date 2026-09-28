const { body } = require('express-validator');

const createInvitationRules = [
  body('role').notEmpty().withMessage('الدور مطلوب'),
  body('warehouse').optional({ nullable: true }),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('expiresInDays').optional().isInt({ min: 1, max: 90 }).withMessage('مدة الصلاحية يجب أن تكون بين 1 و90 يوماً'),
];

module.exports = { createInvitationRules };
