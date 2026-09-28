const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // 'disabled' is stricter than 'suspended' only in intent (platform admin
    // reserves it for longer-term/administrative shutoffs vs. a temporary
    // suspension) — both block login identically today (see
    // controllers/auth.controller.js's login, which already treats *any*
    // non-'active' status as blocked), so adding it here is purely additive
    // and never changes existing behavior for organizations left 'active' or
    // 'suspended'. 'trial_expired' is optional/manually-settable metadata,
    // not an automated expiry job.
    status: { type: String, enum: ['active', 'suspended', 'disabled', 'trial_expired'], default: 'active' },
    suspensionReason: { type: String, default: null },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Immutable historical fact (who registered the organization) — kept
    // separate from `ownerId` below, which is the *current* owner and can be
    // transferred. Existing organizations only ever had this field, so every
    // "who owns this org" read falls back to it when ownerId is unset (see
    // controllers/platform/organizations.controller.js) — no migration
    // required, and no existing organization's owner silently changes.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // --- Subscription metadata only — no payment gateway integration. ---
    plan: { type: String, enum: ['FREE', 'TRIAL', 'MONTHLY', 'YEARLY', 'CUSTOM'], default: 'FREE' },
    subscriptionStatus: { type: String, enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED'], default: 'ACTIVE' },
    trialEndsAt: { type: Date, default: null },
    subscriptionStartsAt: { type: Date, default: null },
    subscriptionEndsAt: { type: Date, default: null },

    // --- Per-organization limits. null/undefined = unlimited. Lowering a
    // limit below current usage never deletes anything — it only blocks
    // further creation (enforced in services/limitsService.js). ---
    limits: {
      maxUsers: { type: Number, default: null, min: 0 },
      maxWarehouses: { type: Number, default: null, min: 0 },
      maxProducts: { type: Number, default: null, min: 0 },
      maxStorageMB: { type: Number, default: null, min: 0 },
    },

    // --- Feature flags. Default every flag to `true` so upgrading existing
    // organizations never silently takes a feature away from them the day
    // this ships — a platform admin has to explicitly turn one off. ---
    features: {
      multiWarehouse: { type: Boolean, default: true },
      barcode: { type: Boolean, default: true },
      purchasing: { type: Boolean, default: true },
      advancedReports: { type: Boolean, default: true },
      inventoryCount: { type: Boolean, default: true },
      returns: { type: Boolean, default: true },
      backups: { type: Boolean, default: true },
      csvExport: { type: Boolean, default: true },
      pdfExport: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
