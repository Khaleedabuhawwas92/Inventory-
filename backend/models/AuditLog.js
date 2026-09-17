const mongoose = require('mongoose');

const AUDIT_ACTIONS = [
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
  'CREATE', 'UPDATE', 'DELETE',
  'APPROVE', 'CANCEL', 'REVERSAL',
  'PRINT', 'EXPORT',
  'PASSWORD_RESET', 'PERMISSION_CHANGE',
];

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userDisplay: { type: String, default: '' }, // snapshot in case the user is later deleted
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    entityType: { type: String, default: null, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    description: { type: String, default: '' },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
