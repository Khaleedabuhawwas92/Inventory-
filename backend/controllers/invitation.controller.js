const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const Invitation = require('../models/Invitation');
const Role = require('../models/Role');
const auditService = require('../services/auditService');
const ms = require('../utils/ms');

function generateCode() {
  return crypto.randomBytes(24).toString('base64url');
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });

  // Invitation is tenant-scoped (utils/tenantPlugin.js), so this is already
  // isolated to req.user's own organization without any explicit filter.
  const [items, total] = await Promise.all([
    Invitation.find({})
      .populate('role', 'name nameAr')
      .populate('warehouse', 'name code')
      .populate('createdBy', 'fullName')
      .populate('usedBy', 'fullName username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invitation.countDocuments({}),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const create = asyncHandler(async (req, res) => {
  const { role, warehouse, email, expiresInDays } = req.body;

  // Role is scoped manually (not via tenantPlugin — see models/Role.js), so
  // this explicit organizationId check is what actually prevents inviting
  // someone into this organization with another organization's role.
  const roleDoc = await Role.findOne({ _id: role, organizationId: req.user.organizationId });
  if (!roleDoc) throw ApiError.badRequest('الدور المحدد غير موجود في هذه المؤسسة');

  const invitation = await Invitation.create({
    code: generateCode(),
    email: email ? email.toLowerCase() : null,
    role,
    warehouse: warehouse || null,
    expiresAt: new Date(Date.now() + ms(`${expiresInDays || 7}d`)),
    createdBy: req.user._id,
  });

  await auditService.logAction({
    req,
    action: 'CREATE',
    entityType: 'Invitation',
    entityId: invitation._id,
    description: `تم إنشاء دعوة انضمام (${roleDoc.nameAr})`,
  });

  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء رابط الدعوة بنجاح', data: invitation });
});

const revoke = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findById(req.params.id);
  if (!invitation) throw ApiError.notFound('الدعوة غير موجودة');

  invitation.active = false;
  invitation.revokedAt = new Date();
  await invitation.save();

  await auditService.logAction({
    req,
    action: 'UPDATE',
    entityType: 'Invitation',
    entityId: invitation._id,
    description: 'تم إلغاء رابط الدعوة',
  });

  sendSuccess(res, { message: 'تم إلغاء الدعوة بنجاح' });
});

module.exports = { list, create, revoke };
