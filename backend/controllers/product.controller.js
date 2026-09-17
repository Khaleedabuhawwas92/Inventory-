const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { nextSequence } = require('../services/counterService');
const { publicUrlFor } = require('../middleware/upload');
const auditService = require('../services/auditService');
const inventoryService = require('../services/inventoryService');

const list = asyncHandler(async (req, res) => {
  const { search, category, active, sortBy, sortDir } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (search) {
    filter.$or = [
      { nameAr: { $regex: search, $options: 'i' } },
      { nameEn: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }
  if (category) filter.category = category;
  if (active !== undefined && active !== '') filter.active = active === 'true';

  const sort = { [sortBy || 'createdAt']: sortDir === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    Product.find(filter).populate('category', 'nameAr').populate('unit', 'nameAr shortCode').sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'nameAr').populate('unit', 'nameAr shortCode');
  if (!product) throw ApiError.notFound('الصنف غير موجود');
  // Current stock by warehouse & movement history are added once the Inventory Engine phase is implemented.
  sendSuccess(res, { data: product });
});

const create = asyncHandler(async (req, res) => {
  const { barcode, nameAr, nameEn, category, unit, brand, description, purchasePrice, salePrice, minStock, maxStock } = req.body;

  if (barcode) {
    const exists = await Product.findOne({ barcode });
    if (exists) throw ApiError.conflict('الباركود مستخدم مسبقاً لصنف آخر');
  }

  const seq = await nextSequence('product-sku');
  const sku = `P-${seq}`;

  const product = await Product.create({
    sku, barcode: barcode || undefined, nameAr, nameEn, category, unit, brand, description,
    purchasePrice, salePrice, minStock, maxStock, createdBy: req.user._id,
  });

  await auditService.logAction({ req, action: 'CREATE', entityType: 'Product', entityId: product._id, description: `تم إنشاء الصنف ${product.nameAr} (${product.sku})` });
  sendSuccess(res, { statusCode: 201, message: 'تم إنشاء الصنف بنجاح', data: product });
});

const update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('الصنف غير موجود');

  const before = product.toObject();
  const { barcode, nameAr, nameEn, category, unit, brand, description, purchasePrice, salePrice, minStock, maxStock, active } = req.body;

  if (barcode !== undefined && barcode !== product.barcode) {
    if (barcode) {
      const exists = await Product.findOne({ barcode, _id: { $ne: product._id } });
      if (exists) throw ApiError.conflict('الباركود مستخدم مسبقاً لصنف آخر');
    }
    product.barcode = barcode || undefined;
  }
  if (nameAr !== undefined) product.nameAr = nameAr;
  if (nameEn !== undefined) product.nameEn = nameEn;
  if (category !== undefined) product.category = category;
  if (unit !== undefined) product.unit = unit;
  if (brand !== undefined) product.brand = brand;
  if (description !== undefined) product.description = description;
  if (purchasePrice !== undefined) product.purchasePrice = purchasePrice;
  if (salePrice !== undefined) product.salePrice = salePrice;
  if (minStock !== undefined) product.minStock = minStock;
  if (maxStock !== undefined) product.maxStock = maxStock;
  if (active !== undefined) product.active = active;

  await product.save();

  await auditService.logAction({
    req, action: 'UPDATE', entityType: 'Product', entityId: product._id,
    description: `تم تعديل الصنف ${product.nameAr}`, oldValue: before, newValue: product.toObject(),
  });
  sendSuccess(res, { message: 'تم تحديث الصنف بنجاح', data: product });
});

const uploadImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('الصنف غير موجود');
  if (!req.file) throw ApiError.badRequest('لم يتم إرفاق صورة');

  product.image = publicUrlFor('products', req.file.filename);
  await product.save();

  sendSuccess(res, { message: 'تم رفع صورة الصنف بنجاح', data: { image: product.image } });
});

const stockByWarehouse = asyncHandler(async (req, res) => {
  const balances = await inventoryService.getStockByWarehouses(req.params.id);
  sendSuccess(res, { data: balances });
});

const movementHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const filter = { product: req.params.id };

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('warehouse', 'name code')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const findByBarcode = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ barcode: req.params.barcode, active: true })
    .populate('category', 'nameAr')
    .populate('unit', 'nameAr shortCode');
  if (!product) throw ApiError.notFound('لم يتم العثور على صنف بهذا الباركود');
  sendSuccess(res, { data: product });
});

module.exports = { list, getById, create, update, uploadImage, findByBarcode, stockByWarehouse, movementHistory };
