class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'طلب غير صالح', errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'غير مصرح بالدخول') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'ليس لديك صلاحية للقيام بهذا الإجراء') {
    return new ApiError(403, message);
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
