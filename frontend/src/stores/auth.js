import { defineStore } from 'pinia';
import authService from '@/services/authService';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    permissions: [],
    features: null,
    accessToken: localStorage.getItem('accessToken') || null,
    isInitialized: false,
    isSuperAdmin: false,
    _initPromise: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.accessToken && !!state.user,
    // Platform Admin is a completely separate axis from organization
    // roles/permissions (see backend/middleware/requirePlatformAdmin.js) —
    // never derived from role name or `can()`.
    isPlatformAdmin: (state) => state.user?.isPlatformAdmin === true,
    fullName: (state) => state.user?.fullName || '',
    roleLabel: (state) => state.user?.role?.nameAr || '',
    warehouseName: (state) => state.user?.warehouse?.name || '',
    // UX-only convenience for hiding unavailable modules; the real gate is
    // always server-side (backend/middleware/requireFeature.js). Unknown
    // flags default to enabled, matching the backend's own default.
    hasFeature: (state) => (name) => state.features?.[name] !== false,
  },
  actions: {
    can(permission) {
      if (!permission) return true;
      if (this.isSuperAdmin) return true;
      return this.permissions.includes(permission);
    },

    setSession({ user, accessToken, permissions, features }) {
      this.user = user;
      this.permissions = permissions || user?.role?.permissions || [];
      if (features !== undefined) this.features = features;
      this.isSuperAdmin = user?.role?.name === 'super-admin';
      // /auth/me calls setSession() without a fresh accessToken (it only confirms
      // the existing one); only overwrite it when a new token is actually issued
      // (login/refresh), otherwise this would wipe the token restored from
      // localStorage on every page reload and log the user back out.
      if (accessToken) {
        this.accessToken = accessToken;
        localStorage.setItem('accessToken', accessToken);
      }
    },

    clearSession() {
      this.user = null;
      this.accessToken = null;
      this.permissions = [];
      this.features = null;
      this.isSuperAdmin = false;
      localStorage.removeItem('accessToken');
    },

    async login(identifier, password) {
      const { data } = await authService.login(identifier, password);
      this.setSession({ user: data.data.user, accessToken: data.data.accessToken });
      await this.refreshFeatures();
      return data.data.user;
    },

    async registerCompany(payload) {
      const { data } = await authService.registerCompany(payload);
      this.setSession({ user: data.data.user, accessToken: data.data.accessToken });
      await this.refreshFeatures();
      return data.data.user;
    },

    async joinByInvitation(payload) {
      const { data } = await authService.joinByInvitation(payload);
      this.setSession({ user: data.data.user, accessToken: data.data.accessToken });
      await this.refreshFeatures();
      return data.data.user;
    },

    // login/registerCompany/joinByInvitation don't carry feature flags in
    // their own response (only /auth/me does) — fetched separately here so
    // module-hiding is correct immediately after signing in, not just after
    // the next page reload.
    async refreshFeatures() {
      try {
        const { data } = await authService.me();
        this.features = data.data.features;
      } catch {
        // Non-fatal: the session itself is already established above: this
        // only affects which modules are hidden in the UI, never access
        // control (that's enforced server-side regardless).
      }
    },

    async logout() {
      try {
        await authService.logout();
      } finally {
        this.clearSession();
      }
    },

    // Called on app boot AND from the first router guard, which can both fire
    // before either finishes; sharing the in-flight promise avoids two /auth/me
    // round-trips racing each other on every page load.
    async initSession() {
      if (this.isInitialized) return;
      if (this._initPromise) return this._initPromise;

      this._initPromise = (async () => {
        try {
          const { data } = await authService.me();
          this.setSession({ user: data.data.user, permissions: data.data.permissions, features: data.data.features });
        } catch (err) {
          this.clearSession();
        } finally {
          this.isInitialized = true;
          this._initPromise = null;
        }
      })();

      return this._initPromise;
    },
  },
});
