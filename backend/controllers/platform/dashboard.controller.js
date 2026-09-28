const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/apiResponse');
const tenantContext = require('../../utils/tenantContext');
const Organization = require('../../models/Organization');
const User = require('../../models/User');
const Warehouse = require('../../models/Warehouse');
const Product = require('../../models/Product');
const Invitation = require('../../models/Invitation');
const AuditLog = require('../../models/AuditLog');

// Every read here deliberately spans every organization — this is the one
// place in the system that's supposed to (see middleware/requirePlatformAdmin.js
// and the tenant isolation this intentionally sits above). All reads run
// inside tenantContext.runWithoutTenant so utils/tenantPlugin.js's
// query-scoping doesn't require (and can't derive) a single organization.
const dashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const data = await tenantContext.runWithoutTenant(async () => {
    const [
      totalOrganizations,
      activeOrganizations,
      disabledOrganizations,
      totalUsers,
      activeUsers,
      usersToday,
      organizationsThisMonth,
      totalWarehouses,
      totalProducts,
      openInvitations,
      recentOrganizations,
      recentUsers,
      recentActivity,
      failedLogins24h,
      failedLogins7d,
    ] = await Promise.all([
      Organization.countDocuments({}),
      Organization.countDocuments({ status: 'active' }),
      Organization.countDocuments({ status: 'suspended' }),
      User.countDocuments({}),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      Organization.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Warehouse.countDocuments({}),
      Product.countDocuments({}),
      Invitation.countDocuments({ active: true, usedAt: null, revokedAt: null, expiresAt: { $gt: now } }),
      Organization.find({}).sort({ createdAt: -1 }).limit(8).select('name status createdAt'),
      User.find({}).sort({ createdAt: -1 }).limit(8).select('fullName username email organizationId createdAt').populate('organizationId', 'name'),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(15).populate('organizationId', 'name'),
      AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: last24h } }),
      AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: last7d } }),
    ]);

    return {
      totals: {
        organizations: totalOrganizations,
        activeOrganizations,
        disabledOrganizations,
        users: totalUsers,
        activeUsers,
        usersRegisteredToday: usersToday,
        organizationsRegisteredThisMonth: organizationsThisMonth,
        warehouses: totalWarehouses,
        products: totalProducts,
        openInvitations,
      },
      recentOrganizations,
      recentUsers,
      recentActivity,
      failedLoginSummary: {
        last24h: failedLogins24h,
        last7d: failedLogins7d,
      },
    };
  });

  sendSuccess(res, { data });
});

module.exports = { dashboard };
