const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const StockMovement = require('../models/StockMovement');

const list = asyncHandler(async (req, res) => {
  const { product, warehouse, type, referenceType, from, to } = req.query;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 30 });

  const filter = {};
  if (product) filter.product = product;
  if (warehouse) filter.warehouse = warehouse;
  if (type) filter.type = type;
  if (referenceType) filter.referenceType = referenceType;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('product', 'nameAr sku')
      .populate('warehouse', 'name')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

module.exports = { list };
