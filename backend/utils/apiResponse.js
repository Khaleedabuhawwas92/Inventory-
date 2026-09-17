function sendSuccess(res, { message = 'تمت العملية بنجاح', data = null, meta = null, statusCode = 200 } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function sendError(res, { message = 'حدث خطأ ما', errors = [], statusCode = 500 } = {}) {
  return res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { sendSuccess, sendError };
