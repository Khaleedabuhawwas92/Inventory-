const { body } = require('express-validator');

const inventoryCountRules = [
  body('warehouse').isMongoId().withMessage('المخزن مطلوب'),
  body('categoryFilter').optional({ nullable: true }).isMongoId().withMessage('التصنيف غير صالح'),
];

const recordCountsRules = [
  body('items').isArray({ min: 1 }).withMessage('يجب إرسال كميات معدودة'),
  body('items.*.product').isMongoId().withMessage('الصنف مطلوب'),
  body('items.*.physicalQty').isFloat({ min: 0 }).withMessage('الكمية الفعلية يجب أن تكون رقماً موجباً'),
];

module.exports = { inventoryCountRules, recordCountsRules };
