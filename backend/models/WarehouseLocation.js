const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const warehouseLocationSchema = new mongoose.Schema(
  {
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    zone: { type: String, trim: true, default: '' },
    aisle: { type: String, trim: true, default: '' },
    rack: { type: String, trim: true, default: '' },
    shelf: { type: String, trim: true, default: '' },
    code: { type: String, required: true, trim: true, uppercase: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

warehouseLocationSchema.plugin(tenantPlugin);
warehouseLocationSchema.index({ organizationId: 1 });
warehouseLocationSchema.index({ warehouse: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('WarehouseLocation', warehouseLocationSchema);
