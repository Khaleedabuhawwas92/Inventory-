const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    // Roles are scoped manually (list/create/update in role.controller), not
    // via tenantPlugin's automatic query-scoping: User.role is populated
    // during login/authenticate *before* the tenant context can be
    // established (see utils/populateUserRefs.js), so Role reads must remain
    // reachable without an ambient organization context.
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    permissions: [{ type: String, trim: true }],
    isSystem: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
