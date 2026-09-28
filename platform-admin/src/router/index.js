import { createRouter, createWebHistory } from 'vue-router';
import PlatformLayout from '@/layouts/PlatformLayout.vue';
import { useAuthStore } from '@/stores/auth';

// Every route in this app (other than /login) requires BOTH a valid session
// AND isPlatformAdmin === true — the real enforcement is server-side
// (backend/middleware/requirePlatformAdmin.js on every /api/platform/*
// call); this guard only avoids rendering pages the API would reject anyway.
const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/Login.vue'),
    meta: { public: true, title: 'تسجيل الدخول' },
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/pages/Forbidden.vue'),
    meta: { public: true, title: 'غير مصرح' },
  },
  {
    path: '/',
    component: PlatformLayout,
    children: [
      { path: '', name: 'dashboard', component: () => import('@/pages/PlatformDashboard.vue'), meta: { title: 'لوحة المنصة' } },
      { path: 'organizations', name: 'organizations', component: () => import('@/pages/PlatformOrganizations.vue'), meta: { title: 'المؤسسات' } },
      { path: 'organizations/:id', name: 'organizations.show', component: () => import('@/pages/PlatformOrganizationDetail.vue'), meta: { title: 'تفاصيل المؤسسة' } },
      { path: 'organizations/:id/warehouses/:warehouseId', name: 'organizations.warehouses.show', component: () => import('@/pages/PlatformWarehouseDetail.vue'), meta: { title: 'تفاصيل المخزن' } },
      { path: 'users', name: 'users', component: () => import('@/pages/PlatformUsers.vue'), meta: { title: 'المستخدمون' } },
      { path: 'users/:id', name: 'users.show', component: () => import('@/pages/PlatformUserDetail.vue'), meta: { title: 'تفاصيل المستخدم' } },
      { path: 'audit', name: 'audit', component: () => import('@/pages/PlatformAudit.vue'), meta: { title: 'سجل النشاط' } },
      { path: 'security', name: 'security', component: () => import('@/pages/PlatformSecurity.vue'), meta: { title: 'الأمان' } },
      { path: 'invitations', name: 'invitations', component: () => import('@/pages/PlatformInvitations.vue'), meta: { title: 'الدعوات' } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFound.vue'),
    meta: { public: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} | إدارة المنصة` : 'إدارة المنصة';

  const auth = useAuthStore();
  if (!auth.isInitialized) {
    await auth.initSession();
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' };
  }

  // isPlatformAdmin only — never a role name (spec §4/§7). initSession()
  // already refuses to keep a session for a non-platform-admin account, so
  // isAuthenticated true here already implies isPlatformAdmin true — this
  // is a defensive second check, not the only one.
  if (!to.meta.public && auth.isAuthenticated && !auth.isPlatformAdmin) {
    return { name: 'forbidden' };
  }

  return true;
});

export default router;
