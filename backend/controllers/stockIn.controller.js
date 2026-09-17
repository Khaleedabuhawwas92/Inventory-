const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const StockIn = require('../models/StockIn');
const StockMovement = require('../models/StockMovement');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const inventoryService = require('../services/inventoryService');
const withTransaction = require('../utils/withTransaction');
const auditService = require('../services/auditService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.stockIn');
  return settings?.documents?.prefixes?.stockIn || 'IN';
}

const list = asyncHandler(async (req, res) => {
  const { warehouse, status, from, to } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (warehouse) filter.warehouse = warehouse;
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    StockIn.find(filter).populate('warehouse', 'name').populate('supplier', 'name').populate('createdBy', 'fullName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockIn.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await StockIn.findById(req.params.id)
    .populate('warehouse', 'name')
    .populate('supplier', 'name')
    .populate('items.product', 'nameAr sku barcode')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName');
  if (!doc) throw ApiError.notFound('السند غير موجود');
  sendSuccess(res, { data: doc });
});

const create = asyncHandler(async (req, res) => {
  const { warehouse, supplier, supplierInvoiceNo, reference, notes, items, submit } = req.body;

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await StockIn.create({
    docNo, warehouse, supplier: supplier || null, supplierInvoiceNo, reference, notes, items,
    status: 'DRAFT', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'StockIn', entityId: doc._id, description: `تم إنشاء سند إدخال ${doc.docNo}` });

  if (submit) {
    return approveInternal(doc._id, req, res);
  }
  sendSuccess(res, { statusCode: 201, message: 'تم حفظ السند كمسودة', data: doc });
});

async function approveInternal(id, req, res) {
  const doc = await StockIn.findById(id);
  if (!doc) throw ApiError.notFound('السند غير موجود');
  if (doc.status !== 'DRAFT') throw ApiError.badRequest('لا يمكن اعتماد سند تم اعتماده أو إلغاؤه مسبقاً');

  await withTransaction(async (session) => {
    for (const item of doc.items) {
      await inventoryService.stockIn(
        {
          product: item.product, warehouse: doc.warehouse, quantity: item.quantity, unitCost: item.unitCost,
          referenceType: 'StockIn', referenceId: doc._id, createdBy: req.user._id, approvedBy: req.user._id,
        },
        session
      );
    }
    doc.status = 'APPROVED';
    doc.approvedBy = req.user._id;
    doc.approvedAt = new Date();
    await doc.save({ session });
  });

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'StockIn', entityId: doc._id, description: `تم اعتماد سند الإدخال ${doc.docNo}` });
  sendSuccess(res, { message: 'تم اعتماد السند وتحديث المخزون بنجاح', data: doc });
}

const approve = asyncHandler(async (req, res) => approveInternal(req.params.id, req, res));

const cancel = asyncHandler(async (req, res) => {
  const doc = await StockIn.findById(req.params.id);
  if (!doc) throw ApiError.notFound('السند غير موجود');
  if (doc.status === 'CANCELLED') throw ApiError.badRequest('السند ملغى مسبقاً');

  if (doc.status === 'DRAFT') {
    doc.status = 'CANCELLED';
    doc.cancelledBy = req.user._id;
    doc.cancelledAt = new Date();
    await doc.save();
  } else {
    const movements = await StockMovement.find({ referenceType: 'StockIn', referenceId: doc._id, type: 'IN' });
    await withTransaction(async (session) => {
      for (const movement of movements) {
        await inventoryService.reverseMovement(movement._id, { reason: `إلغاء سند الإدخال ${doc.docNo}`, createdBy: req.user._id }, session);
      }
      doc.status = 'CANCELLED';
      doc.cancelledBy = req.user._id;
      doc.cancelledAt = new Date();
      await doc.save({ session });
    });
  }

  await auditService.logAction({ req, action: 'CANCEL', entityType: 'StockIn', entityId: doc._id, description: `تم إلغاء سند الإدخال ${doc.docNo}` });
  sendSuccess(res, { message: 'تم إلغاء السند بنجاح', data: doc });
});

module.exports = { list, getById, create, approve, cancel };
