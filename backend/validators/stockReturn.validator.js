const { body } = require('express-validator');
const { RETURN_TYPES } = require('../models/StockReturn');

const stockReturnRules = [
  body('type').isIn(RETURN_TYPES).withMessage('نوع المرتجع غير صالح'),
  body('warehouse').isMongoId().withMessage('المخزن مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة صنف واحد على الأقل'),
  body('items.*.product').isMongoId().withMessage('الصنف مطلوب'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('الكمية يجب أن تكون أكبر من صفر'),
];

module.exports = { stockReturnRules };
