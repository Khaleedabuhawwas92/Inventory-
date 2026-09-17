// Sidebar navigation tree. `permission` is checked against the current user's
// permission list once the Roles & Permissions phase is implemented (null = always visible).
export const navigation = [
  {
    title: 'الرئيسية',
    icon: 'home',
    to: '/dashboard',
    permission: 'dashboard.view',
  },
  {
    title: 'المخزون',
    icon: 'archive',
    children: [
      { title: 'الأصناف', to: '/products', permission: 'products.view' },
      { title: 'التصنيفات', to: '/categories', permission: 'categories.view' },
      { title: 'الوحدات', to: '/units', permission: 'units.manage' },
      { title: 'المخازن', to: '/warehouses', permission: 'warehouses.view' },
      { title: 'طباعة الباركود', to: '/barcode-labels', permission: 'products.view' },
    ],
  },
  {
    title: 'الحركات',
    icon: 'arrows-right-left',
    children: [
      { title: 'إدخال بضاعة', to: '/stock/in', permission: 'stock.in' },
      { title: 'إخراج بضاعة', to: '/stock/out', permission: 'stock.out' },
      { title: 'نقل مخزون', to: '/stock/transfers', permission: 'stock.transfer' },
      { title: 'التسويات', to: '/stock/adjustments', permission: 'stock.adjust' },
      { title: 'المرتجعات', to: '/stock/returns', permission: 'stock.view' },
      { title: 'سجل الحركات', to: '/stock/movements', permission: 'stock.view' },
    ],
  },
  {
    title: 'المشتريات',
    icon: 'shopping-cart',
    children: [
      { title: 'طلبات الشراء', to: '/purchases', permission: 'purchases.view' },
      { title: 'استلام البضاعة', to: '/goods-receipts', permission: 'purchases.view' },
      { title: 'الموردون', to: '/suppliers', permission: 'suppliers.view' },
    ],
  },
  {
    title: 'الجرد',
    icon: 'clipboard-list',
    to: '/inventory',
    permission: 'inventory.view',
  },
  {
    title: 'التقارير',
    icon: 'chart-bar',
    to: '/reports',
    permission: 'reports.view',
  },
  {
    title: 'المستخدمون',
    icon: 'users',
    to: '/users',
    permission: 'users.view',
  },
  {
    title: 'الأدوار والصلاحيات',
    icon: 'shield-check',
    to: '/roles',
    permission: 'roles.manage',
  },
  {
    title: 'سجل العمليات',
    icon: 'document-text',
    to: '/audit',
    permission: 'audit.view',
  },
  {
    title: 'الإعدادات',
    icon: 'cog',
    to: '/settings',
    permission: 'settings.manage',
  },
];
