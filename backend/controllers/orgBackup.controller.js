const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const orgBackupService = require('../services/organizationBackupService');
const auditService = require('../services/auditService');

// Every handler scopes strictly to req.user.organizationId — the
// authenticated session's own organization (middleware/auth.js), never
// anything from the request itself — see services/organizationBackupService.js
// for the full isolation story.

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: orgBackupService.listBackups(req.user.organizationId) });
});

const create = asyncHandler(async (req, res) => {
  const meta = await orgBackupService.runBackup(req.user.organizationId, { type: 'manual', triggeredBy: req.user.fullName });
  await auditService.logAction({ req, action: 'EXPORT', entityType: 'Backup', description: `تم إنشاء نسخة احتياطية للمؤسسة (${meta.id})` });
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء النسخة الاحتياطية بنجاح', data: meta });
});

const restore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const meta = await orgBackupService.restoreBackup(req.user.organizationId, id);
  await auditService.logAction({
    req, action: 'UPDATE', entityType: 'Backup',
    description: `تم استرجاع النسخة الاحتياطية (${id}) — تم استبدال بيانات المؤسسة الحالية`,
  });
  sendSuccess(res, { message: 'تم استرجاع النسخة الاحتياطية بنجاح. يُنصح بتسجيل الخروج والدخول من جديد.', data: meta });
});

const remove = asyncHandler(async (req, res) => {
  orgBackupService.deleteBackup(req.user.organizationId, req.params.id);
  await auditService.logAction({ req, action: 'DELETE', entityType: 'Backup', description: `تم حذف النسخة الاحتياطية (${req.params.id})` });
  sendSuccess(res, { message: 'تم حذف النسخة الاحتياطية' });
});

module.exports = { list, create, restore, remove };
