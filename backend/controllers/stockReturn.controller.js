const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const StockReturn = require('../models/StockReturn');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const inventoryService = require('../services/inventoryService');
const withTransaction = require('../utils/withTransaction');
const auditService = require('../services/auditService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.stockReturn');
  return settings?.documents?.prefixes?.stockReturn || 'RET';
}

const list = asyncHandler(async (req, res) => {
  const { type, status, warehouse } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (warehouse) filter.warehouse = warehouse;

  const [items, total] = await Promise.all([
    StockReturn.find(filter).populate('warehouse', 'name').populate('supplier', 'name').populate('createdBy', 'fullName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockReturn.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await StockReturn.findById(req.params.id)
    .populate('warehouse', 'name')
    .populate('supplier', 'name')
    .populate('items.product', 'nameAr sku barcode')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName');
  if (!doc) throw ApiError.notFound('سند المرتجع غير موجود');
  sendSuccess(res, { data: doc });
});

function assertDirectionPermission(req, type) {
  const isSuperAdmin = req.user.role?.name === 'super-admin';
  if (isSuperAdmin) return;
  const required = type === 'TO_SUPPLIER' ? 'stock.out' : 'stock.in';
  if (!req.permissions?.includes(required)) {
    throw ApiError.forbidden('ليس لديك صلاحية للقيام بهذا الإجراء');
  }
}

const create = asyncHandler(async (req, res) => {
  const { type, warehouse, supplier, originalReferenceType, originalReferenceId, reason, notes, items, submit } = req.body;
  assertDirectionPermission(req, type);

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await StockReturn.create({
    docNo, type, warehouse, supplier: supplier || null,
    originalReferenceType: originalReferenceType || null, originalReferenceId: originalReferenceId || null,
    reason, notes, items, status: 'DRAFT', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'StockReturn', entityId: doc._id, description: `تم إنشاء سند مرتجع ${doc.docNo}` });

  if (submit) return approveInternal(doc._id, req, res);
  sendSuccess(res, { statusCode: 201, message: 'تم حفظ سند المرتجع كمسودة', data: doc });
});

async function approveInternal(id, req, res) {
  const doc = await StockReturn.findById(id);
  if (!doc) throw ApiError.notFound('سند المرتجع غير موجود');
  if (doc.status !== 'DRAFT') throw ApiError.badRequest('لا يمكن اعتماد سند تم اعتماده أو إلغاؤه مسبقاً');
  assertDirectionPermission(req, doc.type);

  await withTransaction(async (session) => {
    for (const item of doc.items) {
      const op = doc.type === 'TO_SUPPLIER' ? inventoryService.returnOut : inventoryService.returnIn;
      await op(
        {
          product: item.product, warehouse: doc.warehouse, quantity: item.quantity,
          referenceType: 'StockReturn', referenceId: doc._id, createdBy: req.user._id, approvedBy: req.user._id,
        },
        session
      );
    }
    doc.status = 'APPROVED';
    doc.approvedBy = req.user._id;
    doc.approvedAt = new Date();
    await doc.save({ session });
  });

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'StockReturn', entityId: doc._id, description: `تم اعتماد سند المرتجع ${doc.docNo}` });
  sendSuccess(res, { message: 'تم اعتماد سند المرتجع وتحديث المخزون', data: doc });
}

const approve = asyncHandler(async (req, res) => approveInternal(req.params.id, req, res));

module.exports = { list, getById, create, approve };
