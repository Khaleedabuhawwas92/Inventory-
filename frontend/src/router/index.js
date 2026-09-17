import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import { useAuthStore } from '@/stores/auth';
import authService from '@/services/authService';

const ComingSoon = () => import('@/pages/ComingSoon.vue');

// `layout: 'main'` routes render inside the authenticated shell (sidebar/navbar).
// `layout: 'auth'` / `layout: 'blank'` routes render standalone.
// `public: true` skips the auth guard (wired in the Authentication phase).
const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/auth/Login.vue'),
    meta: { layout: 'blank', public: true, title: 'تسجيل الدخول' },
  },
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/pages/setup/SetupWizard.vue'),
    meta: { layout: 'blank', public: true, title: 'إعداد النظام' },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ComingSoon,
    meta: { layout: 'blank', public: true, title: 'استعادة كلمة المرور' },
  },
  {
    path: '/',
    component: MainLayout,
    meta: { layout: 'main' },
    children: [
      { path: '', redirect: '/dashboard' },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/Dashboard.vue'),
        meta: { title: 'الرئيسية', permission: 'dashboard.view' },
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('@/pages/products/ProductsList.vue'),
        meta: { title: 'الأصناف', permission: 'products.view' },
      },
      {
        path: 'products/new',
        name: 'products.new',
        component: () => import('@/pages/products/ProductForm.vue'),
        meta: { title: 'إضافة صنف', permission: 'products.create' },
      },
      {
        path: 'products/:id',
        name: 'products.show',
        component: () => import('@/pages/products/ProductDetail.vue'),
        meta: { title: 'تفاصيل الصنف', permission: 'products.view' },
      },
      {
        path: 'products/:id/edit',
        name: 'products.edit',
        component: () => import('@/pages/products/ProductForm.vue'),
        meta: { title: 'تعديل الصنف', permission: 'products.edit' },
      },
      { path: 'categories', name: 'categories', component: () => import('@/pages/categories/CategoriesList.vue'), meta: { title: 'التصنيفات', permission: 'categories.view' } },
      { path: 'units', name: 'units', component: () => import('@/pages/units/UnitsList.vue'), meta: { title: 'الوحدات', permission: 'units.manage' } },
      { path: 'warehouses', name: 'warehouses', component: () => import('@/pages/warehouses/WarehousesList.vue'), meta: { title: 'المخازن', permission: 'warehouses.view' } },
      { path: 'warehouses/:id', name: 'warehouses.show', component: () => import('@/pages/warehouses/WarehouseDetail.vue'), meta: { title: 'تفاصيل المخزن', permission: 'warehouses.view' } },

      { path: 'stock/in', name: 'stock.in', component: () => import('@/pages/stock/StockInList.vue'), meta: { title: 'إدخال بضاعة', permission: 'stock.in' } },
      { path: 'stock/in/new', name: 'stock.in.new', component: () => import('@/pages/stock/StockInForm.vue'), meta: { title: 'سند إدخال جديد', permission: 'stock.in' } },
      { path: 'stock/in/:id', name: 'stock.in.show', component: () => import('@/pages/stock/StockInDetail.vue'), meta: { title: 'تفاصيل سند الإدخال', permission: 'stock.in' } },
      { path: 'stock/out', name: 'stock.out', component: () => import('@/pages/stock/StockOutList.vue'), meta: { title: 'إخراج بضاعة', permission: 'stock.out' } },
      { path: 'stock/out/new', name: 'stock.out.new', component: () => import('@/pages/stock/StockOutForm.vue'), meta: { title: 'سند إخراج جديد', permission: 'stock.out' } },
      { path: 'stock/out/:id', name: 'stock.out.show', component: () => import('@/pages/stock/StockOutDetail.vue'), meta: { title: 'تفاصيل سند الإخراج', permission: 'stock.out' } },
      { path: 'stock/transfers', name: 'stock.transfers', component: () => import('@/pages/stock/StockTransfersList.vue'), meta: { title: 'نقل مخزون', permission: 'stock.transfer' } },
      { path: 'stock/transfers/new', name: 'stock.transfers.new', component: () => import('@/pages/stock/StockTransferForm.vue'), meta: { title: 'تحويل جديد', permission: 'stock.transfer' } },
      { path: 'stock/transfers/:id', name: 'stock.transfers.show', component: () => import('@/pages/stock/StockTransferDetail.vue'), meta: { title: 'تفاصيل التحويل', permission: 'stock.transfer' } },
      { path: 'stock/adjustments', name: 'stock.adjustments', component: () => import('@/pages/stock/StockAdjustmentsList.vue'), meta: { title: 'التسويات', permission: 'stock.adjust' } },
      { path: 'stock/adjustments/new', name: 'stock.adjustments.new', component: () => import('@/pages/stock/StockAdjustmentForm.vue'), meta: { title: 'تسوية جديدة', permission: 'stock.adjust' } },
      { path: 'stock/adjustments/:id', name: 'stock.adjustments.show', component: () => import('@/pages/stock/StockAdjustmentDetail.vue'), meta: { title: 'تفاصيل التسوية', permission: 'stock.adjust' } },
      { path: 'stock/returns', name: 'stock.returns', component: () => import('@/pages/stock/StockReturnsList.vue'), meta: { title: 'المرتجعات', permission: 'stock.view' } },
      { path: 'stock/returns/new', name: 'stock.returns.new', component: () => import('@/pages/stock/StockReturnForm.vue'), meta: { title: 'مرتجع جديد', permission: 'stock.view' } },
      { path: 'stock/returns/:id', name: 'stock.returns.show', component: () => import('@/pages/stock/StockReturnDetail.vue'), meta: { title: 'تفاصيل المرتجع', permission: 'stock.view' } },
      { path: 'stock/movements', name: 'stock.movements', component: () => import('@/pages/stock/StockMovementsList.vue'), meta: { title: 'سجل الحركات', permission: 'stock.view' } },

      { path: 'suppliers', name: 'suppliers', component: () => import('@/pages/suppliers/SuppliersList.vue'), meta: { title: 'الموردون', permission: 'suppliers.view' } },
      { path: 'suppliers/:id', name: 'suppliers.show', component: () => import('@/pages/suppliers/SupplierDetail.vue'), meta: { title: 'تفاصيل المورد', permission: 'suppliers.view' } },

      { path: 'purchases', name: 'purchases', component: () => import('@/pages/purchases/PurchaseOrdersList.vue'), meta: { title: 'طلبات الشراء', permission: 'purchases.view' } },
      { path: 'purchases/new', name: 'purchases.new', component: () => import('@/pages/purchases/PurchaseOrderForm.vue'), meta: { title: 'طلب شراء جديد', permission: 'purchases.create' } },
      { path: 'purchases/:id', name: 'purchases.show', component: () => import('@/pages/purchases/PurchaseOrderDetail.vue'), meta: { title: 'تفاصيل طلب الشراء', permission: 'purchases.view' } },
      { path: 'goods-receipts', name: 'goods-receipts', component: () => import('@/pages/purchases/GoodsReceiptsList.vue'), meta: { title: 'استلام البضاعة', permission: 'purchases.view' } },
      { path: 'goods-receipts/new', name: 'goods-receipts.new', component: () => import('@/pages/purchases/GoodsReceiptForm.vue'), meta: { title: 'سند استلام جديد', permission: 'purchases.create' } },
      { path: 'goods-receipts/:id', name: 'goods-receipts.show', component: () => import('@/pages/purchases/GoodsReceiptDetail.vue'), meta: { title: 'تفاصيل سند الاستلام', permission: 'purchases.view' } },

      { path: 'inventory', name: 'inventory', component: () => import('@/pages/inventory/InventoryCountsList.vue'), meta: { title: 'الجرد', permission: 'inventory.view' } },
      { path: 'inventory/new', name: 'inventory.new', component: () => import('@/pages/inventory/InventoryCountForm.vue'), meta: { title: 'جرد جديد', permission: 'inventory.create' } },
      { path: 'inventory/:id', name: 'inventory.show', component: () => import('@/pages/inventory/InventoryCountDetail.vue'), meta: { title: 'تفاصيل الجرد', permission: 'inventory.view' } },

      { path: 'reports', name: 'reports', component: () => import('@/pages/reports/ReportsHome.vue'), meta: { title: 'التقارير', permission: 'reports.view' } },
      { path: 'reports/current-stock', name: 'reports.current-stock', component: () => import('@/pages/reports/CurrentStockReport.vue'), meta: { title: 'المخزون الحالي', permission: 'reports.view' } },
      { path: 'reports/low-stock', name: 'reports.low-stock', component: () => import('@/pages/reports/LowStockReport.vue'), meta: { title: 'المخزون المنخفض', permission: 'reports.view' } },
      { path: 'reports/movements', name: 'reports.movements', redirect: '/stock/movements' },
      { path: 'reports/valuation', name: 'reports.valuation', component: () => import('@/pages/reports/ValuationReport.vue'), meta: { title: 'تقييم المخزون', permission: 'reports.view' } },
      { path: 'reports/dead-stock', name: 'reports.dead-stock', component: () => import('@/pages/reports/DeadStockReport.vue'), meta: { title: 'الأصناف الراكدة', permission: 'reports.view' } },
      { path: 'reports/movement-ranking', name: 'reports.movement-ranking', component: () => import('@/pages/reports/MovementRankingReport.vue'), meta: { title: 'ترتيب حركة الأصناف', permission: 'reports.view' } },
      { path: 'reports/inventory-differences', name: 'reports.inventory-differences', component: () => import('@/pages/reports/InventoryDifferencesReport.vue'), meta: { title: 'فروقات الجرد', permission: 'reports.view' } },
      { path: 'reports/supplier-purchases', name: 'reports.supplier-purchases', component: () => import('@/pages/reports/SupplierPurchasesReport.vue'), meta: { title: 'مشتريات الموردين', permission: 'reports.view' } },

      { path: 'users', name: 'users', component: () => import('@/pages/users/UsersList.vue'), meta: { title: 'المستخدمون', permission: 'users.view' } },
      { path: 'roles', name: 'roles', component: () => import('@/pages/roles/RolesList.vue'), meta: { title: 'الأدوار والصلاحيات', permission: 'roles.manage' } },
      { path: 'audit', name: 'audit', component: () => import('@/pages/AuditLogList.vue'), meta: { title: 'سجل العمليات', permission: 'audit.view' } },
      { path: 'settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { title: 'الإعدادات', permission: 'settings.manage' } },
      { path: 'barcode-labels', name: 'barcode-labels', component: () => import('@/pages/products/BarcodeLabelsPage.vue'), meta: { title: 'طباعة ملصقات الباركود', permission: 'products.view' } },
      { path: 'profile', name: 'profile', component: () => import('@/pages/ProfilePage.vue'), meta: { title: 'الملف الشخصي' } },
      {
        path: '403',
        name: 'forbidden',
        component: () => import('@/pages/Forbidden.vue'),
        meta: { title: 'غير مصرح' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFound.vue'),
    meta: { layout: 'blank', public: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

let setupStatusCache = null;
async function isSetupCompleted() {
  if (setupStatusCache !== null) return setupStatusCache;
  try {
    const { data } = await authService.setupStatus();
    setupStatusCache = !!data.data.setupCompleted;
  } catch (err) {
    // If the backend is unreachable we let the App shell's own connectivity
    // check handle showing an error state instead of looping the router.
    setupStatusCache = true;
  }
  return setupStatusCache;
}

export function invalidateSetupStatusCache() {
  setupStatusCache = null;
}

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} | نظام إدارة المخزون` : 'نظام إدارة المخزون';

  const auth = useAuthStore();
  if (!auth.isInitialized) {
    await auth.initSession();
  }

  if (to.name !== 'setup') {
    const setupDone = await isSetupCompleted();
    if (!setupDone) return { name: 'setup' };
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined };
  }

  if (to.meta.permission && auth.isAuthenticated && !auth.can(to.meta.permission)) {
    return { name: 'forbidden' };
  }

  return true;
});

export default router;
