const mongoose = require('mongoose');

// One document per counter key (e.g. "product-sku", "IN-2026"). `seq` is
// incremented atomically via findOneAndUpdate($inc), which is safe under
// concurrent requests even without a transaction.
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
