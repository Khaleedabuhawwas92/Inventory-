const Role = require('../models/Role');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/permissions');

const ROLE_LABELS = {
  'super-admin': 'مدير عام',
  admin: 'مدير',
  'warehouse-manager': 'مدير مخزن',
  employee: 'موظف',
  viewer: 'مشاهد',
};

async function ensureDefaultRoles() {
  const roles = {};
  for (const [name, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    let role = await Role.findOne({ name });
    if (!role) {
      role = await Role.create({
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
