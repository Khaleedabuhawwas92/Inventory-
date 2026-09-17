const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Warehouse = require('../models/Warehouse');
const StockMovement = require('../models/StockMovement');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceipt = require('../models/GoodsReceipt');

const RESULT_LIMIT = 5;

const globalSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return sendSuccess(res, { data: [] });

  const regex = { $regex: q, $options: 'i' };
  const permissions = req.permissions || [];
  const isSuperAdmin = req.user.role?.name === 'super-admin';
  const can = (p) => isSuperAdmin || permissions.includes(p);

  const tasks = [];

  if (can('products.view')) {
    tasks.push(
      Product.find({ $or: [{ nameAr: regex }, { nameEn: regex }, { sku: regex }, { barcode: regex }] })
        .limit(RESULT_LIMIT)
        .select('nameAr sku barcode')
        .then((items) =>
          items.map((p) => ({ type: 'product', label: p.nameAr, sublabel: p.sku, route: `/products/${p._id}` }))
        )
    );
  }
  if (can('suppliers.view')) {
    tasks.push(
      Supplier.find({ name: regex }).limit(RESULT_LIMIT).select('name').then((items) =>
        items.map((s) => ({ type: 'supplier', label: s.name, sublabel: 'مورد', route: `/suppliers/${s._id}` }))
      )
    );
  }
  if (can('warehouses.view')) {
    tasks.push(
      Warehouse.find({ $or: [{ name: regex }, { code: regex }] }).limit(RESULT_LIMIT).select('name code').then((items) =>
        items.map((w) => ({ type: 'warehouse', label: w.name, sublabel: w.code, route: `/warehouses/${w._id}` }))
      )
    );
  }
  if (can('stock.view')) {
    tasks.push(
      StockMovement.find({ movementNo: regex }).limit(RESULT_LIMIT).select('movementNo type').then((items) =>
        items.map((m) => ({ type: 'movement', label: m.movementNo, sublabel: 'حركة مخزون', route: `/stock/movements` }))
      )
    );
  }
  if (can('purchases.view')) {
    tasks.push(
      PurchaseOrder.find({ docNo: regex }).limit(RESULT_LIMIT).select('docNo').then((items) =>
        items.map((p) => ({ type: 'purchase-order', label: p.docNo, sublabel: 'طلب شراء', route: `/purchases/${p._id}` }))
      )
    );
    tasks.push(
      GoodsReceipt.find({ docNo: regex }).limit(RESULT_LIMIT).select('docNo').then((items) =>
        items.map((g) => ({ type: 'goods-receipt', label: g.docNo, sublabel: 'سند استلام', route: `/goods-receipts/${g._id}` }))
      )
    );
  }

  const grouped = await Promise.all(tasks);
  const results = grouped.flat();
  sendSuccess(res, { data: results });
});

module.exports = { globalSearch };
