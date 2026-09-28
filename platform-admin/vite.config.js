import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// A separate port from the tenant frontend (5173) and the desktop app's Vite
// instance, so both can run side by side during development. The backend's
// CORS config (backend/config/env.js's PLATFORM_ADMIN_URL) must match this.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
});
