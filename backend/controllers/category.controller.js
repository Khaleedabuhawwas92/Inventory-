const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Category = require('../models/Category');
const Product = require('../models/Product');
const auditService = require('../services/auditService');

// Returned as a flat list with `parent` populated; the frontend builds the tree
// (main category / sub category per spec §11) since nesting depth is small.
const list = asyncHandler(async (req, res) => {
  const categories = await Category.find().populate('parent', 'nameAr').sort({ nameAr: 1 });
  sendSuccess(res, { data: categories });
});

const getById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).populate('parent', 'nameAr');
  if (!category) throw ApiError.notFound('التصنيف غير موجود');
  sendSuccess(res, { data: category });
});

const create = asyncHandler(async (req, res) => {
  const { nameAr, nameEn, code, parent, description } = req.body;
  const category = await Category.create({ nameAr, nameEn, code: code || undefined, parent: parent || null, description });

  await auditService.logAction({
    req, action: 'CREATE', entityType: 'Category', entityId: category._id,
    description: `تم إنشاء التصنيف ${category.nameAr}`,
  });

  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء التصنيف بنجاح', data: category });
});

const update = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('التصنيف غير موجود');

  if (req.body.parent && req.body.parent === category._id.toString()) {
    throw ApiError.badRequest('لا يمكن أن يكون التصنيف أباً لنفسه');
  }

  const before = category.toObject();
  const { nameAr, nameEn, code, parent, description, active } = req.body;
  if (nameAr !== undefined) category.nameAr = nameAr;
  if (nameEn !== undefined) category.nameEn = nameEn;
  if (code !== undefined) category.code = code || undefined;
  if (parent !== undefined) category.parent = parent || null;
  if (description !== undefined) category.description = description;
  if (active !== undefined) category.active = active;
  await category.save();

  await auditService.logAction({
    req, action: 'UPDATE', entityType: 'Category', entityId: category._id,
    description: `تم تعديل التصنيف ${category.nameAr}`, oldValue: before, newValue: category.toObject(),
  });

  sendSuccess(res, { message: 'تم تحديث التصنيف بنجاح', data: category });
});

const remove = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('التصنيف غير موجود');

  const [childCount, productCount] = await Promise.all([
    Category.countDocuments({ parent: category._id }),
    Product.countDocuments({ category: category._id }),
  ]);
  if (childCount > 0) throw ApiError.conflict('لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية');
  if (productCount > 0) throw ApiError.conflict('لا يمكن حذف تصنيف مرتبط بأصناف حالياً');

  await category.deleteOne();

  await auditService.logAction({
    req, action: 'DELETE', entityType: 'Category', entityId: category._id,
    description: `تم حذف التصنيف ${category.nameAr}`,
  });

  sendSuccess(res, { message: 'تم حذف التصنيف بنجاح' });
});

module.exports = { list, getById, create, update, remove };
