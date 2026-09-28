const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const User = require('../models/User');
const Role = require('../models/Role');
const Warehouse = require('../models/Warehouse');
const AuditLog = require('../models/AuditLog');
const tokenService = require('../services/tokenService');
const auditService = require('../services/auditService');
const { assertUnderLimit } = require('../services/limitsService');

// User is not auto-scoped by tenantPlugin (see models/User.js — usernames/
// emails must stay resolvable globally for login), so every query here
// filters by organizationId explicitly, always from the authenticated
// request's own user, never from anything the client sends.
const list = asyncHandler(async (req, res) => {
  const { search, role, status, warehouse } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { organizationId: req.user.organizationId };
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (warehouse) filter.warehouse = warehouse;

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate('role', 'name nameAr')
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, organizationId: req.user.organizationId })
    .populate('role')
    .populate('warehouse', 'name code');
  if (!user) throw ApiError.notFound('المستخدم غير موجود');
  sendSuccess(res, { data: user.toSafeJSON() });
});

const create = asyncHandler(async (req, res) => {
  const { fullName, username, email, phone, password, role, warehouse, status } = req.body;

  await assertUnderLimit(req.user.organizationId, 'users');

  // Identifiers are globally unique (see models/User.js), so this dup check
  // is intentionally cross-organization.
  const exists = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
  if (exists) throw ApiError.conflict('اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً');

  // Role is scoped manually (see models/Role.js) — without this check a
  // client could assign a role _id belonging to a different organization.
  const roleDoc = await Role.findOne({ _id: role, organizationId: req.user.organizationId });
  if (!roleDoc) throw ApiError.badRequest('الدور المحدد غير موجود في هذه المؤسسة');

  if (warehouse) {
    const warehouseDoc = await Warehouse.findById(warehouse);
    if (!warehouseDoc) throw ApiError.badRequest('المخزن المحدد غير موجود في هذه المؤسسة');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    organizationId: req.user.organizationId,
    fullName,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    phone,
    passwordHash,
    role,
    warehouse: warehouse || null,
    status: status || 'active',
    createdBy: req.user._id,
  });

  await auditService.logAction({
    req,
    action: 'CREATE',
    entityType: 'User',
    entityId: user._id,
    description: `تم إنشاء المستخدم ${user.username}`,
  });

  const populated = await user.populate('role');
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء المستخدم بنجاح', data: populated.toSafeJSON() });
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
  if (!user) throw ApiError.notFound('المستخدم غير موجود');

  const before = user.toSafeJSON();
  const { fullName, email, phone, role, warehouse, status } = req.body;

  if (email && email.toLowerCase() !== user.email) {
    const emailTaken = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (emailTaken) throw ApiError.conflict('البريد الإلكتروني مستخدم مسبقاً');
    user.email = email.toLowerCase();
  }
  if (fullName !== undefined) user.fullName = fullName;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) {
    const roleDoc = await Role.findOne({ _id: role, organizationId: req.user.organizationId });
    if (!roleDoc) throw ApiError.badRequest('الدور المحدد غير موجود في هذه المؤسسة');
    user.role = role;
  }
  if (warehouse !== undefined) {
    if (warehouse) {
      const warehouseDoc = await Warehouse.findById(warehouse);
      if (!warehouseDoc) throw ApiError.badRequest('المخزن المحدد غير موجود في هذه المؤسسة');
    }
    user.warehouse = warehouse || null;
  }
  if (status !== undefined) user.status = status;

  await user.save();

  await auditService.logAction({
    req,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user._id,
    description: `تم تعديل بيانات المستخدم ${user.username}`,
    oldValue: before,
    newValue: user.toSafeJSON(),
  });

  const populated = await user.populate('role');
  sendSuccess(res, { message: 'تم تحديث بيانات المستخدم', data: populated.toSafeJSON() });
});

const setStatus = (targetStatus) =>
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!user) throw ApiError.notFound('المستخدم غير موجود');

    if (req.user._id.equals(user._id) && targetStatus === 'disabled') {
      throw ApiError.badRequest('لا يمكنك تعطيل حسابك الخاص');
    }

    user.status = targetStatus;
    await user.save();

    if (targetStatus === 'disabled') {
      await tokenService.revokeAllForUser(user._id);
    }

    await auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      description: targetStatus === 'active' ? `تم تفعيل المستخدم ${user.username}` : `تم تعطيل المستخدم ${user.username}`,
    });

    sendSuccess(res, { message: targetStatus === 'active' ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم' });
  });

const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
  if (!user) throw ApiError.notFound('المستخدم غير موجود');

  const { newPassword } = req.body;
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = true;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  await tokenService.revokeAllForUser(user._id);

  await auditService.logAction({
    req,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: user._id,
    description: `تم إعادة تعيين كلمة مرور المستخدم ${user.username} بواسطة المدير`,
  });

  sendSuccess(res, { message: 'تم إعادة تعيين كلمة المرور بنجاح' });
});

const activity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 30 });
  const filter = { user: req.params.id };

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

module.exports = {
  list,
  getById,
  create,
  update,
  enable: setStatus('active'),
  disable: setStatus('disabled'),
  resetPassword,
  activity,
};
