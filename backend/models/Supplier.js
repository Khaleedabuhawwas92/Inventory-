const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    email: { type: String, default: '' },
    taxNumber: { type: String, default: '' },
    address: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.plugin(tenantPlugin);
// See models/Product.js for why a partial index is used instead of `sparse`
// on this compound index.
supplierSchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $exists: true } } }
);

module.exports = mongoose.model('Supplier', supplierSchema);
