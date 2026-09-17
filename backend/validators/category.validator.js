const { body } = require('express-validator');

const categoryRules = [
  body('nameAr').trim().notEmpty().withMessage('اسم التصنيف بالعربية مطلوب'),
  body('nameEn').optional().trim(),
  body('parent').optional({ nullable: true }).isMongoId().withMessage('التصنيف الأب غير صالح'),
];

module.exports = { categoryRules };
