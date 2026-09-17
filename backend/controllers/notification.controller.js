const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const Notification = require('../models/Notification');

function visibilityFilter(req) {
  const isSuperAdmin = req.user.role?.name === 'super-admin';
  const permissions = req.permissions || [];
  if (isSuperAdmin) return {};
  return { $or: [{ user: req.user._id }, { permission: { $in: permissions } }] };
}

const list = asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });

  const filter = visibilityFilter(req);
  if (unreadOnly === 'true') filter.readBy = { $ne: req.user._id };

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...visibilityFilter(req), readBy: { $ne: req.user._id } }),
  ]);

  const withReadFlag = items.map((n) => ({ ...n.toObject(), isRead: n.readBy.some((id) => id.equals(req.user._id)) }));

  sendSuccess(res, { data: withReadFlag, meta: { ...buildMeta({ page, limit, total }), unreadCount } });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw ApiError.notFound('الإشعار غير موجود');

  if (!notification.readBy.some((id) => id.equals(req.user._id))) {
    notification.readBy.push(req.user._id);
    await notification.save();
  }
  sendSuccess(res, { message: 'تم وضع علامة مقروء' });
});

const markAllRead = asyncHandler(async (req, res) => {
  const filter = { ...visibilityFilter(req), readBy: { $ne: req.user._id } };
  await Notification.updateMany(filter, { $addToSet: { readBy: req.user._id } });
  sendSuccess(res, { message: 'تم وضع علامة مقروء على جميع الإشعارات' });
});

module.exports = { list, markRead, markAllRead };
