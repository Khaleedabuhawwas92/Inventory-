const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const tokenService = require('../services/tokenService');
const tenantContext = require('../utils/tenantContext');
const populateUserRefs = require('../utils/populateUserRefs');
const subscriptionService = require('../services/subscriptionService');
const User = require('../models/User');
const Organization = require('../models/Organization');

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

  // Forced logout (see services/tokenService.js revokeAllForUser(s)): the
  // JWT itself is still cryptographically valid and unexpired, so this
  // version check is the only thing that actually invalidates it the
  // moment an admin revokes the session — rejecting it here, on every
  // request, rather than trusting the token's claims alone. `payload.v` is
  // missing on tokens signed before this field existed; treated as 0 so
  // those keep working until the first real revocation bumps the user past
  // it, instead of mass-invalidating every session on deploy.
  const tokenVersion = payload.v || 0;
  if (tokenVersion !== (user.authVersion || 0)) {
    throw ApiError.unauthorized('تم تسجيل خروجك من النظام بواسطة الإدارة', 'SESSION_REVOKED');
  }

  if (user.status !== 'active') throw ApiError.forbidden('تم تعطيل هذا الحساب');

  // Subscription expiration was previously only checked at login (see
  // controllers/auth.controller.js) — an already-issued, still-unexpired
  // access token kept working for an organization whose subscription had
  // since expired, exactly the same gap SESSION_REVOKED closed for forced
  // logout. Checked on every request, not just login, for the same reason.
  //
  // Exempt for isPlatformAdmin: their own tenant-side account happens to
  // belong to some organization too, and if *that one's* subscription lapses
  // this would otherwise lock them out of the cross-org Platform Admin panel
  // they'd use to fix any organization's subscription — a deadlock, not a
  // meaningful restriction (the same self-lockout concern that already
  // excludes a Platform Admin from their own org-wide forced-logout, see
  // controllers/platform/organizationDetail.controller.js). Billing
  // enforcement is a tenant-facing concern; platform-level accounts sit
  // above it entirely, same as permit()'s super-admin bypass.
  if (!user.isPlatformAdmin) {
    const organization = await Organization.findById(user.organizationId).select('plan subscriptionStatus subscriptionEndsAt');
    const block = organization && subscriptionService.getBlockInfo(organization);
    if (block) throw ApiError.forbidden(block.message, block.code);
  }

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
