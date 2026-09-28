const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/apiResponse');
const tenantContext = require('../../utils/tenantContext');
const AuditLog = require('../../models/AuditLog');
const User = require('../../models/User');

const SUSPICIOUS_THRESHOLD = 3;

// Everything here is read directly from data the system already records
// (AuditLog's existing LOGIN_FAILED/PASSWORD_RESET actions, User.status) —
// nothing new is invented; the only *new* thing this feature relies on is
// the "[PLATFORM] " description marker that controllers/platform/*.js's own
// mutations write, so this page can show "platform admin actions" as a
// distinct category from an organization's own admins acting inside their
// own org (see organizations.controller.js / users.controller.js).
const security = asyncHandler(async (req, res) => {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const data = await tenantContext.runWithoutTenant(async () => {
    const [
      failedLogins24h,
      failedLogins7d,
      recentFailedLogins,
      disabledUsersCount,
      disabledUsers,
      repeatedFailures,
      recentPasswordResets,
      recentPlatformActions,
    ] = await Promise.all([
      AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: last24h } }),
      AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: last7d } }),
      AuditLog.find({ action: 'LOGIN_FAILED' })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('organizationId', 'name')
        .populate('user', 'fullName username'),
      User.countDocuments({ status: 'disabled' }),
      User.find({ status: 'disabled' }).sort({ updatedAt: -1 }).limit(20).select('fullName username organizationId updatedAt').populate('organizationId', 'name'),
      AuditLog.aggregate([
        { $match: { action: 'LOGIN_FAILED', createdAt: { $gte: last24h }, user: { $ne: null } } },
        { $group: { _id: '$user', count: { $sum: 1 }, lastAttemptAt: { $max: '$createdAt' } } },
        { $match: { count: { $gte: SUSPICIOUS_THRESHOLD } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { count: 1, lastAttemptAt: 1, 'user._id': 1, 'user.fullName': 1, 'user.username': 1, 'user.organizationId': 1 } },
      ]),
      AuditLog.find({ action: 'PASSWORD_RESET' })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('organizationId', 'name')
        .populate('user', 'fullName username'),
      AuditLog.find({ description: { $regex: '^\\[PLATFORM\\]' } })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate('organizationId', 'name'),
    ]);

    return {
      failedLoginSummary: { last24h: failedLogins24h, last7d: failedLogins7d, recent: recentFailedLogins },
      disabledUsers: { count: disabledUsersCount, recent: disabledUsers },
      suspiciousRepeatedFailures: repeatedFailures,
      recentPasswordResets,
      recentPlatformAdminActions: recentPlatformActions,
    };
  });

  sendSuccess(res, { data });
});

module.exports = { security };
