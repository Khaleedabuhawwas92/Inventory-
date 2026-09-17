const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const StockBalance = require('../models/StockBalance');
const StockMovement = require('../models/StockMovement');
const InventoryCount = require('../models/InventoryCount');
const PurchaseOrder = require('../models/PurchaseOrder');

function dateRangeFilter(from, to, field = 'createdAt') {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return { [field]: range };
}

// Stock Reports -------------------------------------------------------------

const currentStock = asyncHandler(async (req, res) => {
  const { warehouse, category, search } = req.query;

  const match = {};
  if (warehouse) match.warehouse = require('mongoose').Types.ObjectId.createFromHexString(warehouse);

  const pipeline = [
    { $match: match },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $lookup: { from: 'categories', localField: 'product.category', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
  ];
  if (category) pipeline.push({ $match: { 'product.category': require('mongoose').Types.ObjectId.createFromHexString(category) } });
  if (search) pipeline.push({ $match: { $or: [{ 'product.nameAr': { $regex: search, $options: 'i' } }, { 'product.sku': { $regex: search, $options: 'i' } }] } });
  pipeline.push({
    $project: {
      quantity: 1, reservedQuantity: 1, averageCost: 1,
      value: { $multiply: ['$quantity', '$averageCost'] },
      'product.nameAr': 1, 'product.sku': 1, 'warehouse.name': 1, 'category.nameAr': 1,
    },
  });
  pipeline.push({ $sort: { 'product.nameAr': 1 } });

  const results = await StockBalance.aggregate(pipeline);
  sendSuccess(res, { data: results });
});

const stockValuation = asyncHandler(async (req, res) => {
  const { warehouse } = req.query;
  const match = {};
  if (warehouse) match.warehouse = require('mongoose').Types.ObjectId.createFromHexString(warehouse);

  const results = await StockBalance.aggregate([
    { $match: match },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $project: { quantity: 1, averageCost: 1, value: { $multiply: ['$quantity', '$averageCost'] }, 'product.nameAr': 1, 'product.sku': 1, 'warehouse.name': 1 } },
    { $sort: { value: -1 } },
  ]);

  const total = results.reduce((sum, r) => sum + r.value, 0);
  sendSuccess(res, { data: results, meta: { total } });
});

const lowStock = asyncHandler(async (req, res) => {
  const results = await StockBalance.aggregate([
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $match: { $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$product.minStock'] }, { $gt: ['$product.minStock', 0] }] } } },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $project: { quantity: 1, 'product.nameAr': 1, 'product.sku': 1, 'product.minStock': 1, 'warehouse.name': 1 } },
    { $sort: { quantity: 1 } },
  ]);
  sendSuccess(res, { data: results });
});

const outOfStock = asyncHandler(async (req, res) => {
  const results = await StockBalance.aggregate([
    { $match: { quantity: { $lte: 0 } } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $project: { quantity: 1, 'product.nameAr': 1, 'product.sku': 1, 'warehouse.name': 1 } },
  ]);
  sendSuccess(res, { data: results });
});

// Products with stock on hand but zero movement in the last N days (default 90).
const deadStock = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const recentlyMovedProductIds = await StockMovement.distinct('product', { createdAt: { $gte: since } });

  const results = await StockBalance.aggregate([
    { $match: { quantity: { $gt: 0 }, product: { $nin: recentlyMovedProductIds } } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $project: { quantity: 1, averageCost: 1, 'product.nameAr': 1, 'product.sku': 1, 'warehouse.name': 1 } },
  ]);
  sendSuccess(res, { data: results, meta: { days } });
});

// Movement Reports ------------------------------------------------------------

// Fast/slow movers by total movement quantity within a period.
const productMovementRanking = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const direction = req.query.direction === 'slow' ? 1 : -1;

  const results = await StockMovement.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$product', movementCount: { $sum: 1 }, totalQuantity: { $sum: '$quantity' } } },
    { $sort: { totalQuantity: direction === -1 ? -1 : 1 } },
    { $limit: 20 },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $project: { movementCount: 1, totalQuantity: 1, 'product.nameAr': 1, 'product.sku': 1 } },
  ]);
  sendSuccess(res, { data: results, meta: { days } });
});

// Inventory Reports -----------------------------------------------------------

// Flattened, filterable list of every item-level difference across approved
// inventory counts — feeds Shortage / Surplus / Value Difference reports.
const inventoryDifferences = asyncHandler(async (req, res) => {
  const { warehouse, from, to, direction } = req.query;
  const filter = { status: 'APPROVED', ...dateRangeFilter(from, to, 'approvedAt') };
  if (warehouse) filter.warehouse = warehouse;

  const sessions = await InventoryCount.find(filter).populate('warehouse', 'name').populate('items.product', 'nameAr sku');

  let rows = [];
  for (const session of sessions) {
    for (const item of session.items) {
      const difference = item.physicalQty - item.systemQty;
      if (difference === 0) continue;
      rows.push({
        docNo: session.docNo,
        date: session.approvedAt,
        warehouse: session.warehouse?.name,
        product: item.product?.nameAr,
        sku: item.product?.sku,
        systemQty: item.systemQty,
        physicalQty: item.physicalQty,
        difference,
        differenceValue: difference * item.unitCost,
      });
    }
  }

  if (direction === 'shortage') rows = rows.filter((r) => r.difference < 0);
  if (direction === 'surplus') rows = rows.filter((r) => r.difference > 0);

  sendSuccess(res, { data: rows });
});

// Supplier Reports --------------------------------------------------------------

const supplierPurchases = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = dateRangeFilter(from, to, 'orderDate');

  const orders = await PurchaseOrder.find(filter).populate('supplier', 'name');
  const bySupplier = new Map();
  for (const po of orders) {
    const key = po.supplier?._id?.toString() || 'unknown';
    if (!bySupplier.has(key)) bySupplier.set(key, { supplier: po.supplier?.name, orderCount: 0, totalValue: 0 });
    const entry = bySupplier.get(key);
    entry.orderCount += 1;
    entry.totalValue += po.total;
  }

  sendSuccess(res, { data: Array.from(bySupplier.values()) });
});

module.exports = {
  currentStock,
  stockValuation,
  lowStock,
  outOfStock,
  deadStock,
  productMovementRanking,
  inventoryDifferences,
  supplierPurchases,
};
