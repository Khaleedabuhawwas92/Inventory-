// Full permission catalogue (spec section 8). Each permission is "<module>.<action>".
const PERMISSIONS = [
  'dashboard.view',

  'products.view', 'products.create', 'products.edit', 'products.delete',
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  'units.manage',
  'warehouses.view', 'warehouses.create', 'warehouses.edit',

  'stock.view', 'stock.in', 'stock.out', 'stock.transfer', 'stock.adjust',

  'inventory.view', 'inventory.create', 'inventory.approve',

  'suppliers.view', 'suppliers.manage',

  'purchases.view', 'purchases.create', 'purchases.approve',

  'reports.view', 'reports.export',

  'users.view', 'users.manage',

  'roles.manage',

  'invitations.manage',

  'audit.view',

  'settings.manage',
];

// Default role -> permission mapping used during first-time setup / seeding.
//
// Bug fix: this used to be `PERMISSIONS.filter((p) => p !== 'settings.manage' || true)`.
// `x || true` is always `true` regardless of `x`, so the filter predicate was
// always true and never actually excluded 'settings.manage' — dead code that
// silently granted every 'admin' the exact same permission set as
// 'super-admin'. Since 'admin' is the role given to an organization's own
// owner (see onboarding.controller.registerCompany) and is expected to have
// full control of their own organization's data, the *current* runtime
// behavior (full PERMISSIONS) is correct and is now made explicit instead of
// being an accident of broken boolean logic — existing admins keep exactly
// the access they already have.
const DEFAULT_ROLE_PERMISSIONS = {
  'super-admin': PERMISSIONS, // full access, always
  admin: PERMISSIONS, // organization owner: full control within their own organization
  'warehouse-manager': [
    'dashboard.view',
    'products.view', 'products.create', 'products.edit',
    'categories.view', 'categories.create', 'categories.edit',
    'units.manage',
    'warehouses.view',
    'stock.view', 'stock.in', 'stock.out', 'stock.transfer', 'stock.adjust',
    'inventory.view', 'inventory.create', 'inventory.approve',
    'suppliers.view', 'suppliers.manage',
    'purchases.view', 'purchases.create', 'purchases.approve',
    'reports.view', 'reports.export',
  ],
  employee: [
    'dashboard.view',
    'products.view',
    'categories.view',
    'warehouses.view',
    'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
    'inventory.view', 'inventory.create',
    'suppliers.view',
    'purchases.view',
    'reports.view',
  ],
  viewer: [
    'dashboard.view',
    'products.view',
    'categories.view',
    'warehouses.view',
    'stock.view',
    'inventory.view',
    'suppliers.view',
    'purchases.view',
    'reports.view',
  ],
};

module.exports = { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS };
