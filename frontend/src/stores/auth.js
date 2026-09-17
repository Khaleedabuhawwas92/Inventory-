import { defineStore } from 'pinia';
import authService from '@/services/authService';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    permissions: [],
    accessToken: localStorage.getItem('accessToken') || null,
    isInitialized: false,
    isSuperAdmin: false,
    _initPromise: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.accessToken && !!state.user,
    fullName: (state) => state.user?.fullName || '',
    roleLabel: (state) => state.user?.role?.nameAr || '',
    warehouseName: (state) => state.user?.warehouse?.name || '',
  },
  actions: {
    can(permission) {
      if (!permission) return true;
      if (this.isSuperAdmin) return true;
      return this.permissions.includes(permission);
    },

    setSession({ user, accessToken, permissions }) {
      this.user = user;
      this.permissions = permissions || user?.role?.permissions || [];
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
      this.isSuperAdmin = false;
      localStorage.removeItem('accessToken');
    },

    async login(identifier, password) {
      const { data } = await authService.login(identifier, password);
      this.setSession({ user: data.data.user, accessToken: data.data.accessToken });
      return data.data.user;
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
          this.setSession({ user: data.data.user, permissions: data.data.permissions });
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
