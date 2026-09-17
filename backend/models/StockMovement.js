const mongoose = require('mongoose');

const MOVEMENT_TYPES = [
  'OPENING', 'IN', 'OUT',
  'TRANSFER_OUT', 'TRANSFER_IN',
  'RETURN_IN', 'RETURN_OUT',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
  'INVENTORY_ADJUSTMENT',
  'REVERSAL',
];

// Append-only ledger: the single source of truth for all stock history.
// Never mutate or delete a movement after creation — cancellations create a
// REVERSAL movement instead (see spec §34 delete policy).
const stockMovementSchema = new mongoose.Schema(
  {
    movementNo: { type: String, required: true, unique: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    sourceWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    destinationWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, default: 0 },
    beforeQty: { type: Number, required: true },
    afterQty: { type: Number, required: true },
    referenceType: { type: String, default: null },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    reason: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ product: 1, warehouse: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
module.exports.MOVEMENT_TYPES = MOVEMENT_TYPES;
