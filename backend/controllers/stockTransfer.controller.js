const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const StockTransfer = require('../models/StockTransfer');
const StockMovement = require('../models/StockMovement');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const inventoryService = require('../services/inventoryService');
const withTransaction = require('../utils/withTransaction');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.transfer');
  return settings?.documents?.prefixes?.transfer || 'TRF';
}

const list = asyncHandler(async (req, res) => {
  const { status, fromWarehouse, toWarehouse } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status) filter.status = status;
  if (fromWarehouse) filter.fromWarehouse = fromWarehouse;
  if (toWarehouse) filter.toWarehouse = toWarehouse;

  const [items, total] = await Promise.all([
    StockTransfer.find(filter)
      .populate('fromWarehouse', 'name')
      .populate('toWarehouse', 'name')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StockTransfer.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await StockTransfer.findById(req.params.id)
    .populate('fromWarehouse', 'name')
    .populate('toWarehouse', 'name')
    .populate('items.product', 'nameAr sku barcode')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName')
    .populate('receivedBy', 'fullName');
  if (!doc) throw ApiError.notFound('سند التحويل غير موجود');
  sendSuccess(res, { data: doc });
});

const create = asyncHandler(async (req, res) => {
  const { fromWarehouse, toWarehouse, notes, items } = req.body;
  if (fromWarehouse === toWarehouse) throw ApiError.badRequest('لا يمكن أن يكون المخزن المصدر والوجهة نفس المخزن');

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await StockTransfer.create({
    docNo, fromWarehouse, toWarehouse, notes, items, status: 'DRAFT', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'StockTransfer', entityId: doc._id, description: `تم إنشاء سند تحويل ${doc.docNo}` });
  sendSuccess(res, { statusCode: 201, message: 'تم حفظ سند التحويل كمسودة', data: doc });
});

// Ships the transfer: stock leaves the source warehouse now; it does NOT
// enter the destination warehouse until receive() is called (spec §22).
const ship = asyncHandler(async (req, res) => {
  const doc = await StockTransfer.findById(req.params.id);
  if (!doc) throw ApiError.notFound('سند التحويل غير موجود');
  if (doc.status !== 'DRAFT') throw ApiError.badRequest('لا يمكن اعتماد سند تم شحنه أو إلغاؤه مسبقاً');

  await withTransaction(async (session) => {
    for (const item of doc.items) {
      await inventoryService.transferOut(
        {
          product: item.product, warehouse: doc.fromWarehouse, destinationWarehouse: doc.toWarehouse, quantity: item.quantity,
          referenceType: 'StockTransfer', referenceId: doc._id, createdBy: req.user._id, approvedBy: req.user._id,
        },
        session
      );
    }
    doc.status = 'IN_TRANSIT';
    doc.approvedBy = req.user._id;
    doc.approvedAt = new Date();
    await doc.save({ session });
  });

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'StockTransfer', entityId: doc._id, description: `تم شحن سند التحويل ${doc.docNo} (قيد النقل)` });
  await notificationService.notify({
    permission: 'stock.transfer',
    type: 'TRANSFER_PENDING_RECEIPT',
    title: `تحويل بانتظار الاستلام: ${doc.docNo}`,
    message: `بضاعة قيد النقل إلى المخزن الوجهة بانتظار التأكيد.`,
    entityType: 'StockTransfer', entityId: doc._id, route: `/stock/transfers/${doc._id}`,
  });
  sendSuccess(res, { message: 'تم شحن التحويل، البضاعة الآن قيد النقل', data: doc });
});

// Destination user confirms receipt: stock enters the destination warehouse now.
const receive = asyncHandler(async (req, res) => {
  const doc = await StockTransfer.findById(req.params.id);
  if (!doc) throw ApiError.notFound('سند التحويل غير موجود');
  if (doc.status !== 'IN_TRANSIT') throw ApiError.badRequest('السند ليس قيد النقل حالياً');

  await withTransaction(async (session) => {
    for (const item of doc.items) {
      await inventoryService.transferIn(
        {
          product: item.product, warehouse: doc.toWarehouse, sourceWarehouse: doc.fromWarehouse, quantity: item.quantity,
          referenceType: 'StockTransfer', referenceId: doc._id, createdBy: req.user._id, approvedBy: req.user._id,
        },
        session
      );
    }
    doc.status = 'RECEIVED';
    doc.receivedBy = req.user._id;
    doc.receivedAt = new Date();
    await doc.save({ session });
  });

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'StockTransfer', entityId: doc._id, description: `تم استلام سند التحويل ${doc.docNo}` });
  sendSuccess(res, { message: 'تم استلام البضاعة وتحديث مخزون الوجهة', data: doc });
});

const cancel = asyncHandler(async (req, res) => {
  const doc = await StockTransfer.findById(req.params.id);
  if (!doc) throw ApiError.notFound('سند التحويل غير موجود');
  if (['RECEIVED', 'CANCELLED'].includes(doc.status)) {
    throw ApiError.badRequest('لا يمكن إلغاء سند تم استلامه أو إلغاؤه مسبقاً');
  }

  if (doc.status === 'IN_TRANSIT') {
    // Stock already left the source warehouse; reverse those TRANSFER_OUT
    // movements to bring it back before cancelling.
    const movements = await StockMovement.find({ referenceType: 'StockTransfer', referenceId: doc._id, type: 'TRANSFER_OUT' });
    await withTransaction(async (session) => {
      for (const movement of movements) {
        await inventoryService.reverseMovement(movement._id, { reason: `إلغاء سند التحويل ${doc.docNo}`, createdBy: req.user._id }, session);
      }
      doc.status = 'CANCELLED';
      doc.cancelledBy = req.user._id;
      doc.cancelledAt = new Date();
      await doc.save({ session });
    });
  } else {
    doc.status = 'CANCELLED';
    doc.cancelledBy = req.user._id;
    doc.cancelledAt = new Date();
    await doc.save();
  }

  await auditService.logAction({ req, action: 'CANCEL', entityType: 'StockTransfer', entityId: doc._id, description: `تم إلغاء سند التحويل ${doc.docNo}` });
  sendSuccess(res, { message: 'تم إلغاء سند التحويل', data: doc });
});

module.exports = { list, getById, create, ship, receive, cancel };
