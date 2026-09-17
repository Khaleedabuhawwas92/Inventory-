const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const StockOut = require('../models/StockOut');
const StockMovement = require('../models/StockMovement');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const inventoryService = require('../services/inventoryService');
const withTransaction = require('../utils/withTransaction');
const auditService = require('../services/auditService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.stockOut');
  return settings?.documents?.prefixes?.stockOut || 'OUT';
}

const list = asyncHandler(async (req, res) => {
  const { warehouse, status, outputType } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (warehouse) filter.warehouse = warehouse;
  if (status) filter.status = status;
  if (outputType) filter.outputType = outputType;

  const [items, total] = await Promise.all([
    StockOut.find(filter).populate('warehouse', 'name').populate('createdBy', 'fullName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockOut.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await StockOut.findById(req.params.id)
    .populate('warehouse', 'name')
    .populate('items.product', 'nameAr sku barcode')
    .populate('employee', 'fullName')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName');
  if (!doc) throw ApiError.notFound('السند غير موجود');
  sendSuccess(res, { data: doc });
});

const create = asyncHandler(async (req, res) => {
  const { warehouse, outputType, receivingParty, employee, reference, notes, items, submit } = req.body;

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await StockOut.create({
    docNo, warehouse, outputType, receivingParty, employee: employee || null, reference, notes, items,
    status: 'DRAFT', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'StockOut', entityId: doc._id, description: `تم إنشاء سند إخراج ${doc.docNo}` });

  if (submit) {
    return approveInternal(doc._id, req, res);
  }
  sendSuccess(res, { statusCode: 201, message: 'تم حفظ السند كمسودة', data: doc });
});

async function approveInternal(id, req, res) {
  const doc = await StockOut.findById(id);
  if (!doc) throw ApiError.notFound('السند غير موجود');
  if (doc.status !== 'DRAFT') throw ApiError.badRequest('لا يمكن اعتماد سند تم اعتماده أو إلغاؤه مسبقاً');

  // Negative-stock prevention (spec §21) is enforced centrally inside
  // inventoryService.stockOut — if any line exceeds available quantity the
  // whole approval throws and, under a real transaction, none of it commits.
  await withTransaction(async (session) => {
    for (const item of doc.items) {
      await inventoryService.stockOut(
        {
          product: item.product, warehouse: doc.warehouse, quantity: item.quantity,
          referenceType: 'StockOut', referenceId: doc._id, createdBy: req.user._id, approvedBy: req.user._id,
        },
        session
      );
    }
    doc.status = 'APPROVED';
    doc.approvedBy = req.user._id;
    doc.approvedAt = new Date();
    await doc.save({ session });
  });

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'StockOut', entityId: doc._id, description: `تم اعتماد سند الإخراج ${doc.docNo}` });
  sendSuccess(res, { message: 'تم اعتماد السند وتحديث المخزون بنجاح', data: doc });
}

const approve = asyncHandler(async (req, res) => approveInternal(req.params.id, req, res));

const cancel = asyncHandler(async (req, res) => {
  const doc = await StockOut.findById(req.params.id);
  if (!doc) throw ApiError.notFound('السند غير موجود');
  if (doc.status === 'CANCELLED') throw ApiError.badRequest('السند ملغى مسبقاً');

  if (doc.status === 'DRAFT') {
    doc.status = 'CANCELLED';
    doc.cancelledBy = req.user._id;
    doc.cancelledAt = new Date();
    await doc.save();
  } else {
    const movements = await StockMovement.find({ referenceType: 'StockOut', referenceId: doc._id, type: 'OUT' });
    await withTransaction(async (session) => {
      for (const movement of movements) {
        await inventoryService.reverseMovement(movement._id, { reason: `إلغاء سند الإخراج ${doc.docNo}`, createdBy: req.user._id }, session);
      }
      doc.status = 'CANCELLED';
      doc.cancelledBy = req.user._id;
      doc.cancelledAt = new Date();
      await doc.save({ session });
    });
  }

  await auditService.logAction({ req, action: 'CANCEL', entityType: 'StockOut', entityId: doc._id, description: `تم إلغاء سند الإخراج ${doc.docNo}` });
  sendSuccess(res, { message: 'تم إلغاء السند بنجاح', data: doc });
});

module.exports = { list, getById, create, approve, cancel };
