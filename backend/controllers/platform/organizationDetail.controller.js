const mongoose = require('mongoose');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { sendSuccess } = require('../../utils/apiResponse');
const { getPagination, buildMeta } = require('../../utils/pagination');
const tenantContext = require('../../utils/tenantContext');
const auditService = require('../../services/auditService');
const Organization = require('../../models/Organization');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Warehouse = require('../../models/Warehouse');
const Product = require('../../models/Product');
const StockBalance = require('../../models/StockBalance');
const StockMovement = require('../../models/StockMovement');
const Invitation = require('../../models/Invitation');
const PlatformOrganizationNote = require('../../models/PlatformOrganizationNote');
const tokenService = require('../../services/tokenService');
const { getUsageAndLimits } = require('../../services/limitsService');

// Every handler below explicitly filters by *this URL param* organizationId
// on every single query — never by ambient ("ready ambient" tenant context,
// which for these routes is the platform admin's own organization, not the
// one being inspected). tenantContext.runWithoutTenant(...) only switches
// off the *automatic* scoping utils/tenantPlugin.js would otherwise try to
// apply from that ambient context; it is the explicit `organizationId: orgId`
// in each filter/match below that actually determines whose data comes back.
async function requireOrganization(id) {
  const org = await Organization.findById(id);
  if (!org) throw ApiError.notFound('المؤسسة غير موجودة');
  return org;
}

const LOW_STOCK_EXPR = {
  $and: [{ $gt: ['$quantity', 0] }, { $gt: ['$product.minStock', 0] }, { $lte: ['$quantity', '$product.minStock'] }],
};

// ---------------------------------------------------------------------------
// GET /organizations/:id/stats — the Overview tab's numeric stat cards.
// ---------------------------------------------------------------------------
const stats = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  const orgId = org._id;

  const data = await tenantContext.runWithoutTenant(async () => {
    const [
      warehousesCount,
      usersCount,
      activeUsersCount,
      productsCount,
      invitationsCount,
      movementsCount,
      stockAgg,
      lowStockAgg,
      outOfStockCount,
    ] = await Promise.all([
      Warehouse.countDocuments({ organizationId: orgId }),
      User.countDocuments({ organizationId: orgId }),
      User.countDocuments({ organizationId: orgId, status: 'active' }),
      Product.countDocuments({ organizationId: orgId }),
      Invitation.countDocuments({ organizationId: orgId, active: true, usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }),
      StockMovement.countDocuments({ organizationId: orgId }),
      StockBalance.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: null, totalQuantity: { $sum: '$quantity' }, totalValue: { $sum: { $multiply: ['$quantity', '$averageCost'] } } } },
      ]),
      StockBalance.aggregate([
        { $match: { organizationId: orgId } },
        { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $match: { $expr: LOW_STOCK_EXPR } },
        { $count: 'count' },
      ]),
      StockBalance.countDocuments({ organizationId: orgId, quantity: { $lte: 0 } }),
    ]);

    return {
      warehousesCount,
      usersCount,
      activeUsersCount,
      productsCount,
      invitationsCount,
      movementsCount,
      totalStockQuantity: stockAgg[0]?.totalQuantity || 0,
      totalStockValue: stockAgg[0]?.totalValue || 0,
      lowStockCount: lowStockAgg[0]?.count || 0,
      outOfStockCount,
    };
  });

  sendSuccess(res, { data });
});

// ---------------------------------------------------------------------------
// GET /organizations/:id/warehouses — paginated, with per-warehouse stats
// computed via a handful of aggregations scoped to just the current page's
// warehouse ids (not the whole organization), so cost stays flat regardless
// of how many warehouses/products the organization has (spec §12).
// ---------------------------------------------------------------------------
const warehouses = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  const orgId = org._id;
  const { page, limit, skip } = getPagination(req.query);

  const { items, total } = await tenantContext.runWithoutTenant(async () => {
    const [whs, count] = await Promise.all([
      Warehouse.find({ organizationId: orgId })
        .populate('manager', 'fullName username')
        .sort({ isMain: -1, name: 1 })
        .skip(skip)
        .limit(limit),
      Warehouse.countDocuments({ organizationId: orgId }),
    ]);

    const warehouseIds = whs.map((w) => w._id);
    const [balanceStats, lowStockStats, movementStats] = await Promise.all([
      StockBalance.aggregate([
        { $match: { organizationId: orgId, warehouse: { $in: warehouseIds } } },
        {
          $group: {
            _id: '$warehouse',
            productCount: { $sum: { $cond: [{ $gt: ['$quantity', 0] }, 1, 0] } },
            totalQuantity: { $sum: '$quantity' },
            totalValue: { $sum: { $multiply: ['$quantity', '$averageCost'] } },
          },
        },
      ]),
      StockBalance.aggregate([
        { $match: { organizationId: orgId, warehouse: { $in: warehouseIds } } },
        { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $match: { $expr: LOW_STOCK_EXPR } },
        { $group: { _id: '$warehouse', lowStockCount: { $sum: 1 } } },
      ]),
      StockMovement.aggregate([
        { $match: { organizationId: orgId, warehouse: { $in: warehouseIds } } },
        { $group: { _id: '$warehouse', lastMovementAt: { $max: '$createdAt' } } },
      ]),
    ]);

    const balanceMap = new Map(balanceStats.map((b) => [String(b._id), b]));
    const lowStockMap = new Map(lowStockStats.map((b) => [String(b._id), b.lowStockCount]));
    const movementMap = new Map(movementStats.map((b) => [String(b._id), b.lastMovementAt]));

    const shaped = whs.map((w) => {
      const bal = balanceMap.get(String(w._id));
      return {
        _id: w._id,
        name: w.name,
        code: w.code,
        address: w.address,
        manager: w.manager,
        phone: w.phone,
        status: w.status,
        isMain: w.isMain,
        createdAt: w.createdAt,
        productCount: bal?.productCount || 0,
        totalQuantity: bal?.totalQuantity || 0,
        inventoryValue: bal?.totalValue || 0,
        lowStockCount: lowStockMap.get(String(w._id)) || 0,
        lastActivity: movementMap.get(String(w._id)) || null,
      };
    });

    return { items: shaped, total: count };
  });

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

// ---------------------------------------------------------------------------
// PATCH /organizations/:id/warehouses/:warehouseId/status — enable/disable
// only, same "never disable the main warehouse" safety rule the tenant-facing
// warehouse.controller.js already enforces (spec: "if supported safely").
// ---------------------------------------------------------------------------
const setWarehouseStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    throw ApiError.badRequest('حالة غير صالحة (active أو inactive فقط)');
  }
  const org = await requireOrganization(req.params.id);

  const warehouse = await tenantContext.runWithoutTenant(async () => {
    const wh = await Warehouse.findOne({ _id: req.params.warehouseId, organizationId: org._id });
    if (!wh) return null;
    if (wh.isMain && status === 'inactive') {
      throw ApiError.badRequest('لا يمكن تعطيل المخزن الرئيسي');
    }
    wh.status = status;
    await wh.save();
    return wh;
  });
  if (!warehouse) throw ApiError.notFound('المخزن غير موجود في هذه المؤسسة');

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Warehouse',
      entityId: warehouse._id,
      description: `[PLATFORM] تم ${status === 'active' ? 'تفعيل' : 'تعطيل'} المخزن ${warehouse.name} بواسطة مدير المنصة`,
    })
  );

  sendSuccess(res, {
    message: status === 'active' ? 'تم تفعيل المخزن' : 'تم تعطيل المخزن',
    data: { _id: warehouse._id, status: warehouse.status },
  });
});

// ---------------------------------------------------------------------------
// GET /organizations/:id/warehouses/:warehouseId — full warehouse detail:
// info + stats + paginated products-in-warehouse (via one aggregation
// pipeline with $facet, so filtering/pagination happens in the database, not
// in memory — spec §12) + recent movements + assigned users.
// ---------------------------------------------------------------------------
const warehouseDetail = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  const orgId = org._id;
  const warehouseObjectId = mongoose.isValidObjectId(req.params.warehouseId)
    ? new mongoose.Types.ObjectId(req.params.warehouseId)
    : null;
  if (!warehouseObjectId) throw ApiError.notFound('المخزن غير موجود في هذه المؤسسة');

  const { search, category, lowStock, outOfStock } = req.query;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });

  const data = await tenantContext.runWithoutTenant(async () => {
    const warehouse = await Warehouse.findOne({ _id: warehouseObjectId, organizationId: orgId }).populate('manager', 'fullName username');
    if (!warehouse) return null;

    const balanceMatch = { organizationId: orgId, warehouse: warehouseObjectId };

    const pipeline = [
      { $match: balanceMatch },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
    ];
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      pipeline.push({ $match: { $or: [{ 'product.nameAr': regex }, { 'product.nameEn': regex }, { 'product.sku': regex }, { 'product.barcode': regex }] } });
    }
    if (category && mongoose.isValidObjectId(category)) {
      pipeline.push({ $match: { 'product.category': new mongoose.Types.ObjectId(category) } });
    }
    if (outOfStock === 'true') {
      pipeline.push({ $match: { quantity: { $lte: 0 } } });
    } else if (lowStock === 'true') {
      pipeline.push({ $match: { $expr: LOW_STOCK_EXPR } });
    }

    pipeline.push(
      { $sort: { updatedAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            { $lookup: { from: 'categories', localField: 'product.category', foreignField: '_id', as: 'categoryDoc' } },
            { $lookup: { from: 'units', localField: 'product.unit', foreignField: '_id', as: 'unitDoc' } },
            {
              $project: {
                _id: '$product._id',
                sku: '$product.sku',
                nameAr: '$product.nameAr',
                active: '$product.active',
                category: { $arrayElemAt: ['$categoryDoc.nameAr', 0] },
                unit: { $arrayElemAt: ['$unitDoc.shortCode', 0] },
                quantity: 1,
                availableQuantity: { $subtract: ['$quantity', '$reservedQuantity'] },
                averageCost: 1,
                inventoryValue: { $multiply: ['$quantity', '$averageCost'] },
                minStock: '$product.minStock',
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      }
    );

    const [
      [facetResult],
      statsAgg,
      lowStockAgg,
      outOfStockCount,
      totalMovements,
      lastMovement,
      assignedUsers,
      recentMovements,
    ] = await Promise.all([
      StockBalance.aggregate(pipeline),
      StockBalance.aggregate([
        { $match: balanceMatch },
        { $group: { _id: null, productCount: { $sum: { $cond: [{ $gt: ['$quantity', 0] }, 1, 0] } }, totalQuantity: { $sum: '$quantity' }, totalValue: { $sum: { $multiply: ['$quantity', '$averageCost'] } } } },
      ]),
      StockBalance.aggregate([
        { $match: balanceMatch },
        { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $match: { $expr: LOW_STOCK_EXPR } },
        { $count: 'count' },
      ]),
      StockBalance.countDocuments({ ...balanceMatch, quantity: { $lte: 0 } }),
      StockMovement.countDocuments({ organizationId: orgId, warehouse: warehouseObjectId }),
      StockMovement.findOne({ organizationId: orgId, warehouse: warehouseObjectId }).sort({ createdAt: -1 }).select('createdAt'),
      User.find({ organizationId: orgId, warehouse: warehouseObjectId }).select('fullName username status').populate('role', 'nameAr'),
      StockMovement.find({ organizationId: orgId, warehouse: warehouseObjectId })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('product', 'nameAr sku')
        .populate('createdBy', 'fullName'),
    ]);

    return {
      warehouse,
      stats: {
        productCount: statsAgg[0]?.productCount || 0,
        totalQuantity: statsAgg[0]?.totalQuantity || 0,
        inventoryValue: statsAgg[0]?.totalValue || 0,
        lowStockCount: lowStockAgg[0]?.count || 0,
        outOfStockCount,
        totalMovements,
        lastMovementAt: lastMovement?.createdAt || null,
      },
      products: {
        items: facetResult?.items || [],
        meta: buildMeta({ page, limit, total: facetResult?.totalCount?.[0]?.count || 0 }),
      },
      recentMovements,
      assignedUsers,
    };
  });

  if (!data) throw ApiError.notFound('المخزن غير موجود في هذه المؤسسة');
  sendSuccess(res, { data });
});

// ---------------------------------------------------------------------------
// GET /organizations/:id/products — paginated. Stock totals/warehouse-count/
// value are computed with one aggregation scoped to just the current page's
// product ids, not the whole catalog (spec §12).
// ---------------------------------------------------------------------------
const products = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  const orgId = org._id;
  const { search, category, active } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { organizationId: orgId };
  if (category) filter.category = category;
  if (active !== undefined && active !== '') filter.active = active === 'true';
  if (search) {
    filter.$or = [
      { nameAr: { $regex: search, $options: 'i' } },
      { nameEn: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }

  const { items, total } = await tenantContext.runWithoutTenant(async () => {
    const [prods, count] = await Promise.all([
      Product.find(filter).populate('category', 'nameAr').populate('unit', 'nameAr shortCode').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);

    const productIds = prods.map((p) => p._id);
    const stockAgg = await StockBalance.aggregate([
      { $match: { organizationId: orgId, product: { $in: productIds } } },
      {
        $group: {
          _id: '$product',
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$averageCost'] } },
          warehouseCount: { $sum: { $cond: [{ $gt: ['$quantity', 0] }, 1, 0] } },
        },
      },
    ]);
    const stockMap = new Map(stockAgg.map((s) => [String(s._id), s]));

    const shaped = prods.map((p) => {
      const s = stockMap.get(String(p._id));
      return {
        _id: p._id,
        sku: p.sku,
        barcode: p.barcode,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        category: p.category,
        unit: p.unit,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        active: p.active,
        totalQuantity: s?.totalQuantity || 0,
        warehouseCount: s?.warehouseCount || 0,
        stockValue: s?.totalValue || 0,
      };
    });

    return { items: shaped, total: count };
  });

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

// ---------------------------------------------------------------------------
// GET /organizations/:id/products/:productId — per-warehouse breakdown +
// recent movement history for one product.
// ---------------------------------------------------------------------------
const productDetail = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  const orgId = org._id;

  const data = await tenantContext.runWithoutTenant(async () => {
    const product = await Product.findOne({ _id: req.params.productId, organizationId: orgId })
      .populate('category', 'nameAr')
      .populate('unit', 'nameAr shortCode');
    if (!product) return null;

    const [balances, recentMovements] = await Promise.all([
      StockBalance.find({ organizationId: orgId, product: product._id }).populate('warehouse', 'name code'),
      StockMovement.find({ organizationId: orgId, product: product._id })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate('warehouse', 'name code')
        .populate('createdBy', 'fullName'),
    ]);

    const totalQuantity = balances.reduce((sum, b) => sum + b.quantity, 0);
    const totalValue = balances.reduce((sum, b) => sum + b.quantity * b.averageCost, 0);

    return {
      product,
      warehouseBalances: balances.map((b) => ({
        warehouse: b.warehouse,
        quantity: b.quantity,
        availableQuantity: b.quantity - b.reservedQuantity,
        averageCost: b.averageCost,
        inventoryValue: b.quantity * b.averageCost,
      })),
      totals: { quantity: totalQuantity, value: totalValue },
      recentMovements,
    };
  });

  if (!data) throw ApiError.notFound('الصنف غير موجود في هذه المؤسسة');
  sendSuccess(res, { data });
});

// ---------------------------------------------------------------------------
// GET /organizations/:id/movements — paginated, read-only (spec: no manual
// stock editing is ever added to Platform Admin).
// ---------------------------------------------------------------------------
const movements = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  const orgId = org._id;
  const { dateFrom, dateTo, warehouse, product, type, user } = req.query;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 30 });

  const filter = { organizationId: orgId };
  if (warehouse) filter.warehouse = warehouse;
  if (product) filter.product = product;
  if (type) filter.type = type;
  if (user) filter.createdBy = user;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  const { items, total } = await tenantContext.runWithoutTenant(async () => {
    const [logs, count] = await Promise.all([
      StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('product', 'nameAr sku')
        .populate('warehouse', 'name code')
        .populate('createdBy', 'fullName'),
      StockMovement.countDocuments(filter),
    ]);
    return { items: logs, total: count };
  });

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

// ---------------------------------------------------------------------------
// POST /organizations/:id/invitations/:invitationId/revoke — reuses the exact
// same revoke semantics as the tenant-facing invitation.controller.js
// (active=false, revokedAt set), just reachable for any organization rather
// than only the caller's own.
// ---------------------------------------------------------------------------
const revokeInvitation = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);

  const invitation = await tenantContext.runWithoutTenant(async () => {
    const inv = await Invitation.findOne({ _id: req.params.invitationId, organizationId: org._id });
    if (!inv) return null;
    inv.active = false;
    inv.revokedAt = new Date();
    await inv.save();
    return inv;
  });
  if (!invitation) throw ApiError.notFound('الدعوة غير موجودة في هذه المؤسسة');

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Invitation',
      entityId: invitation._id,
      description: '[PLATFORM] تم إلغاء دعوة انضمام بواسطة مدير المنصة',
    })
  );

  sendSuccess(res, { message: 'تم إلغاء الدعوة بنجاح' });
});

// ---------------------------------------------------------------------------
// Subscription metadata — control-only, no payment gateway. GET/PATCH.
// ---------------------------------------------------------------------------
const SUBSCRIPTION_FIELDS = ['plan', 'subscriptionStatus', 'trialEndsAt', 'subscriptionStartsAt', 'subscriptionEndsAt'];
const PLAN_VALUES = ['FREE', 'TRIAL', 'MONTHLY', 'YEARLY', 'CUSTOM'];
const SUBSCRIPTION_STATUS_VALUES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED'];

function pickSubscription(org) {
  const out = {};
  for (const f of SUBSCRIPTION_FIELDS) out[f] = org[f];
  return out;
}

const getSubscription = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  sendSuccess(res, { data: pickSubscription(org) });
});

const updateSubscription = asyncHandler(async (req, res) => {
  const { plan, subscriptionStatus, trialEndsAt, subscriptionStartsAt, subscriptionEndsAt } = req.body;
  if (plan !== undefined && !PLAN_VALUES.includes(plan)) throw ApiError.badRequest('خطة غير صالحة');
  if (subscriptionStatus !== undefined && !SUBSCRIPTION_STATUS_VALUES.includes(subscriptionStatus)) {
    throw ApiError.badRequest('حالة اشتراك غير صالحة');
  }

  const org = await requireOrganization(req.params.id);
  const before = pickSubscription(org);
  if (plan !== undefined) org.plan = plan;
  if (subscriptionStatus !== undefined) org.subscriptionStatus = subscriptionStatus;
  if (trialEndsAt !== undefined) org.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
  if (subscriptionStartsAt !== undefined) org.subscriptionStartsAt = subscriptionStartsAt ? new Date(subscriptionStartsAt) : null;
  if (subscriptionEndsAt !== undefined) org.subscriptionEndsAt = subscriptionEndsAt ? new Date(subscriptionEndsAt) : null;
  await org.save();

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: org._id,
      description: '[PLATFORM] تم تعديل بيانات الاشتراك بواسطة مدير المنصة',
      oldValue: before,
      newValue: pickSubscription(org),
    })
  );

  sendSuccess(res, { message: 'تم تحديث بيانات الاشتراك', data: pickSubscription(org) });
});

// ---------------------------------------------------------------------------
// Limits — GET returns current usage alongside configured limits; PATCH only
// ever changes the *cap*, never touches or deletes any existing data, even
// when the new cap is below current usage (spec: "do not delete anything").
// ---------------------------------------------------------------------------
const getLimits = asyncHandler(async (req, res) => {
  await requireOrganization(req.params.id);
  const data = await tenantContext.runWithoutTenant(() => getUsageAndLimits(req.params.id));
  sendSuccess(res, { data });
});

const updateLimits = asyncHandler(async (req, res) => {
  const { maxUsers, maxWarehouses, maxProducts, maxStorageMB } = req.body;
  const fields = { maxUsers, maxWarehouses, maxProducts, maxStorageMB };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && (typeof value !== 'number' || value < 0)) {
      throw ApiError.badRequest(`قيمة غير صالحة لـ ${key} — يجب أن تكون رقماً موجباً أو null لعدم التحديد`);
    }
  }

  const org = await requireOrganization(req.params.id);
  const before = { ...org.limits.toObject() };
  if (maxUsers !== undefined) org.limits.maxUsers = maxUsers;
  if (maxWarehouses !== undefined) org.limits.maxWarehouses = maxWarehouses;
  if (maxProducts !== undefined) org.limits.maxProducts = maxProducts;
  if (maxStorageMB !== undefined) org.limits.maxStorageMB = maxStorageMB;
  await org.save();

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: org._id,
      description: '[PLATFORM] تم تعديل حدود المؤسسة بواسطة مدير المنصة',
      oldValue: before,
      newValue: org.limits.toObject(),
    })
  );

  const usageAndLimits = await tenantContext.runWithoutTenant(() => getUsageAndLimits(org._id));
  sendSuccess(res, { message: 'تم تحديث حدود المؤسسة', data: usageAndLimits });
});

// ---------------------------------------------------------------------------
// Feature flags — enforced server-side (see middleware/requireFeature.js and
// the checks added to the relevant tenant controllers), not just hidden in
// the tenant frontend. Disabling one never removes any existing data.
// ---------------------------------------------------------------------------
const FEATURE_KEYS = ['multiWarehouse', 'barcode', 'purchasing', 'advancedReports', 'inventoryCount', 'returns', 'backups', 'csvExport', 'pdfExport'];

const getFeatures = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  sendSuccess(res, { data: org.features });
});

const updateFeatures = asyncHandler(async (req, res) => {
  const updates = {};
  for (const key of FEATURE_KEYS) {
    if (req.body[key] !== undefined) {
      if (typeof req.body[key] !== 'boolean') throw ApiError.badRequest(`قيمة غير صالحة لـ ${key} — يجب أن تكون true أو false`);
      updates[key] = req.body[key];
    }
  }

  const org = await requireOrganization(req.params.id);
  const before = { ...org.features.toObject() };
  Object.assign(org.features, updates);
  await org.save();

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: org._id,
      description: `[PLATFORM] تم تعديل ميزات المؤسسة بواسطة مدير المنصة (${Object.keys(updates).join(', ') || 'لا تغييرات'})`,
      oldValue: before,
      newValue: org.features.toObject(),
    })
  );

  sendSuccess(res, { message: 'تم تحديث ميزات المؤسسة', data: org.features });
});

// ---------------------------------------------------------------------------
// Organization-wide session revocation — logs everyone in this organization
// out on their next API call (401 → forced re-login), without touching a
// single password. A confirmation dialog + optional reason live in the
// frontend; the reason (if given) is recorded here.
// ---------------------------------------------------------------------------
const revokeOrganizationSessions = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const org = await requireOrganization(req.params.id);

  const revokedCount = await tenantContext.runWithoutTenant(async () => {
    const users = await User.find({ organizationId: org._id }).select('_id');
    const userIds = users.map((u) => u._id);
    await tokenService.revokeAllForUsers(userIds);
    return userIds.length;
  });

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: org._id,
      description: `[PLATFORM] تم تسجيل خروج جميع مستخدمي المؤسسة (${revokedCount}) بواسطة مدير المنصة${reason ? ` — السبب: ${reason.trim()}` : ''}`,
    })
  );

  sendSuccess(res, { message: 'تم تسجيل خروج جميع مستخدمي المؤسسة', data: { usersAffected: revokedCount } });
});

// ---------------------------------------------------------------------------
// GET /organizations/:id/roles — read-only, small (an organization typically
// has under a dozen roles), backs the "change role" dropdown in the Users
// tab. Role is scoped manually everywhere in this codebase (see
// models/Role.js), so this filters by organizationId explicitly like every
// other handler in this file.
// ---------------------------------------------------------------------------
const roles = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);
  const list = await tenantContext.runWithoutTenant(() => Role.find({ organizationId: org._id }).sort({ createdAt: 1 }));
  sendSuccess(res, { data: list });
});

// ---------------------------------------------------------------------------
// Per-user controls inside an organization: role, warehouse, session revoke.
// Role/warehouse are *always* re-verified to belong to this same
// organization — never trusted from the request body alone.
// ---------------------------------------------------------------------------
const setUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!role) throw ApiError.badRequest('يجب تحديد الدور');

  const org = await requireOrganization(req.params.id);

  const result = await tenantContext.runWithoutTenant(async () => {
    const user = await User.findOne({ _id: req.params.userId, organizationId: org._id });
    if (!user) return null;
    const roleDoc = await Role.findOne({ _id: role, organizationId: org._id });
    if (!roleDoc) throw ApiError.badRequest('الدور المحدد غير موجود في هذه المؤسسة');

    const oldRole = await Role.findById(user.role).select('nameAr');
    user.role = roleDoc._id;
    await user.save();
    return { user, oldRole, newRole: roleDoc };
  });
  if (!result) throw ApiError.notFound('المستخدم غير موجود في هذه المؤسسة');

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'PERMISSION_CHANGE',
      entityType: 'User',
      entityId: result.user._id,
      description: `[PLATFORM] تم تغيير دور المستخدم ${result.user.username} من "${result.oldRole?.nameAr || '—'}" إلى "${result.newRole.nameAr}" بواسطة مدير المنصة`,
    })
  );

  sendSuccess(res, { message: 'تم تحديث دور المستخدم', data: { _id: result.user._id, role: result.newRole } });
});

const setUserWarehouse = asyncHandler(async (req, res) => {
  const { warehouse } = req.body;
  const org = await requireOrganization(req.params.id);

  const result = await tenantContext.runWithoutTenant(async () => {
    const user = await User.findOne({ _id: req.params.userId, organizationId: org._id });
    if (!user) return null;

    let warehouseDoc = null;
    if (warehouse) {
      warehouseDoc = await Warehouse.findOne({ _id: warehouse, organizationId: org._id });
      if (!warehouseDoc) throw ApiError.badRequest('المخزن المحدد غير موجود في هذه المؤسسة');
    }

    user.warehouse = warehouseDoc?._id || null;
    await user.save();
    return { user, warehouseDoc };
  });
  if (!result) throw ApiError.notFound('المستخدم غير موجود في هذه المؤسسة');

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'User',
      entityId: result.user._id,
      description: `[PLATFORM] تم تعديل المخزن المخصص للمستخدم ${result.user.username} بواسطة مدير المنصة`,
    })
  );

  sendSuccess(res, { message: 'تم تحديث المخزن المخصص', data: { _id: result.user._id, warehouse: result.warehouseDoc } });
});

const revokeUserSessions = asyncHandler(async (req, res) => {
  const org = await requireOrganization(req.params.id);

  const user = await tenantContext.runWithoutTenant(() => User.findOne({ _id: req.params.userId, organizationId: org._id }));
  if (!user) throw ApiError.notFound('المستخدم غير موجود في هذه المؤسسة');

  await tokenService.revokeAllForUser(user._id);

  await tenantContext.run(org._id, () =>
    auditService.logAction({
      req,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      description: `[PLATFORM] تم تسجيل خروج جميع جلسات المستخدم ${user.username} بواسطة مدير المنصة`,
    })
  );

  sendSuccess(res, { message: 'تم تسجيل خروج جميع جلسات المستخدم' });
});

// ---------------------------------------------------------------------------
// Internal platform notes — Platform-Admin-only, never returned from any
// tenant-facing route (models/PlatformOrganizationNote.js is only ever
// required here).
// ---------------------------------------------------------------------------
const listNotes = asyncHandler(async (req, res) => {
  await requireOrganization(req.params.id);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });

  const [items, total] = await Promise.all([
    PlatformOrganizationNote.find({ organizationId: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'fullName username'),
    PlatformOrganizationNote.countDocuments({ organizationId: req.params.id }),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const createNote = asyncHandler(async (req, res) => {
  const { text, category } = req.body;
  if (!text?.trim()) throw ApiError.badRequest('نص الملاحظة مطلوب');
  if (category && !['SUPPORT', 'BILLING', 'GENERAL'].includes(category)) {
    throw ApiError.badRequest('تصنيف غير صالح');
  }

  const org = await requireOrganization(req.params.id);
  const note = await PlatformOrganizationNote.create({
    organizationId: org._id,
    text: text.trim(),
    category: category || 'GENERAL',
    createdBy: req.user._id,
  });
  const populated = await note.populate('createdBy', 'fullName username');

  sendSuccess(res, { statusCode: 201, message: 'تمت إضافة الملاحظة', data: populated });
});

module.exports = {
  stats,
  roles,
  warehouses,
  setWarehouseStatus,
  warehouseDetail,
  products,
  productDetail,
  movements,
  getSubscription,
  updateSubscription,
  getLimits,
  updateLimits,
  getFeatures,
  updateFeatures,
  revokeOrganizationSessions,
  setUserRole,
  setUserWarehouse,
  revokeUserSessions,
  listNotes,
  createNote,
  revokeInvitation,
};
