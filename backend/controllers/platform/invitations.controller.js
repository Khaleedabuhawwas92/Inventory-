const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/apiResponse');
const { getPagination, buildMeta } = require('../../utils/pagination');
const tenantContext = require('../../utils/tenantContext');
const Invitation = require('../../models/Invitation');

function maskCode(code) {
  if (!code || code.length <= 8) return '••••••••';
  return `${code.slice(0, 4)}${'•'.repeat(Math.max(4, code.length - 8))}${code.slice(-4)}`;
}

function statusOf(inv) {
  if (inv.usedAt) return 'used';
  if (inv.revokedAt || !inv.active) return 'revoked';
  if (new Date(inv.expiresAt) < new Date()) return 'expired';
  return 'active';
}

// Organization admins keep using GET /api/invitations (unchanged, still
// tenant-scoped to their own organization only — see routes/invitation.routes.js).
// This is a separate, platform-wide read: every organization's invitations at
// once, with the raw code masked (a valid, unused invitation code is
// equivalent to a signup credential for that organization).
const STATUS_FILTERS = {
  used: { usedAt: { $ne: null } },
  revoked: { usedAt: null, $or: [{ revokedAt: { $ne: null } }, { active: false }] },
  expired: { usedAt: null, revokedAt: null, active: true, expiresAt: { $lte: new Date() } },
  active: { usedAt: null, revokedAt: null, active: true, expiresAt: { $gt: new Date() } },
};

const list = asyncHandler(async (req, res) => {
  const { organizationId, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (status && STATUS_FILTERS[status]) Object.assign(filter, STATUS_FILTERS[status]);

  const { items, total } = await tenantContext.runWithoutTenant(async () => {
    const [invitations, count] = await Promise.all([
      Invitation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationId', 'name')
        .populate('role', 'name nameAr')
        .populate('createdBy', 'fullName username')
        .populate('usedBy', 'fullName username'),
      Invitation.countDocuments(filter),
    ]);
    return { items: invitations, total: count };
  });

  const shaped = items.map((inv) => ({
    _id: inv._id,
    organization: inv.organizationId,
    codeMasked: maskCode(inv.code),
    email: inv.email,
    role: inv.role,
    warehouse: inv.warehouse,
    createdBy: inv.createdBy,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    usedAt: inv.usedAt,
    usedBy: inv.usedBy,
    revokedAt: inv.revokedAt,
    status: statusOf(inv),
  }));

  sendSuccess(res, { data: shaped, meta: buildMeta({ page, limit, total }) });
});

module.exports = { list };
