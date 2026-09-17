const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const backupService = require('../services/backupService');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: backupService.listBackups() });
});

const create = asyncHandler(async (req, res) => {
  const meta = await backupService.runBackup({ type: 'manual', triggeredBy: req.user.fullName });
  await auditService.logAction({ req, action: 'EXPORT', entityType: 'Backup', description: `تم إنشاء نسخة احتياطية يدوية (${meta.id})` });
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء النسخة الاحتياطية بنجاح', data: meta });
});

const restore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const meta = await backupService.restoreBackup(id);
  await auditService.logAction({
    req, action: 'UPDATE', entityType: 'Backup',
    description: `تم استرجاع النسخة الاحتياطية (${id}) — تم استبدال بيانات النظام الحالية`,
  });
  sendSuccess(res, { message: 'تم استرجاع النسخة الاحتياطية بنجاح. يُنصح بتسجيل الخروج والدخول من جديد.', data: meta });
});

const remove = asyncHandler(async (req, res) => {
  backupService.deleteBackup(req.params.id);
  await auditService.logAction({ req, action: 'DELETE', entityType: 'Backup', description: `تم حذف النسخة الاحتياطية (${req.params.id})` });
  sendSuccess(res, { message: 'تم حذف النسخة الاحتياطية' });
});

module.exports = { list, create, restore, remove };
