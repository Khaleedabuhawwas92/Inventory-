const { body } = require('express-validator');

const supplierRules = [
  body('name').trim().notEmpty().withMessage('اسم المورد مطلوب'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('البريد الإلكتروني غير صالح'),
];

module.exports = { supplierRules };
