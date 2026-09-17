const AuditLog = require('../models/AuditLog');

async function logAction({
  req = null,
  user = null,
  action,
  entityType = null,
  entityId = null,
  description = '',
  oldValue = null,
  newValue = null,
}) {
  try {
    const actingUser = user || req?.user || null;
    await AuditLog.create({
      user: actingUser?._id || actingUser?.id || null,
      userDisplay: actingUser?.fullName || actingUser?.username || 'system',
      action,
      entityType,
      entityId,
      description,
      oldValue,
      newValue,
      ip: req?.ip || '',
      userAgent: req?.headers?.['user-agent'] || '',
    });
  } catch (err) {
    // Audit logging must never break the primary request flow.
    console.error('[AuditService] Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
