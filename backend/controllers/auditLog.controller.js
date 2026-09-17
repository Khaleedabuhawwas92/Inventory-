const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const AuditLog = require('../models/AuditLog');

const list = asyncHandler(async (req, res) => {
  const { user, action, entityType, from, to } = req.query;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 30 });

  const filter = {};
  if (user) filter.user = user;
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('user', 'fullName username').sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

module.exports = { list };
