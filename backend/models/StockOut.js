const mongoose = require('mongoose');

const OUTPUT_TYPES = ['INTERNAL_USE', 'SALE', 'DAMAGE', 'MAINTENANCE', 'SAMPLE', 'OTHER'];

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0.001 },
  },
  { _id: false }
);

const stockOutSchema = new mongoose.Schema(
  {
    docNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    outputType: { type: String, enum: OUTPUT_TYPES, required: true },
    receivingParty: { type: String, default: '' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'CANCELLED'], default: 'DRAFT' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockOut', stockOutSchema);
module.exports.OUTPUT_TYPES = OUTPUT_TYPES;
