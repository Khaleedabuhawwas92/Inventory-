const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { sendSuccess } = require('../../utils/apiResponse');
const { getPagination, buildMeta } = require('../../utils/pagination');
const tenantContext = require('../../utils/tenantContext');
const auditService = require('../../services/auditService');
const tokenService = require('../../services/tokenService');
const User = require('../../models/User');
const Role = require('../../models/Role');
const RefreshToken = require('../../models/RefreshToken');
const AuditLog = require('../../models/AuditLog');

// Every user list/detail response here goes through `.toSafeJSON()` or an
// explicit `.select(...)`, never `.select('+passwordHash')` — passwordHash
// stays excluded by the schema's own `select: false` default either way.
// Session history below deliberately never returns RefreshToken.tokenHash.
const list = asyncHandler(async (req, res) => {
  const { search, organizationId, roleName, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const { items, total } = await tenantContext.runWithoutTenant(async () => {
    if (roleName) {
      const matchingRoles = await Role.find({ name: roleName }).select('_id');
      filter.role = { $in: matchingRoles.map((r) => r._id) };
    }

    const [users, count] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .populate('organizationId', 'name status')
        .populate('role', 'name nameAr')
        .populate('warehouse', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);
    return { items: users, total: count };
  });

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const data = await tenantContext.runWithoutTenant(async () => {
    const user = await User.findById(req.params.id)
      .select('-passwordHash')
      .populate('organizationId', 'name status')
      .populate('role', 'name nameAr permissions')
      .populate('warehouse', 'name code');
    if (!user) return null;

    const [recentActivity, sessions] = await Promise.all([
      AuditLog.find({ user: user._id }).sort({ createdAt: -1 }).limit(30),
      // Login/activity history exactly as currently stored (services/tokenService.js) —
      // metadata only (ip, device, timestamps, revoked state), never the token itself.
      RefreshToken.find({ user: user._id })
        .select('-tokenHash -replacedByHash')
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    return { user, recentActivity, sessions };
  });

  if (!data) throw ApiError.notFound('المستخدم غير موجود');
  sendSuccess(res, { data });
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'disabled'].includes(status)) {
    throw ApiError.badRequest('حالة غير صالحة (active أو disabled فقط)');
  }

  const user = await tenantContext.runWithoutTenant(async () => {
    const found = await User.findById(req.params.id);
    if (!found) return null;
    found.status = status;
    if (status === 'disabled') {
      found.lockedUntil = null;
      found.failedLoginAttempts = 0;
    }
    await found.save();
    return found;
  });
  if (!user) throw ApiError.notFound('المستخدم غير موجود');

  if (status === 'disabled') {
    await tokenService.revokeAllForUser(user._id);
  }

  await tenantContext.run(user.organizationId, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      description: `[PLATFORM] تم ${status === 'active' ? 'تفعيل' : 'تعطيل'} المستخدم ${user.username} بواسطة مدير المنصة`,
    })
  );

  sendSuccess(res, {
    message: status === 'active' ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم',
    data: { _id: user._id, status: user.status },
  });
});

// Generates a brand-new random password server-side and hands it back once —
// this *sets* a new credential, exactly like the existing organization-admin
// reset-password action (controllers/user.controller.js), it never reveals
// the user's actual current password (which isn't recoverable — only its
// bcrypt hash is stored, and that's never returned by any endpoint).
const resetPassword = asyncHandler(async (req, res) => {
  const temporaryPassword = crypto.randomBytes(9).toString('base64url');

  const user = await tenantContext.runWithoutTenant(async () => {
    const found = await User.findById(req.params.id);
    if (!found) return null;
    found.passwordHash = await bcrypt.hash(temporaryPassword, 12);
    found.mustChangePassword = true;
    found.failedLoginAttempts = 0;
    found.lockedUntil = null;
    await found.save();
    return found;
  });
  if (!user) throw ApiError.notFound('المستخدم غير موجود');

  await tokenService.revokeAllForUser(user._id);

  await tenantContext.run(user.organizationId, () =>
    auditService.logAction({
      req,
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: user._id,
      description: `[PLATFORM] تم إعادة تعيين كلمة مرور المستخدم ${user.username} بواسطة مدير المنصة`,
    })
  );

  sendSuccess(res, {
    message: 'تم إعادة تعيين كلمة المرور، شارك كلمة المرور المؤقتة مع المستخدم عبر قناة آمنة',
    data: { temporaryPassword },
  });
});

module.exports = { list, getById, updateStatus, resetPassword };
