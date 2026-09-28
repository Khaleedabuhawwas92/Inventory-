const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const unitSchema = new mongoose.Schema(
  {
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    shortCode: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

unitSchema.plugin(tenantPlugin);
unitSchema.index({ organizationId: 1, shortCode: 1 }, { unique: true });

module.exports = mongoose.model('Unit', unitSchema);
