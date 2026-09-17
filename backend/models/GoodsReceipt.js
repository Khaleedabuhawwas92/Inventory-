const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    orderedQty: { type: Number, default: 0 }, // snapshot from the PO line, for display
    alreadyReceivedQty: { type: Number, default: 0 }, // snapshot from the PO line, for display
    receivingQty: { type: Number, required: true, min: 0.001 },
    unitCost: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    docNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    supplierInvoiceNo: { type: String, default: '' },
    notes: { type: String, default: '' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'CANCELLED'], default: 'DRAFT' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GoodsReceipt', goodsReceiptSchema);
