const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const Supplier = require('../models/Supplier');
const StockBalance = require('../models/StockBalance');
const StockMovement = require('../models/StockMovement');

const summary = asyncHandler(async (req, res) => {
  const [productCount, warehouseCount, supplierCount, valuationAgg, lowStockCount, outOfStockCount] = await Promise.all([
    Product.countDocuments({ active: true }),
    Warehouse.countDocuments({ status: 'active' }),
    Supplier.countDocuments({ active: true }),
    StockBalance.aggregate([
      { $group: { _id: null, totalQuantity: { $sum: '$quantity' }, totalValue: { $sum: { $multiply: ['$quantity', '$averageCost'] } } } },
    ]),
    // Low stock: quantity <= product.minStock (and > 0). Computed via lookup since minStock lives on Product.
    StockBalance.aggregate([
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: { $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$product.minStock'] }, { $gt: ['$product.minStock', 0] }] } } },
      { $count: 'count' },
    ]),
    StockBalance.aggregate([{ $match: { quantity: { $lte: 0 } } }, { $count: 'count' }]),
  ]);

  sendSuccess(res, {
    data: {
      totalProducts: productCount,
      totalWarehouses: warehouseCount,
      totalSuppliers: supplierCount,
      totalStockQuantity: valuationAgg[0]?.totalQuantity || 0,
      totalInventoryValue: valuationAgg[0]?.totalValue || 0,
      lowStockCount: lowStockCount[0]?.count || 0,
      outOfStockCount: outOfStockCount[0]?.count || 0,
    },
  });
});

const recentMovements = asyncHandler(async (req, res) => {
  const { type, limit } = req.query;
  const filter = type ? { type } : {};
  const movements = await StockMovement.find(filter)
    .populate('product', 'nameAr sku')
    .populate('warehouse', 'name')
    .populate('createdBy', 'fullName')
    .sort({ createdAt: -1 })
    .limit(Math.min(parseInt(limit, 10) || 5, 20));
  sendSuccess(res, { data: movements });
});

const lowStockProducts = asyncHandler(async (req, res) => {
  const results = await StockBalance.aggregate([
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $match: { $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$product.minStock'] }, { $gt: ['$product.minStock', 0] }] } } },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $project: { quantity: 1, 'product.nameAr': 1, 'product.sku': 1, 'product.minStock': 1, 'warehouse.name': 1 } },
    { $limit: 10 },
  ]);
  sendSuccess(res, { data: results });
});

const outOfStockProducts = asyncHandler(async (req, res) => {
  const results = await StockBalance.aggregate([
    { $match: { quantity: { $lte: 0 } } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $project: { quantity: 1, 'product.nameAr': 1, 'product.sku': 1, 'warehouse.name': 1 } },
    { $limit: 10 },
  ]);
  sendSuccess(res, { data: results });
});

// Most/least active products by movement count over the last 30 days.
const productActivity = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const results = await StockMovement.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$product', movementCount: { $sum: 1 }, totalQuantity: { $sum: '$quantity' } } },
    { $sort: { movementCount: -1 } },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $project: { movementCount: 1, totalQuantity: 1, 'product.nameAr': 1, 'product.sku': 1 } },
  ]);

  sendSuccess(res, {
    data: {
      mostActive: results.slice(0, 5),
      leastActive: results.slice(-5).reverse(),
    },
  });
});

// Daily IN vs OUT quantity totals for the last 7 days (for a simple bar/line chart).
//
// Computed entirely in UTC calendar days: MongoDB's $dateToString defaults to
// UTC, so building the day keys with local-timezone Date methods (setDate/
// setHours) and only converting to UTC at the very end (toISOString) shifts
// the window by the server's UTC offset — e.g. at any local time before UTC
// midnight in a UTC+ timezone, "today" at local midnight is still yesterday
// in UTC, silently dropping today's data from the last bucket.
const movementTrend = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(todayUTC);
  since.setUTCDate(since.getUTCDate() - 6);

  const results = await StockMovement.aggregate([
    { $match: { createdAt: { $gte: since }, type: { $in: ['IN', 'OUT'] } } },
    {
      $group: {
        _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' },
        total: { $sum: '$quantity' },
      },
    },
  ]);

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const inTotal = results.find((r) => r._id.day === key && r._id.type === 'IN')?.total || 0;
    const outTotal = results.find((r) => r._id.day === key && r._id.type === 'OUT')?.total || 0;
    days.push({ date: key, in: inTotal, out: outTotal });
  }

  sendSuccess(res, { data: days });
});

const valueByWarehouse = asyncHandler(async (req, res) => {
  const results = await StockBalance.aggregate([
    { $group: { _id: '$warehouse', value: { $sum: { $multiply: ['$quantity', '$averageCost'] } }, quantity: { $sum: '$quantity' } } },
    { $lookup: { from: 'warehouses', localField: '_id', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    { $project: { value: 1, quantity: 1, 'warehouse.name': 1 } },
    { $sort: { value: -1 } },
  ]);
  sendSuccess(res, { data: results });
});

module.exports = { summary, recentMovements, lowStockProducts, outOfStockProducts, productActivity, movementTrend, valueByWarehouse };
