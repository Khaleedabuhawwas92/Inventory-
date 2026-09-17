const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Settings = require('../models/Settings');
const auditService = require('../services/auditService');
const { publicUrlFor, deleteUploadedFile } = require('../middleware/upload');

async function getSingleton() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
}

// ✅ بيانات المؤسسة العامة فقط لرأس صفحات الطباعة — بدون أي إعدادات حساسة
// (inventory/documents/backup/setupCompleted... إلخ تبقى خلف /settings المحمي)
const publicInfo = asyncHandler(async (req, res) => {
  const settings = await getSingleton();
  sendSuccess(res, {
    data: {
      company: {
        name: settings.company.name,
        logo: settings.company.logo,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        taxNumber: settings.company.taxNumber,
      },
      system: { currency: settings.system.currency, language: settings.system.language },
    },
  });
});

const getSettings = asyncHandler(async (req, res) => {
  const settings = await getSingleton();
  sendSuccess(res, { data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getSingleton();
  const before = settings.toObject();

  const allowedSections = ['company', 'system', 'inventory', 'documents', 'barcode', 'backup'];
  for (const section of allowedSections) {
    if (req.body[section]) {
      settings[section] = { ...settings[section].toObject?.() ?? settings[section], ...req.body[section] };
    }
  }
  await settings.save();

  await auditService.logAction({
    req,
    action: 'UPDATE',
    entityType: 'Settings',
    entityId: settings._id,
    description: 'تم تحديث إعدادات النظام',
    oldValue: before,
    newValue: settings.toObject(),
  });

  sendSuccess(res, { message: 'تم تحديث الإعدادات بنجاح', data: settings });
});

const uploadCompanyLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('لم يتم إرفاق شعار');

  const settings = await getSingleton();
  const oldLogo = settings.company.logo;

  settings.company.logo = publicUrlFor('logo', req.file.filename);
  await settings.save();

  if (oldLogo) deleteUploadedFile(oldLogo);

  await auditService.logAction({
    req,
    action: 'UPDATE',
    entityType: 'Settings',
    entityId: settings._id,
    description: 'تم رفع/استبدال شعار المؤسسة',
  });

  sendSuccess(res, { message: 'تم رفع شعار المؤسسة بنجاح', data: { logo: settings.company.logo } });
});

const deleteCompanyLogo = asyncHandler(async (req, res) => {
  const settings = await getSingleton();
  const oldLogo = settings.company.logo;

  settings.company.logo = null;
  await settings.save();

  if (oldLogo) deleteUploadedFile(oldLogo);

  await auditService.logAction({
    req,
    action: 'UPDATE',
    entityType: 'Settings',
    entityId: settings._id,
    description: 'تم حذف شعار المؤسسة',
  });

  sendSuccess(res, { message: 'تم حذف شعار المؤسسة بنجاح', data: { logo: null } });
});

module.exports = { publicInfo, getSettings, updateSettings, uploadCompanyLogo, deleteCompanyLogo };
