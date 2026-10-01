const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ms = require('../utils/ms');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');

// `v` (authVersion) is what lets a forced logout invalidate a token that's
// already been issued and hasn't expired yet — see models/User.js and
// middleware/auth.js. Every caller of this function passes a user doc loaded
// via a plain find/findById (never one that excludes authVersion), so
// `user.authVersion` is always present; the `|| 0` fallback only matters for
// a user document created before this field existed.
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role?._id?.toString() || user.role?.toString(),
      v: user.authVersion || 0,
    },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRawRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function issueRefreshToken(user, { ip = '', userAgent = '' } = {}) {
  const raw = generateRawRefreshToken();
  const expiresAt = new Date(Date.now() + ms(env.REFRESH_TOKEN_EXPIRES));
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(raw),
    ip,
    userAgent,
    expiresAt,
  });
  return raw;
}

async function rotateRefreshToken(rawToken, { ip = '', userAgent = '' } = {}) {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing || existing.revoked || existing.expiresAt < new Date()) {
    return null;
  }

  const newRaw = generateRawRefreshToken();
  const newExpiresAt = new Date(Date.now() + ms(env.REFRESH_TOKEN_EXPIRES));

  existing.revoked = true;
  existing.revokedAt = new Date();
  existing.replacedByHash = hashToken(newRaw);
  await existing.save();

  await RefreshToken.create({
    user: existing.user,
    tokenHash: hashToken(newRaw),
    ip,
    userAgent,
    expiresAt: newExpiresAt,
  });

  return { raw: newRaw, userId: existing.user };
}

async function revokeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  await RefreshToken.updateOne({ tokenHash }, { revoked: true, revokedAt: new Date() });
}

// Revoking refresh tokens alone only blocks a FUTURE renewal — an access
// token the client already holds stays valid until it naturally expires
// (see env.ACCESS_TOKEN_EXPIRES). Bumping authVersion here is what makes
// this an actual forced logout: every access token was signed with the
// user's authVersion at issue time, and middleware/auth.js rejects any
// token whose embedded version no longer matches the current one.
async function revokeAllForUser(userId) {
  await Promise.all([
    RefreshToken.updateMany({ user: userId, revoked: false }, { revoked: true, revokedAt: new Date() }),
    User.updateOne({ _id: userId }, { $inc: { authVersion: 1 } }),
  ]);
}

// Batch version of revokeAllForUser — one indexed updateMany across every
// given user, instead of N separate calls. Used for organization-wide
// "log out everyone" (see controllers/platform/organizationDetail.controller.js).
async function revokeAllForUsers(userIds) {
  await Promise.all([
    RefreshToken.updateMany({ user: { $in: userIds }, revoked: false }, { revoked: true, revokedAt: new Date() }),
    User.updateMany({ _id: { $in: userIds } }, { $inc: { authVersion: 1 } }),
  ]);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  revokeAllForUsers,
  hashToken,
};
