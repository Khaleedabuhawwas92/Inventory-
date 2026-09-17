const mongoose = require('mongoose');

// Fast-read current-quantity cache. The authoritative history lives in
// StockMovement; this collection exists purely so "current stock" reads don't
// have to aggregate the whole movement log on every request.
const stockBalanceSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    averageCost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

stockBalanceSchema.virtual('availableQuantity').get(function availableQuantity() {
  return this.quantity - this.reservedQuantity;
});
stockBalanceSchema.set('toJSON', { virtuals: true });
stockBalanceSchema.set('toObject', { virtuals: true });

stockBalanceSchema.index({ product: 1, warehouse: 1 }, { unique: true });

module.exports = mongoose.model('StockBalance', stockBalanceSchema);
