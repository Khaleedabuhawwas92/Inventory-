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

  'audit.view',

  'settings.manage',
];

// Default role -> permission mapping used during first-time setup / seeding.
const DEFAULT_ROLE_PERMISSIONS = {
  'super-admin': PERMISSIONS, // full access, always
  admin: PERMISSIONS.filter((p) => p !== 'settings.manage' || true), // admins get everything except nothing is excluded by default; tune per deployment
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
