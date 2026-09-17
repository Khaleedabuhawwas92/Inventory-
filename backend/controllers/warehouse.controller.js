const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Warehouse = require('../models/Warehouse');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const filter = includeInactive === 'true' ? {} : { status: 'active' };
  const warehouses = await Warehouse.find(filter).populate('manager', 'fullName').sort({ isMain: -1, name: 1 });
  sendSuccess(res, { data: warehouses });
});

const getById = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id).populate('manager', 'fullName');
  if (!warehouse) throw ApiError.notFound('المخزن غير موجود');
  sendSuccess(res, { data: warehouse });
});

const create = asyncHandler(async (req, res) => {
  const { name, code, address, manager, phone, notes } = req.body;

  const exists = await Warehouse.findOne({ code: code.toUpperCase() });
  if (exists) throw ApiError.conflict('رمز المخزن مستخدم مسبقاً');

  const warehouse = await Warehouse.create({
    name, code: code.toUpperCase(), address, manager: manager || null, phone, notes, createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'Warehouse', entityId: warehouse._id, description: `تم إنشاء المخزن ${warehouse.name}` });
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء المخزن بنجاح', data: warehouse });
});

const update = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw ApiError.notFound('المخزن غير موجود');

  const before = warehouse.toObject();
  const { name, address, manager, phone, notes, status } = req.body;
  if (name !== undefined) warehouse.name = name;
  if (address !== undefined) warehouse.address = address;
  if (manager !== undefined) warehouse.manager = manager || null;
  if (phone !== undefined) warehouse.phone = phone;
  if (notes !== undefined) warehouse.notes = notes;
  if (status !== undefined) {
    if (warehouse.isMain && status === 'inactive') {
      throw ApiError.badRequest('لا يمكن تعطيل المخزن الرئيسي');
    }
    warehouse.status = status;
  }
  await warehouse.save();

  await auditService.logAction({
    req, action: 'UPDATE', entityType: 'Warehouse', entityId: warehouse._id,
    description: `تم تعديل المخزن ${warehouse.name}`, oldValue: before, newValue: warehouse.toObject(),
  });
  sendSuccess(res, { message: 'تم تحديث المخزن بنجاح', data: warehouse });
});

module.exports = { list, getById, create, update };
