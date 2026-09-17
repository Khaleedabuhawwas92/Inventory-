const { body } = require('express-validator');

const purchaseOrderRules = [
  body('supplier').isMongoId().withMessage('المورد مطلوب'),
  body('warehouse').isMongoId().withMessage('المخزن مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة صنف واحد على الأقل'),
  body('items.*.product').isMongoId().withMessage('الصنف مطلوب'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('الكمية يجب أن تكون أكبر من صفر'),
  body('items.*.unitCost').optional().isFloat({ min: 0 }).withMessage('تكلفة الوحدة يجب أن تكون رقماً موجباً'),
];

module.exports = { purchaseOrderRules };
