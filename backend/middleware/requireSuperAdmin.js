const ApiError = require('../utils/ApiError');

// Some actions (restoring a backup, wiping data) are deliberately restricted
// to the Super Admin role specifically — settings.manage is not enough — per
// spec §52 ("Restore mechanism مع صلاحية Super Admin فقط").
module.exports = function requireSuperAdmin(req, res, next) {
  if (req.user?.role?.name !== 'super-admin') {
    return next(ApiError.forbidden('هذا الإجراء متاح لمدير النظام العام (Super Admin) فقط'));
  }
  next();
};
