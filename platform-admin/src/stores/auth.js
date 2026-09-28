import { defineStore } from 'pinia';
import authService from '@/services/authService';

const NOT_PLATFORM_ADMIN_MESSAGE = 'ليس لديك صلاحية إدارة المنصة';

// Dedicated to the Platform Admin app — separate from the tenant frontend's
// auth store (different app, different localStorage key, different origin).
// isPlatformAdmin is re-verified on every session (login AND restore/refresh
// via /auth/me), never cached across app versions or trusted from a stale
// token payload — the JWT itself carries no role/flag claims (see
// backend/services/tokenService.js), only `sub`, so this always reflects a
// fresh server read of req.user.isPlatformAdmin.
export const useAuthStore = defineStore('platformAuth', {
  state: () => ({
    user: null,
    accessToken: localStorage.getItem('platformAccessToken') || null,
    isInitialized: false,
    _initPromise: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.accessToken && !!state.user,
    isPlatformAdmin: (state) => state.user?.isPlatformAdmin === true,
    fullName: (state) => state.user?.fullName || '',
  },
  actions: {
    setSession({ user, accessToken }) {
      this.user = user;
      if (accessToken) {
        this.accessToken = accessToken;
        localStorage.setItem('platformAccessToken', accessToken);
      }
    },

    clearSession() {
      this.user = null;
      this.accessToken = null;
      localStorage.removeItem('platformAccessToken');
    },

    // Throws with a clear Arabic message for the Login page to display, and
    // never leaves a session behind for a real-but-non-platform-admin
    // account — a valid login for an ordinary organization user must not
    // grant this app anything.
    async login(identifier, password) {
      const { data } = await authService.login(identifier, password);
      const { user, accessToken } = data.data;

      if (user.isPlatformAdmin !== true) {
        this.setSession({ user, accessToken }); // needed so logout() has a session to revoke
        await this.logout();
        throw new Error(NOT_PLATFORM_ADMIN_MESSAGE);
      }

      this.setSession({ user, accessToken });
      return user;
    },

    async logout() {
      try {
        await authService.logout();
      } finally {
        this.clearSession();
      }
    },

    // Called on app boot and by the router guard — shares the in-flight
    // promise so both never race two /auth/me round-trips.
    async initSession() {
      if (this.isInitialized) return;
      if (this._initPromise) return this._initPromise;

      this._initPromise = (async () => {
        try {
          const { data } = await authService.me();
          const user = data.data.user;
          if (user.isPlatformAdmin !== true) {
            // A previously-valid token whose account no longer qualifies
            // (or never did) — never leave it signed in to this app.
            await this.logout();
          } else {
            this.setSession({ user });
          }
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
