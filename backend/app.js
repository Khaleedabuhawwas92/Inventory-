const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const env = require('./config/env');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());

if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 300 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'عدد كبير جداً من الطلبات، الرجاء المحاولة لاحقاً', errors: [] },
});
app.use('/api', apiLimiter);

// ✅ مسار مطلق مبني على __dirname (مثل middleware/upload.js تماماً) — وليس
// نصاً نسبياً يعتمد على CWD وقت تشغيل العملية. 'uploads' النسبية كانت تُحلّ
// حسب مجلد العمل الفعلي عند إطلاق node (يختلف حسب nodemon/PM2/مسار التشغيل)
// وليس بالضرورة جذر المشروع حيث تُكتب الملفات فعلياً — فيرجع 404 حتى لو
// كان الملف موجوداً فعلاً على القرص.
//
// ✅ Cross-Origin-Resource-Policy: helmet() يضبطها افتراضياً على "same-origin"
// لكل الاستجابات (حماية جيدة لـ /api). لكن هذا يمنع المتصفح من عرض صور
// /uploads (كالشعار) عند تحميلها من origin مختلف (5173 ← 5000 في التطوير):
// ERR_BLOCKED_BY_RESPONSE.NotSameOrigin. الحل هنا مُستهدف لمسار /uploads
// فقط — لا يُعطَّل Helmet ولا تتأثر استجابات /api الأخرى.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '..', 'uploads'))
);

app.use('/api', apiRoutes);

// Serves the built frontend when it's sitting next to this backend — the
// layout the Electron desktop build uses so one process (this one) can serve
// the whole app instead of running two servers. A plain web deployment
// (frontend on Vercel, backend on Railway) never has this folder, so it's a
// no-op there.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
