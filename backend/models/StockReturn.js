const mongoose = require('mongoose');

// TO_SUPPLIER: defective/excess goods sent back to a supplier (stock leaves the warehouse).
// FROM_CUSTOMER: customer or internal return of previously issued goods (stock re-enters the warehouse).
const RETURN_TYPES = ['TO_SUPPLIER', 'FROM_CUSTOMER'];

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0.001 },
  },
  { _id: false }
);

const stockReturnSchema = new mongoose.Schema(
  {
    docNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    type: { type: String, enum: RETURN_TYPES, required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    // Links back to the original StockIn (supplier returns) or StockOut
    // (customer/internal returns) when the user picks one, per spec §23.
    originalReferenceType: { type: String, enum: ['StockIn', 'StockOut', null], default: null },
    originalReferenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reason: { type: String, default: '' },
    notes: { type: String, default: '' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'CANCELLED'], default: 'DRAFT' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockReturn', stockReturnSchema);
module.exports.RETURN_TYPES = RETURN_TYPES;
