// The Platform Admin control panel is a completely separate app/project
// (platform-admin/, its own origin) — this tenant app never bundles any of
// its pages/routes/code. This is only the URL for a small external link out
// to it (spec: "unless a small external link ... is intentionally needed"),
// shown in AppNavbar.vue's user menu when the signed-in account happens to
// be a platform admin. Configurable so a production build can point at the
// deployed platform-admin URL instead of localhost.
export const PLATFORM_ADMIN_URL = import.meta.env.VITE_PLATFORM_ADMIN_URL || 'http://localhost:5174';
