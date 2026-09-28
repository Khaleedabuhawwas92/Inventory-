const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const categorySchema = new mongoose.Schema(
  {
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, uppercase: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.plugin(tenantPlugin);
categorySchema.index({ parent: 1 });
// See models/Product.js for why a partial index is used instead of `sparse`
// on this compound index.
categorySchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $exists: true } } }
);

module.exports = mongoose.model('Category', categorySchema);
