const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`المسار غير موجود: ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'حدث خطأ غير متوقع في الخادم';
  let errors = err.errors || [];

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'فشل التحقق من صحة البيانات';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `معرّف غير صالح: ${err.value}`;
  }

  // Mongo duplicate key. The Arabic message stays generic (field name only)
  // since it's user-facing, but which collection/index actually collided is
  // essential for diagnosing stale-index bugs like the multi-tenant
  // registration issue this was added for — so log that detail separately in
  // non-production instead of relying on parsing it out of err.message.
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `القيمة مستخدمة مسبقاً في الحقل: ${field}` : 'قيمة مكررة غير مسموح بها';
    errors = [{ field, value: err.keyValue?.[field] }];

    if (env.NODE_ENV !== 'production') {
      console.error('[DUPLICATE KEY]', {
        collection: err.collection?.collectionName || err.namespace || null,
        keyPattern: err.keyPattern || null,
        keyValue: err.keyValue || null,
        message: err.message,
      });
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'رمز الدخول غير صالح';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجدداً';
  }

  if (!err.isOperational && env.NODE_ENV === 'production') {
    console.error('[UNEXPECTED ERROR]', err);
  } else {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    // Only a string code (ApiError's own, e.g. 'SESSION_REVOKED') is ever
    // forwarded here — err.code is also how the Mongo driver reports a
    // numeric duplicate-key code (11000, handled above), which must never
    // leak into this field.
    ...(typeof err.code === 'string' ? { code: err.code } : {}),
    ...(env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
