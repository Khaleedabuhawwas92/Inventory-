const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { sendSuccess } = require('../../utils/apiResponse');
const { getPagination, buildMeta } = require('../../utils/pagination');
const tenantContext = require('../../utils/tenantContext');
const auditService = require('../../services/auditService');
const Organization = require('../../models/Organization');
const User = require('../../models/User');
const Warehouse = require('../../models/Warehouse');
const Product = require('../../models/Product');
const Invitation = require('../../models/Invitation');
const AuditLog = require('../../models/AuditLog');
const Settings = require('../../models/Settings');

// `ownerId` is the *current* owner and can be transferred (see updateOwner
// below); `createdBy` is the immutable historical fact of who registered the
// organization. Existing organizations (created before ownerId existed) fall
// back to createdBy here — no migration needed, and no existing
// organization's displayed owner silently changes.
function ownerIdOf(org) {
  return org.ownerId || org.createdBy;
}

async function withOrgSummary(org) {
  const ownerId = ownerIdOf(org);
  const [owner, usersCount, warehousesCount, productsCount, lastActivity] = await Promise.all([
    ownerId ? User.findById(ownerId).select('fullName username email') : null,
    User.countDocuments({ organizationId: org._id }),
    Warehouse.countDocuments({ organizationId: org._id }),
    Product.countDocuments({ organizationId: org._id }),
    AuditLog.findOne({ organizationId: org._id }).sort({ createdAt: -1 }).select('createdAt action description'),
  ]);
  return {
    _id: org._id,
    name: org.name,
    status: org.status,
    plan: org.plan,
    subscriptionStatus: org.subscriptionStatus,
    createdAt: org.createdAt,
    owner,
    usersCount,
    warehousesCount,
    productsCount,
    lastActivity: lastActivity ? { at: lastActivity.createdAt, action: lastActivity.action, description: lastActivity.description } : null,
  };
}

const list = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (status) filter.status = status;

  const { items, total } = await tenantContext.runWithoutTenant(async () => {
    const [orgs, count] = await Promise.all([
      Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Organization.countDocuments(filter),
    ]);
    const summarized = await Promise.all(orgs.map(withOrgSummary));
    return { items: summarized, total: count };
  });

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

// Intentionally lean: this backs the Overview tab's header/info card only.
// The numeric stat cards come from GET /organizations/:id/stats, and the
// warehouses/users/products/movements/invitations/audit lists each have
// their own dedicated, paginated endpoint (see organizationDetail.controller.js)
// — none of them are loaded in full here, so this response stays small and
// fast regardless of how large the organization has grown.
const getById = asyncHandler(async (req, res) => {
  const data = await tenantContext.runWithoutTenant(async () => {
    const org = await Organization.findById(req.params.id);
    if (!org) return null;

    const ownerId = ownerIdOf(org);
    const [owner, invitationsCount, lastActivityLog, settings, firstLoginLog, mainWarehouse] = await Promise.all([
      ownerId ? User.findById(ownerId).select('fullName username email status') : null,
      Invitation.countDocuments({ organizationId: org._id }),
      AuditLog.findOne({ organizationId: org._id }).sort({ createdAt: -1 }).select('createdAt'),
      Settings.findOne({ organizationId: org._id }).select('company setupCompleted'),
      AuditLog.findOne({ organizationId: org._id, action: 'LOGIN' }).sort({ createdAt: 1 }).select('createdAt'),
      Warehouse.findOne({ organizationId: org._id, isMain: true }).select('_id'),
    ]);

    return {
      organization: org,
      company: settings?.company || null,
      owner,
      invitationsCount,
      lastActivity: lastActivityLog?.createdAt || null,
      // Read-only, derived entirely from data that already exists — nothing
      // new is stored, and nothing marks itself "complete" automatically
      // (spec §12: no arbitrary onboarding-complete action exists).
      onboarding: {
        createdAt: org.createdAt,
        firstLoginAt: firstLoginLog?.createdAt || null,
        mainWarehouseCreated: !!mainWarehouse,
        companySettingsComplete: !!settings?.setupCompleted,
      },
    };
  });

  if (!data) throw ApiError.notFound('المؤسسة غير موجودة');
  sendSuccess(res, { data });
});

// Company/organization info edit — never touches organizationId (there's no
// such field on this document to begin with; the URL param identifies which
// organization, and that's the only thing that decides it). Keeps
// Organization.name and Settings.company.name in sync since both exist for
// historical reasons (Organization.name for platform-wide listings,
// Settings.company for what the tenant's own app displays/prints).
const updateInfo = asyncHandler(async (req, res) => {
  const { name, phone, email, address, taxNumber, country, logo } = req.body;

  const result = await tenantContext.runWithoutTenant(async () => {
    const org = await Organization.findById(req.params.id);
    if (!org) return null;

    const before = { organization: org.toObject() };
    if (name !== undefined && name.trim()) org.name = name.trim();
    await org.save();

    let settings = await Settings.findOne({ organizationId: org._id });
    if (!settings) settings = await Settings.create({ organizationId: org._id });
    before.company = settings.company.toObject ? settings.company.toObject() : { ...settings.company };

    if (name !== undefined && name.trim()) settings.company.name = name.trim();
    if (phone !== undefined) settings.company.phone = phone;
    if (email !== undefined) settings.company.email = email;
    if (address !== undefined) settings.company.address = address;
    if (taxNumber !== undefined) settings.company.taxNumber = taxNumber;
    if (country !== undefined) settings.company.country = country;
    if (logo !== undefined) settings.company.logo = logo;
    await settings.save();

    return { org, settings, before };
  });
  if (!result) throw ApiError.notFound('المؤسسة غير موجودة');

  await tenantContext.run(result.org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: result.org._id,
      description: '[PLATFORM] تم تعديل بيانات المؤسسة بواسطة مدير المنصة',
      oldValue: result.before,
      newValue: { organization: { name: result.org.name }, company: result.settings.company },
    })
  );

  sendSuccess(res, { message: 'تم تحديث بيانات المؤسسة بنجاح', data: { organization: result.org, company: result.settings.company } });
});

// Safe owner transfer: the new owner must already be an *active* user of
// this *same* organization — never trusted from any cross-organization
// reference, and never created on the fly.
const updateOwner = asyncHandler(async (req, res) => {
  const { newOwnerId } = req.body;
  if (!newOwnerId) throw ApiError.badRequest('يجب تحديد المستخدم الجديد');

  const result = await tenantContext.runWithoutTenant(async () => {
    const org = await Organization.findById(req.params.id);
    if (!org) return null;

    const newOwner = await User.findOne({ _id: newOwnerId, organizationId: org._id });
    if (!newOwner) throw ApiError.badRequest('المستخدم المحدد غير موجود في هذه المؤسسة');
    if (newOwner.status !== 'active') throw ApiError.badRequest('لا يمكن نقل الملكية إلى مستخدم غير نشط');

    const oldOwnerId = ownerIdOf(org);
    const oldOwner = oldOwnerId ? await User.findById(oldOwnerId).select('fullName username') : null;

    org.ownerId = newOwner._id;
    await org.save();

    return { org, oldOwner, newOwner };
  });
  if (!result) throw ApiError.notFound('المؤسسة غير موجودة');

  await tenantContext.run(result.org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: result.org._id,
      description: `[PLATFORM] تم نقل ملكية المؤسسة من "${result.oldOwner?.fullName || 'غير محدد'}" إلى "${result.newOwner.fullName}" بواسطة مدير المنصة`,
      oldValue: { ownerId: result.oldOwner?._id || null },
      newValue: { ownerId: result.newOwner._id },
    })
  );

  sendSuccess(res, {
    message: 'تم نقل ملكية المؤسسة بنجاح',
    data: { ownerId: result.newOwner._id, owner: { _id: result.newOwner._id, fullName: result.newOwner.fullName, username: result.newOwner.username } },
  });
});

// Enable/suspend/disable only — no hard delete, by design. Any non-'active'
// status blocks login for every user in the organization (see
// controllers/auth.controller.js's login) without touching a single byte of
// the organization's data. Suspending/disabling requires a reason, recorded
// alongside who did it and when.
const updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!['active', 'suspended', 'disabled', 'trial_expired'].includes(status)) {
    throw ApiError.badRequest('حالة غير صالحة');
  }
  if (status !== 'active' && !reason?.trim()) {
    throw ApiError.badRequest('يجب إدخال سبب عند تعليق أو تعطيل المؤسسة');
  }

  const org = await tenantContext.runWithoutTenant(async () => {
    const found = await Organization.findById(req.params.id);
    if (!found) return null;
    found.status = status;
    if (status === 'active') {
      found.suspensionReason = null;
      found.suspendedAt = null;
      found.suspendedBy = null;
    } else {
      found.suspensionReason = reason.trim();
      found.suspendedAt = new Date();
      found.suspendedBy = req.user._id;
    }
    await found.save();
    return found;
  });
  if (!org) throw ApiError.notFound('المؤسسة غير موجودة');

  const STATUS_LABELS = { active: 'تفعيل', suspended: 'تعليق', disabled: 'تعطيل', trial_expired: 'انتهاء الفترة التجريبية' };
  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: org._id,
      description: `[PLATFORM] تم ${STATUS_LABELS[status]} المؤسسة بواسطة مدير المنصة${reason ? ` — السبب: ${reason.trim()}` : ''}`,
    })
  );

  sendSuccess(res, {
    message: `تم ${STATUS_LABELS[status]} المؤسسة`,
    data: { _id: org._id, status: org.status, suspensionReason: org.suspensionReason, suspendedAt: org.suspendedAt },
  });
});

module.exports = { list, getById, updateInfo, updateOwner, updateStatus };
