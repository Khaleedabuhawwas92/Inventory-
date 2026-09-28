const ApiError = require('../utils/ApiError');

// Gates the platform admin control panel (backend/routes/platform.routes.js)
// and whole-database backup/restore — actions that operate *across* every
// organization at once, so they can never be gated by any organization's own
// role system (each organization has its own independent roles — see
// models/Role.js — and a role literally named 'admin' or 'super-admin' only
// ever has authority within its own organization).
//
// `isPlatformAdmin` is a separate, platform-level flag on User that no
// tenant-facing API ever sets — only the multi-tenant migration script set
// it (for the accounts that already had system-wide access before
// organizations existed) and the platform APIs themselves (organizations
// controller does not expose a way to grant it, by design — see
// controllers/platform/README notes inline). Never check role.name here.
module.exports = function requirePlatformAdmin(req, res, next) {
  if (req.user?.isPlatformAdmin !== true) {
    return next(ApiError.forbidden('هذا الإجراء متاح لمدير المنصة (Platform Admin) فقط'));
  }
  next();
};
