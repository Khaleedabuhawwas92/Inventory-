const ApiError = require('../utils/ApiError');

// Super Admin bypasses all permission checks.
const SUPER_ADMIN_ROLE_NAME = 'super-admin';

function permit(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    if (req.user.role?.name === SUPER_ADMIN_ROLE_NAME) return next();

    const userPermissions = req.permissions || [];
    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      return next(ApiError.forbidden('ليس لديك صلاحية للقيام بهذا الإجراء'));
    }

    next();
  };
}

module.exports = permit;
