const { body } = require('express-validator');
const { OUTPUT_TYPES } = require('../models/StockOut');

const stockOutRules = [
  body('warehouse').isMongoId().withMessage('المخزن مطلوب'),
  body('outputType').isIn(OUTPUT_TYPES).withMessage('نوع الإخراج غير صالح'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة صنف واحد على الأقل'),
  body('items.*.product').isMongoId().withMessage('الصنف مطلوب'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('الكمية يجب أن تكون أكبر من صفر'),
];

module.exports = { stockOutRules };
