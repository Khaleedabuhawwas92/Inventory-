const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Organization = require('../models/Organization');

// Backend-side feature-flag enforcement (spec: "Frontend hiding alone is not
// enough"). Reads the *caller's own* organization (req.user.organizationId,
// set by middleware/auth.js from the authenticated session — never from
// anything the client sends), so this can never be used to check or affect
// any other organization's flags. Every flag defaults to `true` on the
// Organization schema, so an organization with no explicit platform-admin
// action taken never loses access to anything it already had.
module.exports = function requireFeature(featureName) {
  return asyncHandler(async (req, res, next) => {
    const org = await Organization.findById(req.user.organizationId).select('features');
    if (org?.features && org.features[featureName] === false) {
      throw ApiError.forbidden('هذه الميزة غير مفعّلة لمؤسستك حالياً، الرجاء التواصل مع الدعم لتفعيلها', 'FEATURE_DISABLED');
    }
    next();
  });
};
