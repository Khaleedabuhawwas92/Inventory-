const Role = require('../models/Role');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/permissions');

const ROLE_LABELS = {
  'super-admin': 'مدير عام',
  admin: 'مدير',
  'warehouse-manager': 'مدير مخزن',
  employee: 'موظف',
  viewer: 'مشاهد',
};

// Seeds the default roles for one organization. `roleNames` lets callers pick
// a subset (self-service registration deliberately never creates a
// 'super-admin' role for a new organization — see onboarding.controller —
// so there is nothing named 'super-admin' for an org's own admin to collide
// with or escalate into).
async function ensureDefaultRoles(organizationId, roleNames = Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
  const roles = {};
  for (const name of roleNames) {
    const permissions = DEFAULT_ROLE_PERMISSIONS[name];
    if (!permissions) continue;
    let role = await Role.findOne({ name, organizationId });
    if (!role) {
      role = await Role.create({
        organizationId,
        name,
        nameAr: ROLE_LABELS[name] || name,
        permissions,
        isSystem: true,
      });
    }
    roles[name] = role;
  }
  return roles;
}

module.exports = { ensureDefaultRoles, ROLE_LABELS };
