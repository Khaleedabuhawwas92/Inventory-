class ApiError extends Error {
  // `code` is an optional, stable machine-readable string (e.g.
  // 'SESSION_REVOKED') for cases where the frontend needs to distinguish
  // *why* a request failed beyond the HTTP status and the (Arabic,
  // human-facing) message — see middleware/errorHandler.js, which forwards
  // it in the JSON response, and frontend src/services/api.js, which reads
  // it to tell a forced logout apart from an ordinary expired session.
  constructor(statusCode, message, errors = [], code = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'طلب غير صالح', errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'غير مصرح بالدخول', code = undefined) {
    return new ApiError(401, message, [], code);
  }

  static forbidden(message = 'ليس لديك صلاحية للقيام بهذا الإجراء', code = undefined) {
    return new ApiError(403, message, [], code);
  }

  static notFound(message = 'العنصر المطلوب غير موجود') {
    return new ApiError(404, message);
  }

  static conflict(message = 'تعارض في البيانات') {
    return new ApiError(409, message);
  }

  static internal(message = 'حدث خطأ غير متوقع في الخادم') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
