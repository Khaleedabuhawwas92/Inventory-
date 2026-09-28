const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Unit = require('../models/Unit');
const Settings = require('../models/Settings');
const Invitation = require('../models/Invitation');
const Role = require('../models/Role');
const { ensureDefaultRoles } = require('../services/roleService');
const auditService = require('../services/auditService');
const withTransaction = require('../utils/withTransaction');
const tenantContext = require('../utils/tenantContext');
const tokenService = require('../services/tokenService');
const { DEFAULT_UNITS } = require('../constants/defaultUnits');
const { REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS } = require('./auth.controller');

async function issueSessionFor(user, res, req) {
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

// Replaces the old one-time, system-wide Setup Wizard: instead of a single
// gate that ran once for the entire deployment, any visitor can register a
// brand new, fully independent organization at any time. The registering
// user becomes that organization's own 'admin' — never 'super-admin', which
// is reserved for the pre-existing installation this system was migrated
// from (see migrations/001_multi_tenant_backfill.js) and is never seeded for
// new organizations, so there is nothing named 'super-admin' for a new
// organization's admin to ever collide with or escalate into.
const registerCompany = asyncHandler(async (req, res) => {
  const { organizationName, admin, warehouse, currency, units } = req.body;

  const existingUser = await User.findOne({
    $or: [{ username: admin.username.toLowerCase() }, { email: admin.email.toLowerCase() }],
  });
  if (existingUser) throw ApiError.conflict('اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً');

  const result = await withTransaction(async (session) => {
    const [organization] = await Organization.create([{ name: organizationName }], { session });

    return tenantContext.run(organization._id, async () => {
      const roles = await ensureDefaultRoles(organization._id, [
        'admin', 'warehouse-manager', 'employee', 'viewer',
      ]);

      const [wh] = await Warehouse.create(
        [{ name: warehouse.name, code: warehouse.code.toUpperCase(), address: warehouse.address || '', isMain: true }],
        { session }
      );

      const passwordHash = await bcrypt.hash(admin.password, 12);
      const [owner] = await User.create(
        [{
          organizationId: organization._id,
          fullName: admin.fullName,
          username: admin.username.toLowerCase(),
          email: admin.email.toLowerCase(),
          phone: admin.phone || '',
          passwordHash,
          role: roles.admin._id,
          warehouse: wh._id,
          status: 'active',
        }],
        { session }
      );

      organization.createdBy = owner._id;
      await organization.save({ session });

      const unitDocs = (units && units.length ? units : DEFAULT_UNITS).map((u) => ({ ...u, active: true }));
      await Unit.insertMany(unitDocs, { session });

      await Settings.create(
        [{
          company: { name: organizationName },
          system: { currency: currency || 'JOD' },
          inventory: { defaultWarehouse: wh._id },
          setupCompleted: true,
        }],
        { session }
      );

      return { organization, owner, warehouse: wh };
    });
  });

  // Callbacks passed to tenantContext.run must *await* every query inside
  // their own body (not just return an un-awaited Query/thenable) — a
  // Mongoose Query is lazy and only actually executes .then()/exec() is
  // called, and if that happens outside this synchronous callback (e.g. at
  // an `await` written at the call site instead), it runs with no tenant
  // context at all. See utils/tenantPlugin.js.
  const populatedOwner = await tenantContext.run(result.organization._id, async () => {
    await auditService.logAction({
      req,
      user: result.owner,
      action: 'CREATE',
      entityType: 'Organization',
      entityId: result.organization._id,
      description: `تم تسجيل مؤسسة جديدة: ${result.organization.name}`,
    });
    return await result.owner.populate(['role', 'warehouse']);
  });
  const accessToken = await issueSessionFor(populatedOwner, res, req);

  sendSuccess(res, {
    statusCode: 201,
    message: 'تم تسجيل المؤسسة بنجاح',
    data: { user: populatedOwner.toSafeJSON(), accessToken },
  });
});

async function findUsableInvitation(code) {
  const invitation = await tenantContext.runWithoutTenant(async () => Invitation.findOne({ code }));
  if (!invitation || !invitation.isUsable()) return null;
  return invitation;
}

// Public: lets the frontend show "You're about to join <organization> as
// <role>" before asking for a password, without exposing anything else.
const invitationInfo = asyncHandler(async (req, res) => {
  const invitation = await findUsableInvitation(req.params.code);
  if (!invitation) throw ApiError.notFound('رابط الدعوة غير صالح أو منتهي الصلاحية');

  const [organization, role] = await tenantContext.runWithoutTenant(async () => Promise.all([
    Organization.findById(invitation.organizationId).select('name status'),
    Role.findById(invitation.role).select('nameAr'),
  ]));
  if (!organization || organization.status !== 'active') {
    throw ApiError.notFound('رابط الدعوة غير صالح أو منتهي الصلاحية');
  }

  sendSuccess(res, {
    data: {
      organizationName: organization.name,
      roleName: role?.nameAr || '',
      email: invitation.email || null,
    },
  });
});

const joinByInvitation = asyncHandler(async (req, res) => {
  const { code, fullName, username, email, password, phone } = req.body;

  const invitation = await findUsableInvitation(code);
  if (!invitation) throw ApiError.notFound('رابط الدعوة غير صالح أو منتهي الصلاحية');

  if (invitation.email && invitation.email !== email.toLowerCase()) {
    throw ApiError.badRequest('هذه الدعوة مخصصة لبريد إلكتروني مختلف');
  }

  const existingUser = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
  });
  if (existingUser) throw ApiError.conflict('اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً');

  const result = await tenantContext.run(invitation.organizationId, async () => {
    const organization = await Organization.findById(invitation.organizationId);
    if (!organization || organization.status !== 'active') {
      throw ApiError.forbidden('تم تعليق هذه المؤسسة، الرجاء التواصل مع الدعم');
    }

    return withTransaction(async (session) => {
      const passwordHash = await bcrypt.hash(password, 12);
      const [user] = await User.create(
        [{
          organizationId: invitation.organizationId,
          fullName,
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          phone: phone || '',
          passwordHash,
          role: invitation.role,
          warehouse: invitation.warehouse || null,
          status: 'active',
        }],
        { session }
      );

      invitation.usedAt = new Date();
      invitation.usedBy = user._id;
      invitation.active = false;
      await invitation.save({ session });

      return user;
    });
  });

  await tenantContext.run(invitation.organizationId, async () => {
    await auditService.logAction({
      req,
      user: result,
      action: 'CREATE',
      entityType: 'User',
      entityId: result._id,
      description: `انضم مستخدم جديد عبر دعوة: ${result.username}`,
    });
    // Distinct from the CREATE/User entry above: this one is against the
    // Invitation itself (its own audit trail entity), so a platform admin
    // reviewing invitations specifically can see "this code was consumed"
    // without cross-referencing user-creation events.
    await auditService.logAction({
      req,
      user: result,
      action: 'UPDATE',
      entityType: 'Invitation',
      entityId: invitation._id,
      description: `تم استخدام دعوة الانضمام بواسطة ${result.username}`,
    });
    await result.populate(['role', 'warehouse']);
  });

  const accessToken = await issueSessionFor(result, res, req);

  sendSuccess(res, {
    statusCode: 201,
    message: 'تم الانضمام بنجاح',
    data: { user: result.toSafeJSON(), accessToken },
  });
});

module.exports = { registerCompany, invitationInfo, joinByInvitation };
