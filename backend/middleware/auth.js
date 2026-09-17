const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const tokenService = require('../services/tokenService');
const User = require('../models/User');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('الرجاء تسجيل الدخول للمتابعة');
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'انتهت صلاحية رمز الدخول' : 'رمز الدخول غير صالح'
    );
  }

  const user = await User.findById(payload.sub).populate('role').populate('warehouse');
  if (!user) throw ApiError.unauthorized('المستخدم غير موجود');
  if (user.status !== 'active') throw ApiError.forbidden('تم تعطيل هذا الحساب');

  req.user = user;
  req.permissions = user.role?.permissions || [];
  next();
});

module.exports = { authenticate };
