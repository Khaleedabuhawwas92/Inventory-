const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'LOW_STOCK', 'OUT_OF_STOCK',
  'TRANSFER_PENDING_RECEIPT',
  'APPROVAL_PENDING',
  'INVENTORY_COUNT_PENDING',
  'STOCK_ADJUSTMENT',
  'SYSTEM',
];

const notificationSchema = new mongoose.Schema(
  {
    // Null user = broadcast to every user who holds `permission` (e.g. a
    // low-stock alert goes to everyone who can view stock, not one person).
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    permission: { type: String, default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    entityType: { type: String, default: null },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    route: { type: String, default: null },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
