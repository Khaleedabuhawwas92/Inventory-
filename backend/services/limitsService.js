const Organization = require('../models/Organization');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');

const RESOURCES = {
  users: { limitField: 'maxUsers', label: 'المستخدمين', Model: User },
  warehouses: { limitField: 'maxWarehouses', label: 'المخازن', Model: Warehouse },
  products: { limitField: 'maxProducts', label: 'الأصناف', Model: Product },
};

// Called from the tenant-facing create endpoints (user/warehouse/product
// controllers) right before creating a new one. `null`/unset limit = no
// cap. Lowering a limit below current usage is handled entirely by this
// check alone — it only ever blocks the *next* creation; nothing existing is
// ever touched, counted-out, or deleted (spec: "do not delete anything").
async function assertUnderLimit(organizationId, resource) {
  const config = RESOURCES[resource];
  const org = await Organization.findById(organizationId).select('limits');
  const limit = org?.limits?.[config.limitField];
  if (limit === null || limit === undefined) return;

  const count = await config.Model.countDocuments({ organizationId });
  if (count >= limit) {
    throw ApiError.forbidden(
      `تم الوصول إلى الحد الأقصى المسموح به من ${config.label} (${limit}) لهذه المؤسسة. تواصل مع الدعم لزيادة الحد.`
    );
  }
}

// For the Overview/Limits UI: current usage next to each configured limit.
async function getUsageAndLimits(organizationId) {
  const org = await Organization.findById(organizationId).select('limits');
  const [users, warehouses, products] = await Promise.all([
    User.countDocuments({ organizationId }),
    Warehouse.countDocuments({ organizationId }),
    Product.countDocuments({ organizationId }),
  ]);
  return {
    limits: org?.limits || { maxUsers: null, maxWarehouses: null, maxProducts: null, maxStorageMB: null },
    usage: { users, warehouses, products },
  };
}

module.exports = { assertUnderLimit, getUsageAndLimits };
