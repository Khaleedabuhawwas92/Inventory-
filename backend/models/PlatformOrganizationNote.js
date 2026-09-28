const mongoose = require('mongoose');

// Platform-Admin-only internal notes about an organization (support/billing
// context) — never a tenant-facing model. Deliberately does NOT use
// utils/tenantPlugin.js: that plugin exists to auto-scope queries to the
// *ambient* organization for tenant requests, but this collection must never
// be reachable from any tenant-facing route in the first place (no tenant
// controller ever requires this file — that is what actually keeps it out of
// GET /settings, GET /organizations' own APIs, etc., not the plugin).
// controllers/platform/organizationDetail.controller.js is the only place
// that ever queries it, always with an explicit organizationId filter.
const platformOrganizationNoteSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    text: { type: String, required: true, trim: true },
    category: { type: String, enum: ['SUPPORT', 'BILLING', 'GENERAL'], default: 'GENERAL' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('PlatformOrganizationNote', platformOrganizationNoteSchema);
