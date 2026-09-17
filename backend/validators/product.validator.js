const { body } = require('express-validator');

const productRules = [
  body('nameAr').trim().notEmpty().withMessage('الاسم بالعربية مطلوب'),
  body('category').isMongoId().withMessage('التصنيف مطلوب'),
  body('unit').isMongoId().withMessage('الوحدة مطلوبة'),
  body('purchasePrice').optional().isFloat({ min: 0 }).withMessage('سعر الشراء يجب أن يكون رقماً موجباً'),
  body('salePrice').optional().isFloat({ min: 0 }).withMessage('سعر البيع يجب أن يكون رقماً موجباً'),
  body('minStock').optional().isFloat({ min: 0 }).withMessage('الحد الأدنى يجب أن يكون رقماً موجباً'),
  body('maxStock').optional().isFloat({ min: 0 }).withMessage('الحد الأقصى يجب أن يكون رقماً موجباً'),
];

module.exports = { productRules };
