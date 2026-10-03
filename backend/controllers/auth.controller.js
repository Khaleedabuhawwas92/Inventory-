const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const User = require('../models/User');
const Organization = require('../models/Organization');
const tokenService = require('../services/tokenService');
const subscriptionService = require('../services/subscriptionService');
const auditService = require('../services/auditService');
const tenantContext = require('../utils/tenantContext');
const populateUserRefs = require('../utils/populateUserRefs');
const ms = require('../utils/ms');
const env = require('../config/env');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = ms('15m');

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: ms(env.REFRESH_TOKEN_EXPIRES),
};

async function issueSession(res, user, req) {
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

const login = asyncHandler(async (req, res) => {
  const { identifier, password, remember } = req.body;

  // Unscoped on purpose: identifiers are globally unique across every
  // organization (see models/User.js), so which organization this login
  // belongs to isn't known until *after* this lookup.
  const user = await User.findOne({
    $or: [{ username: identifier.toLowerCase() }, { email: identifier.toLowerCase() }],
  }).select('+passwordHash');

  if (!user) {
    // No organization to attribute this attempt to — auditService.logAction
    // fails closed (tenant-scoped AuditLog requires a context) and silently
    // no-ops via its own try/catch, which is correct here: there is nothing
    // to log against.
    await auditService.logAction({
      req,
      action: 'LOGIN_FAILED',
      description: `محاولة دخول فاشلة - مستخدم غير موجود (${identifier})`,
    });
    throw ApiError.unauthorized('بيانات الدخول غير صحيحة');
  }

  // From here on the organization is known — run the rest of the login
  // inside its tenant context so audit logging and ref population resolve
  // correctly, and so a suspended organization can be checked below.
  return tenantContext.run(user.organizationId, async () => {
    const organization = await Organization.findById(user.organizationId);
    if (!organization || organization.status !== 'active') {
      throw ApiError.forbidden('تم تعليق هذه المؤسسة، الرجاء التواصل مع الدعم');
    }

    // See middleware/auth.js for the matching per-request check (the same
    // gate must hold for an already-issued token, not just at the login
    // moment), including the isPlatformAdmin exemption applied the same way
    // here, and services/subscriptionService.js for why this is computed
    // fresh from plan/dates rather than trusted from a stored status field.
    if (!user.isPlatformAdmin) {
      const block = subscriptionService.getBlockInfo(organization);
      if (block) throw ApiError.forbidden(block.message, block.code);
    }

    if (user.isLocked()) {
      await auditService.logAction({
        req,
        user,
        action: 'LOGIN_FAILED',
        description: 'محاولة دخول أثناء قفل الحساب المؤقت',
      });
      throw ApiError.forbidden('تم قفل الحساب مؤقتاً بسبب محاولات دخول فاشلة متكررة، حاول لاحقاً');
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden('تم تعطيل هذا الحساب، الرجاء التواصل مع الإدارة');
    }

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();

      await auditService.logAction({
        req,
        user,
        action: 'LOGIN_FAILED',
        description: 'كلمة مرور غير صحيحة',
      });
      throw ApiError.unauthorized('بيانات الدخول غير صحيحة');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await user.save();
    await user.populate(['role', 'warehouse']);

    const accessToken = await issueSession(res, user, req);

    await auditService.logAction({ req, user, action: 'LOGIN', description: 'تسجيل دخول ناجح' });

    sendSuccess(res, {
      message: 'تم تسجيل الدخول بنجاح',
      data: { user: user.toSafeJSON(), accessToken },
    });
  });
});

const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) throw ApiError.unauthorized('الجلسة غير موجودة، الرجاء تسجيل الدخول مجدداً');

  const rotated = await tokenService.rotateRefreshToken(rawToken, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
  });

  if (!rotated) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    throw ApiError.unauthorized('انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجدداً');
  }

  const user = await User.findById(rotated.userId);
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('لا يمكن تجديد الجلسة');
  }
  await populateUserRefs(user);

  res.cookie(REFRESH_COOKIE_NAME, rotated.raw, REFRESH_COOKIE_OPTIONS);
  const accessToken = tokenService.signAccessToken(user);

  sendSuccess(res, {
    message: 'تم تجديد الجلسة',
    data: { user: user.toSafeJSON(), accessToken },
  });
});

const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) {
    await tokenService.revokeRefreshToken(rawToken);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });

  if (req.user) {
    await auditService.logAction({ req, action: 'LOGOUT', description: 'تسجيل خروج' });
  }

  sendSuccess(res, { message: 'تم تسجيل الخروج' });
});

const me = asyncHandler(async (req, res) => {
  // Feature flags come from req.user.organizationId (the authenticated
  // session's own organization) — never from any client-supplied value —
  // so the tenant frontend can hide/disable modules the organization
  // doesn't have. This is a UX convenience only: every mutating endpoint
  // behind a feature flag also enforces it server-side (see
  // middleware/requireFeature.js), so this never becomes the real gate.
  const organization = await Organization.findById(req.user.organizationId).select('features plan status');
  sendSuccess(res, {
    data: {
      user: req.user.toSafeJSON(),
      permissions: req.permissions,
      features: organization?.features || null,
    },
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw ApiError.badRequest('كلمة المرور الحالية غير صحيحة');

  const bcrypt = require('bcryptjs');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  await user.save();

  await tokenService.revokeAllForUser(user._id);
  await auditService.logAction({ req, action: 'PASSWORD_RESET', description: 'تغيير كلمة المرور الذاتي' });

  sendSuccess(res, { message: 'تم تغيير كلمة المرور بنجاح، الرجاء تسجيل الدخول مجدداً' });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { fullName, phone, theme } = req.body;

  if (fullName !== undefined) user.fullName = fullName;
  if (phone !== undefined) user.phone = phone;
  if (theme !== undefined && ['light', 'dark'].includes(theme)) user.theme = theme;
  await user.save();

  const populated = await user.populate(['role', 'warehouse']);
  sendSuccess(res, { message: 'تم تحديث الملف الشخصي بنجاح', data: { user: populated.toSafeJSON() } });
});

const updateMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('لم يتم إرفاق صورة');
  const { publicUrlFor } = require('../middleware/upload');

  const user = await User.findById(req.user._id);
  user.profileImage = publicUrlFor('avatars', req.file.filename);
  await user.save();

  sendSuccess(res, { message: 'تم تحديث الصورة الشخصية', data: { profileImage: user.profileImage } });
});

module.exports = {
  login, refresh, logout, me, changePassword, updateMe, updateMyAvatar,
  REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS,
};
