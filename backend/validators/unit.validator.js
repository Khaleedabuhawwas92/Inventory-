const { body } = require('express-validator');

const unitRules = [
  body('nameAr').trim().notEmpty().withMessage('اسم الوحدة بالعربية مطلوب'),
  body('shortCode').trim().notEmpty().withMessage('رمز الوحدة مطلوب'),
];

module.exports = { unitRules };
