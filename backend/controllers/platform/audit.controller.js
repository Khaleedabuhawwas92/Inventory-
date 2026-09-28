const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/apiResponse');
const { getPagination, buildMeta } = require('../../utils/pagination');
const tenantContext = require('../../utils/tenantContext');
const AuditLog = require('../../models/AuditLog');
const { AUDIT_ACTIONS } = AuditLog;

// Platform-wide view of every organization's audit trail. Filterable by
// organization / user / action / entity / date range, matching the existing
// AuditLog schema exactly (action is one of models/AuditLog.js's
// AUDIT_ACTIONS; entityType is the same free-text string every controller
// already passes, e.g. 'Organization', 'User', 'Invitation', 'Product',
// 'StockAdjustment' — no new taxonomy invented).
const list = asyncHandler(async (req, res) => {
  const { organizationId, user, action, entityType, dateFrom, dateTo, search } = req.query;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 30 });

  const filter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (user) filter.user = user;
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }
  if (search) filter.description = { $regex: search, $options: 'i' };

  const { items, total } = await tenantContext.runWithoutTenant(async () => {
    const [logs, count] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationId', 'name')
        .populate('user', 'fullName username'),
      AuditLog.countDocuments(filter),
    ]);
    return { items: logs, total: count };
  });

  sendSuccess(res, { data: items, meta: { ...buildMeta({ page, limit, total }), actions: AUDIT_ACTIONS } });
});

module.exports = { list };
