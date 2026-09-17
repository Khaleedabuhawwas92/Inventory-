const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const StockAdjustment = require('../models/StockAdjustment');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const inventoryService = require('../services/inventoryService');
const withTransaction = require('../utils/withTransaction');
const auditService = require('../services/auditService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.adjustment');
  return settings?.documents?.prefixes?.adjustment || 'ADJ';
}

const list = asyncHandler(async (req, res) => {
  const { warehouse, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (warehouse) filter.warehouse = warehouse;
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    StockAdjustment.find(filter).populate('warehouse', 'name').populate('createdBy', 'fullName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockAdjustment.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await StockAdjustment.findById(req.params.id)
    .populate('warehouse', 'name')
    .populate('items.product', 'nameAr sku barcode')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName');
  if (!doc) throw ApiError.notFound('السند غير موجود');
  sendSuccess(res, { data: doc });
});

const create = asyncHandler(async (req, res) => {
  const { warehouse, notes, items, submit } = req.body;

  // systemQty is captured fresh at creation time purely for display in the
  // draft (spec §24 shows it alongside the new quantity); the actual applied
  // delta is recomputed from the LIVE balance at approval time in case other
  // movements happened in between, so the adjustment is never based on stale data.
  const itemsWithSnapshot = [];
  for (const item of items) {
    const balance = await inventoryService.getCurrentStock(item.product, warehouse);
    itemsWithSnapshot.push({ ...item, systemQty: balance.quantity });
  }

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await StockAdjustment.create({
    docNo, warehouse, notes, items: itemsWithSnapshot, status: 'DRAFT', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'StockAdjustment', entityId: doc._id, description: `تم إنشاء سند تسوية ${doc.docNo}` });

  if (submit) {
    return approveInternal(doc._id, req, res);
  }
  sendSuccess(res, { statusCode: 201, message: 'تم حفظ السند كمسودة', data: doc });
});

async function approveInternal(id, req, res) {
  const doc = await StockAdjustment.findById(id);
  if (!doc) throw ApiError.notFound('السند غير موجود');
  if (doc.status !== 'DRAFT') throw ApiError.badRequest('لا يمكن اعتماد سند تم اعتماده أو إلغاؤه مسبقاً');

  await withTransaction(async (session) => {
    for (const item of doc.items) {
      const balance = await inventoryService.getCurrentStock(item.product, doc.warehouse);
      const delta = item.newQty - balance.quantity;
      if (delta !== 0) {
        await inventoryService.adjustment(
          {
            product: item.product, warehouse: doc.warehouse, delta, reason: item.reason,
            notes: item.notes, referenceType: 'StockAdjustment', referenceId: doc._id,
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

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'StockAdjustment', entityId: doc._id, description: `تم اعتماد سند التسوية ${doc.docNo}` });
  sendSuccess(res, { message: 'تم اعتماد السند وتحديث المخزون بنجاح', data: doc });
}

const approve = asyncHandler(async (req, res) => approveInternal(req.params.id, req, res));

module.exports = { list, getById, create, approve };
