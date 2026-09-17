const mongoose = require('mongoose');

// Singleton document holding company/system configuration.
const settingsSchema = new mongoose.Schema(
  {
    company: {
      name: { type: String, default: '' },
      logo: { type: String, default: null },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      taxNumber: { type: String, default: '' },
    },
    system: {
      currency: { type: String, default: 'JOD' },
      language: { type: String, default: 'ar' },
      timezone: { type: String, default: 'Asia/Amman' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
    },
    inventory: {
      allowNegativeStock: { type: Boolean, default: false },
      defaultWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
      lowStockAlerts: { type: Boolean, default: true },
      costingMethod: { type: String, enum: ['WEIGHTED_AVERAGE'], default: 'WEIGHTED_AVERAGE' },
    },
    documents: {
      prefixes: {
        stockIn: { type: String, default: 'IN' },
        stockOut: { type: String, default: 'OUT' },
        transfer: { type: String, default: 'TRF' },
        adjustment: { type: String, default: 'ADJ' },
        inventoryCount: { type: String, default: 'INVCOUNT' },
        purchaseOrder: { type: String, default: 'PO' },
        goodsReceipt: { type: String, default: 'GRN' },
      },
    },
    barcode: {
      labelWidthMm: { type: Number, default: 40 },
      labelHeightMm: { type: Number, default: 25 },
      showPrice: { type: Boolean, default: true },
    },
    backup: {
      autoBackupEnabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
      lastAutoBackupAt: { type: Date, default: null },
    },
    setupCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
