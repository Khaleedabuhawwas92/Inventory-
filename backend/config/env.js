const dotenv = require('dotenv');
dotenv.config();

const required = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  REFRESH_TOKEN_EXPIRES: process.env.REFRESH_TOKEN_EXPIRES || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  // The standalone Platform Admin app (platform-admin/) — a separate Vite
  // project/origin, not bundled with the tenant frontend. Talks to the same
  // backend and is gated purely by requirePlatformAdmin, never by CORS —
  // this just lets the browser's own CORS check allow the request through
  // in the first place. Comma-separated for extra origins (e.g. a deployed
  // platform-admin URL) without code changes.
  PLATFORM_ADMIN_URL: process.env.PLATFORM_ADMIN_URL || 'http://localhost:5174',
};

env.CORS_ORIGINS = [
  env.FRONTEND_URL,
  env.PLATFORM_ADMIN_URL,
  ...(process.env.EXTRA_CORS_ORIGINS ? process.env.EXTRA_CORS_ORIGINS.split(',').map((o) => o.trim()) : []),
];

if (env.NODE_ENV === 'production') {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

if (!env.JWT_SECRET) env.JWT_SECRET = 'dev-only-insecure-access-secret-change-me';
if (!env.JWT_REFRESH_SECRET) env.JWT_REFRESH_SECRET = 'dev-only-insecure-refresh-secret-change-me';

module.exports = env;
