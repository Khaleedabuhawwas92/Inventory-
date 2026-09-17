const { body } = require('express-validator');
const { ADJUSTMENT_REASONS } = require('../models/StockAdjustment');

const stockAdjustmentRules = [
  body('warehouse').isMongoId().withMessage('المخزن مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة صنف واحد على الأقل'),
  body('items.*.product').isMongoId().withMessage('الصنف مطلوب'),
  body('items.*.newQty').isFloat({ min: 0 }).withMessage('الكمية الجديدة يجب أن تكون رقماً موجباً'),
  body('items.*.reason').isIn(ADJUSTMENT_REASONS).withMessage('السبب غير صالح'),
];

module.exports = { stockAdjustmentRules };
