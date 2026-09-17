const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceipt = require('../models/GoodsReceipt');
const StockReturn = require('../models/StockReturn');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const { search, active } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (active !== undefined && active !== '') filter.active = active === 'true';
  else if (!req.query.includeInactive) filter.active = true;

  const [items, total] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw ApiError.notFound('المورد غير موجود');
  sendSuccess(res, { data: supplier });
});

const create = asyncHandler(async (req, res) => {
  const { name, code, phone, whatsapp, email, taxNumber, address, contactPerson, notes } = req.body;
  const supplier = await Supplier.create({ name, code: code || undefined, phone, whatsapp, email, taxNumber, address, contactPerson, notes });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'Supplier', entityId: supplier._id, description: `تم إنشاء المورد ${supplier.name}` });
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء المورد بنجاح', data: supplier });
});

const update = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw ApiError.notFound('المورد غير موجود');

  const fields = ['name', 'phone', 'whatsapp', 'email', 'taxNumber', 'address', 'contactPerson', 'notes', 'active'];
  for (const f of fields) {
    if (req.body[f] !== undefined) supplier[f] = req.body[f];
  }
  await supplier.save();

  await auditService.logAction({ req, action: 'UPDATE', entityType: 'Supplier', entityId: supplier._id, description: `تم تعديل بيانات المورد ${supplier.name}` });
  sendSuccess(res, { message: 'تم تحديث بيانات المورد بنجاح', data: supplier });
});

// Aggregated purchase history for the supplier detail screen (§26): POs, GRNs, returns.
const purchaseHistory = asyncHandler(async (req, res) => {
  const supplierId = req.params.id;
  const [purchaseOrders, goodsReceipts, returns] = await Promise.all([
    PurchaseOrder.find({ supplier: supplierId }).populate('warehouse', 'name').sort({ createdAt: -1 }).limit(50),
    GoodsReceipt.find({ supplier: supplierId }).populate('warehouse', 'name').sort({ createdAt: -1 }).limit(50),
    StockReturn.find({ supplier: supplierId, type: 'TO_SUPPLIER' }).populate('warehouse', 'name').sort({ createdAt: -1 }).limit(50),
  ]);
  sendSuccess(res, { data: { purchaseOrders, goodsReceipts, returns } });
});

module.exports = { list, getById, create, update, purchaseHistory };
