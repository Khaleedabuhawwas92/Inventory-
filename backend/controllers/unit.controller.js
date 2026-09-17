const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Unit = require('../models/Unit');
const Product = require('../models/Product');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const units = await Unit.find().sort({ nameAr: 1 });
  sendSuccess(res, { data: units });
});

const create = asyncHandler(async (req, res) => {
  const { nameAr, nameEn, shortCode } = req.body;
  const exists = await Unit.findOne({ shortCode: shortCode.toUpperCase() });
  if (exists) throw ApiError.conflict('رمز الوحدة مستخدم مسبقاً');

  const unit = await Unit.create({ nameAr, nameEn, shortCode: shortCode.toUpperCase() });
  await auditService.logAction({ req, action: 'CREATE', entityType: 'Unit', entityId: unit._id, description: `تم إنشاء الوحدة ${unit.nameAr}` });
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء الوحدة بنجاح', data: unit });
});

const update = asyncHandler(async (req, res) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) throw ApiError.notFound('الوحدة غير موجودة');

  const { nameAr, nameEn, shortCode, active } = req.body;
  if (shortCode && shortCode.toUpperCase() !== unit.shortCode) {
    const exists = await Unit.findOne({ shortCode: shortCode.toUpperCase(), _id: { $ne: unit._id } });
    if (exists) throw ApiError.conflict('رمز الوحدة مستخدم مسبقاً');
    unit.shortCode = shortCode.toUpperCase();
  }
  if (nameAr !== undefined) unit.nameAr = nameAr;
  if (nameEn !== undefined) unit.nameEn = nameEn;
  if (active !== undefined) unit.active = active;
  await unit.save();

  await auditService.logAction({ req, action: 'UPDATE', entityType: 'Unit', entityId: unit._id, description: `تم تعديل الوحدة ${unit.nameAr}` });
  sendSuccess(res, { message: 'تم تحديث الوحدة بنجاح', data: unit });
});

const remove = asyncHandler(async (req, res) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) throw ApiError.notFound('الوحدة غير موجودة');

  const productCount = await Product.countDocuments({ unit: unit._id });
  if (productCount > 0) throw ApiError.conflict('لا يمكن حذف وحدة مرتبطة بأصناف حالياً');

  await unit.deleteOne();
  await auditService.logAction({ req, action: 'DELETE', entityType: 'Unit', entityId: unit._id, description: `تم حذف الوحدة ${unit.nameAr}` });
  sendSuccess(res, { message: 'تم حذف الوحدة بنجاح' });
});

module.exports = { list, create, update, remove };
