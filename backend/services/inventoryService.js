const ApiError = require('../utils/ApiError');
const StockBalance = require('../models/StockBalance');
const StockMovement = require('../models/StockMovement');
const Settings = require('../models/Settings');
const Product = require('../models/Product');
const { nextDocumentNumber } = require('./counterService');
const notificationService = require('./notificationService');

// Fixed-direction movement types: the sign of the balance change is implied by
// the type itself, so callers only ever pass a positive `quantity`.
// INVENTORY_ADJUSTMENT and REVERSAL can go either way, so those callers pass a
// signed `delta` directly instead (see adjustment()/reversal() below).
const DIRECTION = {
  OPENING: 1,
  IN: 1,
  OUT: -1,
  TRANSFER_OUT: -1,
  TRANSFER_IN: 1,
  RETURN_IN: 1,
  RETURN_OUT: -1,
  ADJUSTMENT_IN: 1,
  ADJUSTMENT_OUT: -1,
};

async function getAllowNegativeStock() {
  const settings = await Settings.findOne().select('inventory.allowNegativeStock');
  return !!settings?.inventory?.allowNegativeStock;
}

// The single choke point for every stock quantity change in the system.
// Nothing outside this file may write to StockBalance.quantity or create a
// StockMovement — see spec §17. `session` is optional (falls back to
// non-transactional writes on standalone MongoDB, see utils/withTransaction).
async function recordMovement(
  {
    type,
    delta, // signed change in quantity, e.g. +50 or -20
    product,
    warehouse,
    unitCost = 0,
    sourceWarehouse = null,
    destinationWarehouse = null,
    referenceType = null,
    referenceId = null,
    reason = '',
    notes = '',
    createdBy,
    approvedBy = null,
    allowNegative = null, // override; when null, falls back to system settings
  },
  session = null
) {
  if (!delta) throw ApiError.badRequest('لا يمكن تسجيل حركة مخزون بكمية صفر');

  // Apply the quantity change as an atomic $inc rather than read-modify-write:
  // on standalone MongoDB (no transactions, see utils/withTransaction) a
  // find-then-save round trip races under concurrent writes to the same
  // product+warehouse and silently loses updates. $inc is atomic at the
  // single-document level regardless of transaction support, so concurrent
  // callers always end up with the correct summed quantity. `new: false`
  // returns the pre-increment snapshot so we still get an accurate beforeQty.
  const beforeDoc = await StockBalance.findOneAndUpdate(
    { product, warehouse },
    { $inc: { quantity: delta }, $setOnInsert: { reservedQuantity: 0, averageCost: 0 } },
    { new: false, upsert: true, session }
  );
  const beforeQty = beforeDoc ? beforeDoc.quantity : 0;
  const afterQty = beforeQty + delta;

  const negativeAllowed = allowNegative !== null ? allowNegative : await getAllowNegativeStock();
  if (afterQty < 0 && !negativeAllowed) {
    // Undo the increment we already applied, then reject.
    await StockBalance.updateOne({ product, warehouse }, { $inc: { quantity: -delta } }, { session });
    throw ApiError.badRequest(
      `الكمية المتوفرة غير كافية (المتوفر: ${beforeQty}، المطلوب: ${Math.abs(delta)})`
    );
  }

  const beforeAverageCost = beforeDoc ? beforeDoc.averageCost : 0;
  let averageCost = beforeAverageCost;
  let costUsed = unitCost;
  if (delta > 0 && unitCost > 0) {
    // Weighted average cost recalculation on every stock increase (spec §50).
    const basisQty = beforeQty > 0 ? beforeQty : 0;
    averageCost = (basisQty * beforeAverageCost + delta * unitCost) / (basisQty + delta);
    await StockBalance.updateOne({ product, warehouse }, { $set: { averageCost } }, { session });
  } else if (delta < 0) {
    // Outgoing stock is costed at the current average (for COGS/valuation), not at unitCost.
    costUsed = beforeAverageCost;
  }

  const movementNo = await nextDocumentNumber('MOV');
  const [movement] = await StockMovement.create(
    [
      {
        movementNo,
        type,
        product,
        warehouse,
        sourceWarehouse,
        destinationWarehouse,
        quantity: Math.abs(delta),
        unitCost: costUsed,
        beforeQty,
        afterQty,
        referenceType,
        referenceId,
        reason,
        notes,
        createdBy,
        approvedBy,
      },
    ],
    { session }
  );

  const balance = await StockBalance.findOne({ product, warehouse }).session(session);

  // Best-effort stock-level alert; must never fail or block the movement itself.
  try {
    const productDoc = await Product.findById(product).select('nameAr minStock');
    if (productDoc) {
      await notificationService.checkStockThresholds({
        product, warehouse, quantity: afterQty, minStock: productDoc.minStock, productName: productDoc.nameAr,
      });
    }
  } catch (err) {
    console.error('[inventoryService] Failed to check stock thresholds:', err.message);
  }

  return { movement, balance };
}

function stockIn(params, session) {
  return recordMovement({ ...params, type: 'IN', delta: Math.abs(params.quantity) }, session);
}

function stockOut(params, session) {
  return recordMovement({ ...params, type: 'OUT', delta: -Math.abs(params.quantity) }, session);
}

function openingStock(params, session) {
  return recordMovement({ ...params, type: 'OPENING', delta: Math.abs(params.quantity), allowNegative: true }, session);
}

function transferOut(params, session) {
  return recordMovement(
    { ...params, type: 'TRANSFER_OUT', delta: -Math.abs(params.quantity), destinationWarehouse: params.destinationWarehouse },
    session
  );
}

function transferIn(params, session) {
  return recordMovement(
    { ...params, type: 'TRANSFER_IN', delta: Math.abs(params.quantity), sourceWarehouse: params.sourceWarehouse, allowNegative: true },
    session
  );
}

function returnIn(params, session) {
  return recordMovement({ ...params, type: 'RETURN_IN', delta: Math.abs(params.quantity) }, session);
}

function returnOut(params, session) {
  return recordMovement({ ...params, type: 'RETURN_OUT', delta: -Math.abs(params.quantity) }, session);
}

// Direct stock adjustment (spec §24). `delta` is signed: positive = found stock, negative = loss/damage.
function adjustment(params, session) {
  const type = params.delta >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
  return recordMovement({ ...params, type, delta: params.delta }, session);
}

// Correction generated when an inventory count is approved (spec §25).
function inventoryAdjustment(params, session) {
  return recordMovement({ ...params, type: 'INVENTORY_ADJUSTMENT', delta: params.delta }, session);
}

// Cancels an approved movement by posting the exact opposite delta, preserving
// full history instead of deleting anything (spec §34 delete policy).
//
// Deliberately does NOT force allowNegative: a reversal that removes stock
// (undoing an old IN) still goes through the normal negative-stock check. If
// the quantity was already consumed by later movements, blocking the reversal
// is correct — silently letting it through would corrupt the balance instead.
async function reverseMovement(movementId, { reason = 'إلغاء عملية', createdBy }, session = null) {
  const original = await StockMovement.findById(movementId).session(session);
  if (!original) throw ApiError.notFound('الحركة الأصلية غير موجودة');

  const sign = original.afterQty >= original.beforeQty ? -1 : 1;
  const delta = sign * original.quantity;

  return recordMovement(
    {
      type: 'REVERSAL',
      delta,
      product: original.product,
      warehouse: original.warehouse,
      unitCost: original.unitCost,
      referenceType: 'StockMovement',
      referenceId: original._id,
      reason,
      createdBy,
    },
    session
  );
}

async function getCurrentStock(product, warehouse) {
  const balance = await StockBalance.findOne({ product, warehouse });
  return balance || { product, warehouse, quantity: 0, reservedQuantity: 0, averageCost: 0 };
}

async function getStockByWarehouses(product) {
  return StockBalance.find({ product }).populate('warehouse', 'name code');
}

module.exports = {
  recordMovement,
  stockIn,
  stockOut,
  openingStock,
  transferOut,
  transferIn,
  returnIn,
  returnOut,
  adjustment,
  inventoryAdjustment,
  reverseMovement,
  getCurrentStock,
  getStockByWarehouses,
};
