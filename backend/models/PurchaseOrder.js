const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitCost: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    receivedQty: { type: Number, default: 0 }, // running total received via goods receipts
  },
  { _id: false }
);

itemSchema.virtual('total').get(function total() {
  return this.quantity * this.unitCost - this.discount + this.tax;
});

// Status flow (spec §27): DRAFT -> PENDING -> APPROVED -> PARTIALLY_RECEIVED -> RECEIVED
// (or CANCELLED at any point before fully received).
const purchaseOrderSchema = new mongoose.Schema(
  {
    docNo: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
      default: 'DRAFT',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

purchaseOrderSchema.virtual('total').get(function total() {
  // `items` is absent when this document was fetched with a partial field
  // projection (e.g. GoodsReceipt populates PurchaseOrder with only `docNo`)
  // — the virtual must not assume the full document was loaded.
  if (!this.items) return 0;
  return this.items.reduce((sum, item) => sum + item.quantity * item.unitCost - item.discount + item.tax, 0);
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
