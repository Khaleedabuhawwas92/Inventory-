const mongoose = require('mongoose');

const ADJUSTMENT_REASONS = ['DAMAGE', 'LOSS', 'WRONG_ENTRY', 'INVENTORY_COUNT', 'FOUND_STOCK', 'OTHER'];

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    systemQty: { type: Number, required: true }, // snapshot of balance at creation time, for audit
    newQty: { type: Number, required: true, min: 0 },
    reason: { type: String, enum: ADJUSTMENT_REASONS, required: true },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const stockAdjustmentSchema = new mongoose.Schema(
  {
    docNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    notes: { type: String, default: '' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'CANCELLED'], default: 'DRAFT' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockAdjustment', stockAdjustmentSchema);
module.exports.ADJUSTMENT_REASONS = ADJUSTMENT_REASONS;
