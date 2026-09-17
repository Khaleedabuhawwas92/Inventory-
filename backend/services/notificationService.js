const Notification = require('../models/Notification');

// Broadcast notifications (permission-scoped) are deduped: we don't want a
// fresh LOW_STOCK row on every single movement while a product stays below
// its threshold. Skip creating a new one if an unread one for the same
// entity+type already exists.
async function notifyOnce({ type, entityType, entityId, ...rest }) {
  const existing = await Notification.findOne({
    type,
    entityType,
    entityId,
    readBy: { $size: 0 },
  });
  if (existing) return existing;
  return Notification.create({ type, entityType, entityId, ...rest });
}

async function notify({ user = null, permission = null, type, title, message = '', entityType = null, entityId = null, route = null }) {
  return Notification.create({ user, permission, type, title, message, entityType, entityId, route });
}

// Called from the central inventory service right after a movement is
// recorded, so stock-level alerts are never missed regardless of which
// screen (Stock IN/OUT, transfer, adjustment, count...) triggered the change.
async function checkStockThresholds({ product, warehouse, quantity, minStock, productName }) {
  if (quantity <= 0) {
    await notifyOnce({
      type: 'OUT_OF_STOCK',
      entityType: 'Product',
      entityId: product,
      permission: 'stock.view',
      title: `نفد مخزون الصنف: ${productName}`,
      message: 'الكمية المتوفرة الآن صفر أو أقل.',
      route: `/products/${product}`,
    });
  } else if (minStock > 0 && quantity <= minStock) {
    await notifyOnce({
      type: 'LOW_STOCK',
      entityType: 'Product',
      entityId: product,
      permission: 'stock.view',
      title: `مخزون منخفض: ${productName}`,
      message: `الكمية الحالية (${quantity}) وصلت للحد الأدنى (${minStock}) أو أقل.`,
      route: `/products/${product}`,
    });
  }
}

module.exports = { notify, notifyOnce, checkStockThresholds };
