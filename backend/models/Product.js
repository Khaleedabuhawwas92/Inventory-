const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    brand: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    purchasePrice: { type: Number, default: 0, min: 0 },
    salePrice: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    maxStock: { type: Number, default: 0, min: 0 },
    image: { type: String, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

productSchema.plugin(tenantPlugin);
productSchema.index({ nameAr: 'text', nameEn: 'text', sku: 'text', barcode: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ active: 1 });
productSchema.index({ organizationId: 1, sku: 1 }, { unique: true });
// `sparse` on a *compound* index only excludes a document when EVERY indexed
// field is missing — since organizationId is always present, that would
// never actually exclude anything, so a second product without a barcode in
// the same organization would collide on barcode: null. A partial index
// (indexing only documents where barcode genuinely exists) is the correct
// per-field-optional-uniqueness mechanism for a compound index.
productSchema.index(
  { organizationId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $exists: true } } }
);

module.exports = mongoose.model('Product', productSchema);
