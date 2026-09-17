const { body } = require('express-validator');
const { PERMISSIONS } = require('../constants/permissions');

const roleRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('اسم الدور (بالإنجليزية) مطلوب')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('اسم الدور يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط'),
  body('nameAr').trim().notEmpty().withMessage('اسم الدور بالعربية مطلوب'),
  body('permissions').isArray().withMessage('الصلاحيات يجب أن تكون قائمة'),
  body('permissions.*').isIn(PERMISSIONS).withMessage('صلاحية غير معروفة'),
];

module.exports = { roleRules };
