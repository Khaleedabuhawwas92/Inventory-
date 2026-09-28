const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const invitationSchema = new mongoose.Schema(
  {
    // Globally unique on purpose: a joining user looks an invitation up by
    // code alone, before they belong to any organization, so the lookup must
    // resolve unambiguously across the whole system (see onboarding.controller).
    code: { type: String, required: true, unique: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: null }, // optional: restrict the invite to one address
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

invitationSchema.plugin(tenantPlugin);
invitationSchema.index({ organizationId: 1 });

invitationSchema.methods.isUsable = function isUsable() {
  return this.active && !this.usedAt && !this.revokedAt && this.expiresAt > new Date();
};

module.exports = mongoose.model('Invitation', invitationSchema);
