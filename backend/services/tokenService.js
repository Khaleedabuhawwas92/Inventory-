const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ms = require('../utils/ms');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role?._id?.toString() || user.role?.toString() },
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

async function revokeAllForUser(userId) {
  await RefreshToken.updateMany({ user: userId, revoked: false }, { revoked: true, revokedAt: new Date() });
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  hashToken,
};
