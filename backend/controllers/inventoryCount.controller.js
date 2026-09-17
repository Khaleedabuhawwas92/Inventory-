const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const InventoryCount = require('../models/InventoryCount');
const Product = require('../models/Product');
const StockBalance = require('../models/StockBalance');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const inventoryService = require('../services/inventoryService');
const withTransaction = require('../utils/withTransaction');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.inventoryCount');
  return settings?.documents?.prefixes?.inventoryCount || 'INVCOUNT';
}

function withDifference(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.items = obj.items.map((item) => {
    const difference = item.physicalQty === null ? null : item.physicalQty - item.systemQty;
    return { ...item, difference, differenceValue: difference === null ? null : difference * item.unitCost };
  });
  return obj;
}

const list = asyncHandler(async (req, res) => {
  const { warehouse, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (warehouse) filter.warehouse = warehouse;
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    InventoryCount.find(filter).populate('warehouse', 'name').populate('createdBy', 'fullName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    InventoryCount.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id)
    .populate('warehouse', 'name')
    .populate('categoryFilter', 'nameAr')
    .populate('items.product', 'nameAr sku barcode')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName');
  if (!doc) throw ApiError.notFound('جلسة الجرد غير موجودة');
  sendSuccess(res, { data: withDifference(doc) });
});

// Creating a session immediately snapshots system quantities and moves
// straight to COUNTING — an empty DRAFT row with no products attached yet
// wouldn't be useful to open, so there is no separate "start counting" step.
const create = asyncHandler(async (req, res) => {
  const { warehouse, categoryFilter, notes } = req.body;

  const productFilter = { active: true };
  if (categoryFilter) productFilter.category = categoryFilter;
  const products = await Product.find(productFilter).select('_id');
  if (!products.length) throw ApiError.badRequest('لا توجد أصناف مطابقة لبدء جلسة الجرد');

  const balances = await StockBalance.find({ warehouse, product: { $in: products.map((p) => p._id) } });
  const balanceMap = new Map(balances.map((b) => [b.product.toString(), b]));

  const items = products.map((p) => {
    const balance = balanceMap.get(p._id.toString());
    return {
      product: p._id,
      systemQty: balance?.quantity || 0,
      unitCost: balance?.averageCost || 0,
      physicalQty: null,
    };
  });

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await InventoryCount.create({
    docNo, warehouse, categoryFilter: categoryFilter || null, notes, items, status: 'COUNTING', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'InventoryCount', entityId: doc._id, description: `تم بدء جلسة جرد ${doc.docNo} (${items.length} صنف)` });
  sendSuccess(res, { statusCode: 201, message: 'تم بدء جلسة الجرد', data: withDifference(doc) });
});

// Saves physical counts incrementally; callable repeatedly while COUNTING or REVIEW.
const recordCounts = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) throw ApiError.notFound('جلسة الجرد غير موجودة');
  if (!['COUNTING', 'REVIEW'].includes(doc.status)) throw ApiError.badRequest('لا يمكن تعديل عدّات هذه الجلسة في حالتها الحالية');

  const updates = new Map(req.body.items.map((i) => [i.product, i.physicalQty]));
  doc.items = doc.items.map((item) => {
    if (updates.has(item.product.toString())) {
      item.physicalQty = updates.get(item.product.toString());
      item.countedBy = req.user._id;
      item.countedAt = new Date();
    }
    return item;
  });
  await doc.save();

  sendSuccess(res, { message: 'تم حفظ الكميات المعدودة', data: withDifference(doc) });
});

const submitForReview = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) throw ApiError.notFound('جلسة الجرد غير موجودة');
  if (doc.status !== 'COUNTING') throw ApiError.badRequest('الجلسة ليست قيد العد حالياً');

  const uncounted = doc.items.filter((i) => i.physicalQty === null).length;
  if (uncounted > 0) throw ApiError.badRequest(`لا يزال هناك ${uncounted} صنف لم يتم عدّه بعد`);

  doc.status = 'REVIEW';
  await doc.save();

  await notificationService.notify({
    permission: 'inventory.approve',
    type: 'INVENTORY_COUNT_PENDING',
    title: `جلسة جرد بانتظار الاعتماد: ${doc.docNo}`,
    message: 'اكتمل العد وبانتظار المراجعة والاعتماد.',
    entityType: 'InventoryCount', entityId: doc._id, route: `/inventory/${doc._id}`,
  });

  sendSuccess(res, { message: 'تم إرسال الجلسة للمراجعة', data: withDifference(doc) });
});

const approve = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) throw ApiError.notFound('جلسة الجرد غير موجودة');
  if (doc.status !== 'REVIEW') throw ApiError.badRequest('لا يمكن اعتماد جلسة ليست قيد المراجعة');

  await withTransaction(async (session) => {
    for (const item of doc.items) {
      const delta = item.physicalQty - item.systemQty;
      if (delta !== 0) {
        await inventoryService.inventoryAdjustment(
          {
            product: item.product, warehouse: doc.warehouse, delta,
            reason: 'نتيجة جرد فعلي', referenceType: 'InventoryCount', referenceId: doc._id,
            createdBy: req.user._id, approvedBy: req.user._id,
          },
          session
        );
      }
    }
    doc.status = 'APPROVED';
    doc.approvedBy = req.user._id;
    doc.approvedAt = new Date();
    await doc.save({ session });
  });

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'InventoryCount', entityId: doc._id, description: `تم اعتماد جلسة الجرد ${doc.docNo}` });
  sendSuccess(res, { message: 'تم اعتماد الجرد وتحديث المخزون بالفروقات', data: withDifference(doc) });
});

const cancel = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) throw ApiError.notFound('جلسة الجرد غير موجودة');
  if (['APPROVED', 'CANCELLED'].includes(doc.status)) throw ApiError.badRequest('لا يمكن إلغاء جلسة معتمدة أو ملغاة مسبقاً');

  doc.status = 'CANCELLED';
  await doc.save();

  await auditService.logAction({ req, action: 'CANCEL', entityType: 'InventoryCount', entityId: doc._id, description: `تم إلغاء جلسة الجرد ${doc.docNo}` });
  sendSuccess(res, { message: 'تم إلغاء جلسة الجرد', data: doc });
});

module.exports = { list, getById, create, recordCounts, submitForReview, approve, cancel };
