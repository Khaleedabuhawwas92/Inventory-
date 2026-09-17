const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const PurchaseOrder = require('../models/PurchaseOrder');
const Settings = require('../models/Settings');
const { nextDocumentNumber } = require('../services/counterService');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

async function getPrefix() {
  const settings = await Settings.findOne().select('documents.prefixes.purchaseOrder');
  return settings?.documents?.prefixes?.purchaseOrder || 'PO';
}

const list = asyncHandler(async (req, res) => {
  const { status, supplier, warehouse } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status) filter.status = status;
  if (supplier) filter.supplier = supplier;
  if (warehouse) filter.warehouse = warehouse;

  const [items, total] = await Promise.all([
    PurchaseOrder.find(filter).populate('supplier', 'name').populate('warehouse', 'name').populate('createdBy', 'fullName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    PurchaseOrder.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id)
    .populate('supplier', 'name phone')
    .populate('warehouse', 'name')
    .populate('items.product', 'nameAr sku barcode')
    .populate('createdBy', 'fullName')
    .populate('approvedBy', 'fullName');
  if (!doc) throw ApiError.notFound('طلب الشراء غير موجود');
  sendSuccess(res, { data: doc });
});

const create = asyncHandler(async (req, res) => {
  const { supplier, warehouse, expectedDate, notes, items, submit } = req.body;

  const docNo = await nextDocumentNumber(await getPrefix());
  const doc = await PurchaseOrder.create({
    docNo, supplier, warehouse, expectedDate: expectedDate || null, notes, items,
    status: submit ? 'PENDING' : 'DRAFT', createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'PurchaseOrder', entityId: doc._id, description: `تم إنشاء طلب شراء ${doc.docNo}` });
  if (doc.status === 'PENDING') {
    await notificationService.notify({
      permission: 'purchases.approve',
      type: 'APPROVAL_PENDING',
      title: `طلب شراء بانتظار الاعتماد: ${doc.docNo}`,
      message: 'طلب شراء جديد بحاجة لاعتماد.',
      entityType: 'PurchaseOrder', entityId: doc._id, route: `/purchases/${doc._id}`,
    });
  }
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء طلب الشراء بنجاح', data: doc });
});

const approve = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw ApiError.notFound('طلب الشراء غير موجود');
  if (!['DRAFT', 'PENDING'].includes(doc.status)) throw ApiError.badRequest('لا يمكن اعتماد طلب الشراء في حالته الحالية');

  doc.status = 'APPROVED';
  doc.approvedBy = req.user._id;
  doc.approvedAt = new Date();
  await doc.save();

  await auditService.logAction({ req, action: 'APPROVE', entityType: 'PurchaseOrder', entityId: doc._id, description: `تم اعتماد طلب الشراء ${doc.docNo}` });
  sendSuccess(res, { message: 'تم اعتماد طلب الشراء', data: doc });
});

const cancel = asyncHandler(async (req, res) => {
  const doc = await PurchaseOrder.findById(req.params.id);
  if (!doc) throw ApiError.notFound('طلب الشراء غير موجود');
  if (['RECEIVED', 'CANCELLED'].includes(doc.status)) throw ApiError.badRequest('لا يمكن إلغاء طلب تم استلامه بالكامل أو إلغاؤه مسبقاً');

  doc.status = 'CANCELLED';
  await doc.save();

  await auditService.logAction({ req, action: 'CANCEL', entityType: 'PurchaseOrder', entityId: doc._id, description: `تم إلغاء طلب الشراء ${doc.docNo}` });
  sendSuccess(res, { message: 'تم إلغاء طلب الشراء', data: doc });
});

module.exports = { list, getById, create, approve, cancel };
