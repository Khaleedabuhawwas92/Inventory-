const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Role = require('../models/Role');
const User = require('../models/User');
const auditService = require('../services/auditService');
const { PERMISSIONS } = require('../constants/permissions');

const list = asyncHandler(async (req, res) => {
  const roles = await Role.find().sort({ createdAt: 1 });
  sendSuccess(res, { data: roles });
});

const permissionsCatalog = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: PERMISSIONS });
});

const getById = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw ApiError.notFound('الدور غير موجود');
  sendSuccess(res, { data: role });
});

const create = asyncHandler(async (req, res) => {
  const { name, nameAr, description, permissions } = req.body;

  const exists = await Role.findOne({ name });
  if (exists) throw ApiError.conflict('اسم الدور مستخدم مسبقاً');

  const role = await Role.create({ name, nameAr, description, permissions });

  await auditService.logAction({
    req,
    action: 'CREATE',
    entityType: 'Role',
    entityId: role._id,
    description: `تم إنشاء الدور ${role.nameAr}`,
  });

  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء الدور بنجاح', data: role });
});

const update = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw ApiError.notFound('الدور غير موجود');
  if (role.isSystem && req.body.name && req.body.name !== role.name) {
    throw ApiError.badRequest('لا يمكن تغيير اسم دور نظامي');
  }

  const before = role.toObject();
  const { nameAr, description, permissions, active } = req.body;

  if (nameAr !== undefined) role.nameAr = nameAr;
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) role.permissions = permissions;
  if (active !== undefined) role.active = active;

  await role.save();

  await auditService.logAction({
    req,
    action: 'PERMISSION_CHANGE',
    entityType: 'Role',
    entityId: role._id,
    description: `تم تعديل صلاحيات الدور ${role.nameAr}`,
    oldValue: { permissions: before.permissions },
    newValue: { permissions: role.permissions },
  });

  sendSuccess(res, { message: 'تم تحديث الدور بنجاح', data: role });
});

const remove = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw ApiError.notFound('الدور غير موجود');
  if (role.isSystem) throw ApiError.badRequest('لا يمكن حذف دور نظامي');

  const usersWithRole = await User.countDocuments({ role: role._id });
  if (usersWithRole > 0) throw ApiError.conflict('لا يمكن حذف دور مرتبط بمستخدمين حالياً');

  await role.deleteOne();

  await auditService.logAction({
    req,
    action: 'DELETE',
    entityType: 'Role',
    entityId: role._id,
    description: `تم حذف الدور ${role.nameAr}`,
  });

  sendSuccess(res, { message: 'تم حذف الدور بنجاح' });
});

module.exports = { list, permissionsCatalog, getById, create, update, remove };
