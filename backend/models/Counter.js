const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

// One document per organization per counter key (e.g. "product-sku",
// "IN-2026") — each organization gets its own independent sequence. `seq` is
// incremented atomically via findOneAndUpdate($inc), which is safe under
// concurrent requests even without a transaction.
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.plugin(tenantPlugin);
counterSchema.index({ organizationId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
