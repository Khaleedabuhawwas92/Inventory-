const { body } = require('express-validator');

const stockTransferRules = [
  body('fromWarehouse').isMongoId().withMessage('المخزن المصدر مطلوب'),
  body('toWarehouse').isMongoId().withMessage('المخزن الوجهة مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة صنف واحد على الأقل'),
  body('items.*.product').isMongoId().withMessage('الصنف مطلوب'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('الكمية يجب أن تكون أكبر من صفر'),
];

module.exports = { stockTransferRules };
