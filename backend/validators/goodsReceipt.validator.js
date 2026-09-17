const { body } = require('express-validator');

const goodsReceiptRules = [
  body('supplier').isMongoId().withMessage('المورد مطلوب'),
  body('warehouse').isMongoId().withMessage('المخزن مطلوب'),
  body('purchaseOrder').optional({ nullable: true }).isMongoId().withMessage('طلب الشراء غير صالح'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة صنف واحد على الأقل'),
  body('items.*.product').isMongoId().withMessage('الصنف مطلوب'),
  body('items.*.receivingQty').isFloat({ gt: 0 }).withMessage('الكمية المستلمة يجب أن تكون أكبر من صفر'),
];

module.exports = { goodsReceiptRules };
