const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Unit = require('../models/Unit');
const { ensureDefaultRoles } = require('../services/roleService');
const auditService = require('../services/auditService');
const withTransaction = require('../utils/withTransaction');
const { DEFAULT_UNITS } = require('../constants/defaultUnits');

const status = asyncHandler(async (req, res) => {
  const settings = await Settings.findOne();
  const userCount = await User.countDocuments();
  sendSuccess(res, {
    data: {
      setupCompleted: !!settings?.setupCompleted || userCount > 0,
    },
  });
});

const runSetup = asyncHandler(async (req, res) => {
  const existingSettings = await Settings.findOne();
  const userCount = await User.countDocuments();
  if (existingSettings?.setupCompleted || userCount > 0) {
    throw ApiError.conflict('تم إعداد النظام مسبقاً');
  }

  const { company, admin, warehouse, currency, units } = req.body;

  const result = await withTransaction(async (session) => {
      const roles = await ensureDefaultRoles();

      const wh = await Warehouse.create(
        [
          {
            name: warehouse.name,
            code: warehouse.code.toUpperCase(),
            address: warehouse.address || '',
            isMain: true,
          },
        ],
        { session }
      ).then((docs) => docs[0]);

      const passwordHash = await bcrypt.hash(admin.password, 12);
      const superAdmin = await User.create(
        [
          {
            fullName: admin.fullName,
            username: admin.username.toLowerCase(),
            email: admin.email.toLowerCase(),
            phone: admin.phone || '',
            passwordHash,
            role: roles['super-admin']._id,
            warehouse: wh._id,
            status: 'active',
          },
        ],
        { session }
      ).then((docs) => docs[0]);

      const unitDocs = (units && units.length ? units : DEFAULT_UNITS).map((u) => ({ ...u, active: true }));
      await Unit.insertMany(unitDocs, { session });

      const settings = await Settings.create(
        [
          {
            company: {
              name: company.name,
              address: company.address || '',
              phone: company.phone || '',
              email: company.email || '',
              taxNumber: company.taxNumber || '',
            },
            system: { currency: currency || 'JOD' },
            inventory: { defaultWarehouse: wh._id },
            setupCompleted: true,
          },
        ],
        { session }
      ).then((docs) => docs[0]);

      return { superAdmin, warehouse: wh, settings };
  });

  await auditService.logAction({
    req,
    user: result.superAdmin,
    action: 'CREATE',
    entityType: 'System',
    description: 'اكتمل إعداد النظام لأول مرة',
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'تم إعداد النظام بنجاح، يمكنك الآن تسجيل الدخول',
    data: { username: result.superAdmin.username },
  });
});

module.exports = { status, runSetup };
