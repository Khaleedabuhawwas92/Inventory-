const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const tokenService = require('../services/tokenService');
const tenantContext = require('../utils/tenantContext');
const populateUserRefs = require('../utils/populateUserRefs');
const User = require('../models/User');

async function loadUserFromToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'انتهت صلاحية رمز الدخول' : 'رمز الدخول غير صالح'
    );
  }

  // Fetch the user first, unscoped — its own organizationId is not known
  // until after this lookup, and Role/Warehouse populate() queries below
  // must run inside that organization's tenant context (see
  // utils/populateUserRefs.js for why populate can't happen before this).
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('المستخدم غير موجود');
  if (user.status !== 'active') throw ApiError.forbidden('تم تعطيل هذا الحساب');

  await populateUserRefs(user);
  return user;
}

const authenticate = asyncHandler(async (req, res, next) => {
  const user = await loadUserFromToken(req);
  if (!user) throw ApiError.unauthorized('الرجاء تسجيل الدخول للمتابعة');

  req.user = user;
  req.permissions = user.role?.permissions || [];

  // Everything downstream in this request (controllers, services, further
  // middleware) now runs inside this organization's tenant context, so every
  // tenant-scoped query is automatically isolated to it — see
  // utils/tenantPlugin.js. This is never derived from anything the client
  // sent; it comes only from the authenticated user's own record.
  tenantContext.run(user.organizationId, next);
});

// For the handful of endpoints reachable both before and after login (e.g.
// GET /settings/public, used by the Login page for branding *and* by
// authenticated print/label pages for the org's own company info): behaves
// exactly like `authenticate` when a valid token is present (req.user set,
// tenant context established), but simply continues with no req.user
// instead of a 401 when there isn't one — there is no "current organization"
// to speak of on a shared, pre-login page, and that isn't an error.
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const user = await loadUserFromToken(req);
  if (!user) return next();

  req.user = user;
  req.permissions = user.role?.permissions || [];
  tenantContext.run(user.organizationId, next);
});

module.exports = { authenticate, optionalAuthenticate };
