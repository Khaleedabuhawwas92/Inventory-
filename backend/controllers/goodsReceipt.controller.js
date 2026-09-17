const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const GoodsReceipt = require('../models/GoodsReceipt');
const PurchaseOrder = require('../models/PurchaseOrder');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const inventoryService = require('../services/inventoryService');
const withTransaction = require('../utils/withTransaction');
const auditService = require('../services/auditService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.goodsReceipt');
  return settings?.documents?.prefixes?.goodsReceipt || 'GRN';
}

const list = asyncHandler(async (req, res) => {
  const { status, supplier, warehouse } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status) filter.status = status;
  if (supplier) filter.supplier = supplier;
  if (warehouse) filter.warehouse = warehouse;

  const [items, total] = await Promise.all([
    GoodsReceipt.find(filter).populate('supplier', 'name').populate('warehouse', 'name').populate('purchaseOrder', 'docNo').sort({ createdAt: -1 }).skip(skip).limit(limit),
    GoodsReceipt.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await GoodsReceipt.findById(req.params.id)
    .populate('supplier', 'name')
    .populate('warehouse', 'name')
    .populate('purchaseOrder', 'docNo')
    .populate('items.product', 'nameAr sku barcode')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName');
  if (!doc) throw ApiError.notFound('سند الاستلام غير موجود');
  sendSuccess(res, { data: doc });
});

// Returns open purchase-order lines (ordered vs already received) so the
// Goods Receipt form can pre-fill "Ordered Qty" / "Already Received" (§28).
const fromPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.poId).populate('items.product', 'nameAr sku barcode');
  if (!po) throw ApiError.notFound('طلب الشراء غير موجود');
  if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw ApiError.badRequest('طلب الشراء ليس معتمداً أو قابلاً للاستلام');
  }

  const openLines = po.items
    .filter((i) => i.receivedQty < i.quantity)
    .map((i) => ({
      product: i.product,
      orderedQty: i.quantity,
      alreadyReceivedQty: i.receivedQty,
      remainingQty: i.quantity - i.receivedQty,
      unitCost: i.unitCost,
    }));

  sendSuccess(res, { data: { supplier: po.supplier, warehouse: po.warehouse, items: openLines } });
});

const create = asyncHandler(async (req, res) => {
  const { supplier, warehouse, purchaseOrder, supplierInvoiceNo, notes, items, submit } = req.body;

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await GoodsReceipt.create({
    docNo, supplier, warehouse, purchaseOrder: purchaseOrder || null, supplierInvoiceNo, notes, items,
    status: 'DRAFT', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'GoodsReceipt', entityId: doc._id, description: `تم إنشاء سند استلام ${doc.docNo}` });

  if (submit) return approveInternal(doc._id, req, res);
  sendSuccess(res, { statusCode: 201, message: 'تم حفظ سند الاستلام كمسودة', data: doc });
});

async function approveInternal(id, req, res) {
  const doc = await GoodsReceipt.findById(id);
  if (!doc) throw ApiError.notFound('سند الاستلام غير موجود');
  if (doc.status !== 'DRAFT') throw ApiError.badRequest('لا يمكن اعتماد سند تم اعتماده أو إلغاؤه مسبقاً');

  await withTransaction(async (session) => {
    for (const item of doc.items) {
      await inventoryService.stockIn(
        {
          product: item.product, warehouse: doc.warehouse, quantity: item.receivingQty, unitCost: item.unitCost,
          referenceType: 'GoodsReceipt', referenceId: doc._id, createdBy: req.user._id, approvedBy: req.user._id,
        },
        session
      );
    }

    doc.status = 'APPROVED';
    doc.approvedBy = req.user._id;
    doc.approvedAt = new Date();
    await doc.save({ session });

    if (doc.purchaseOrder) {
      const po = await PurchaseOrder.findById(doc.purchaseOrder).session(session);
      if (po) {
        for (const item of doc.items) {
          const line = po.items.find((i) => i.product.toString() === item.product.toString());
          if (line) line.receivedQty += item.receivingQty;
        }
        const fullyReceived = po.items.every((i) => i.receivedQty >= i.quantity);
        po.status = fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
        await po.save({ session });
      }
    }
  });

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'GoodsReceipt', entityId: doc._id, description: `تم اعتماد سند الاستلام ${doc.docNo} وتحديث المخزون` });
  sendSuccess(res, { message: 'تم اعتماد سند الاستلام وتحديث المخزون', data: doc });
}

const approve = asyncHandler(async (req, res) => approveInternal(req.params.id, req, res));

module.exports = { list, getById, create, approve, fromPurchaseOrder };
