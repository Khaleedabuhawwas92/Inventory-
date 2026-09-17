const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const WarehouseLocation = require('../models/WarehouseLocation');
const auditService = require('../services/auditService');

function buildCode({ zone, aisle, rack, shelf }) {
  // e.g. A-03-R05-S02
  const parts = [];
  if (zone) parts.push(zone.toUpperCase());
  if (aisle) parts.push(String(aisle).padStart(2, '0'));
  if (rack) parts.push(`R${String(rack).padStart(2, '0')}`);
  if (shelf) parts.push(`S${String(shelf).padStart(2, '0')}`);
  return parts.join('-');
}

const list = asyncHandler(async (req, res) => {
  const locations = await WarehouseLocation.find({ warehouse: req.params.warehouseId }).sort({ code: 1 });
  sendSuccess(res, { data: locations });
});

const create = asyncHandler(async (req, res) => {
  const { zone, aisle, rack, shelf } = req.body;
  const code = req.body.code?.trim().toUpperCase() || buildCode({ zone, aisle, rack, shelf });
  if (!code) throw ApiError.badRequest('لا يمكن تحديد رمز الموقع، الرجاء إدخال المنطقة على الأقل');

  const exists = await WarehouseLocation.findOne({ warehouse: req.params.warehouseId, code });
  if (exists) throw ApiError.conflict('رمز الموقع مستخدم مسبقاً في هذا المخزن');

  const location = await WarehouseLocation.create({
    warehouse: req.params.warehouseId, zone, aisle, rack, shelf, code,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'WarehouseLocation', entityId: location._id, description: `تم إنشاء الموقع ${location.code}` });
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء الموقع بنجاح', data: location });
});

const update = asyncHandler(async (req, res) => {
  const location = await WarehouseLocation.findOne({ _id: req.params.id, warehouse: req.params.warehouseId });
  if (!location) throw ApiError.notFound('الموقع غير موجود');

  const { active } = req.body;
  if (active !== undefined) location.active = active;
  await location.save();

  sendSuccess(res, { message: 'تم تحديث الموقع بنجاح', data: location });
});

const remove = asyncHandler(async (req, res) => {
  const location = await WarehouseLocation.findOne({ _id: req.params.id, warehouse: req.params.warehouseId });
  if (!location) throw ApiError.notFound('الموقع غير موجود');

  await location.deleteOne();
  await auditService.logAction({ req, action: 'DELETE', entityType: 'WarehouseLocation', entityId: location._id, description: `تم حذف الموقع ${location.code}` });
  sendSuccess(res, { message: 'تم حذف الموقع بنجاح' });
});

module.exports = { list, create, update, remove };
