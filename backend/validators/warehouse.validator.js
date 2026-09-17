const { body } = require('express-validator');

const warehouseRules = [
  body('name').trim().notEmpty().withMessage('اسم المخزن مطلوب'),
  body('code').trim().notEmpty().withMessage('رمز المخزن مطلوب'),
];

module.exports = { warehouseRules };
