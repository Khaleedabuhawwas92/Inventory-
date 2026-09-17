const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    systemQty: { type: Number, required: true }, // snapshot taken when the count session starts
    physicalQty: { type: Number, default: null }, // filled in during counting; null = not yet counted
    unitCost: { type: Number, default: 0 }, // snapshot for the difference-value report
    countedAt: { type: Date, default: null },
    countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

// Status flow (spec §25): DRAFT -> COUNTING -> REVIEW -> APPROVED | CANCELLED
const inventoryCountSchema = new mongoose.Schema(
  {
    docNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    categoryFilter: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    notes: { type: String, default: '' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: ['DRAFT', 'COUNTING', 'REVIEW', 'APPROVED', 'CANCELLED'], default: 'DRAFT' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryCount', inventoryCountSchema);
