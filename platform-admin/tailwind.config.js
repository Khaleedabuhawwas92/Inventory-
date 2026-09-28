/** @type {import('tailwindcss').Config} */
// Same design system conventions as frontend/tailwind.config.js (font, RTL,
// card/btn/badge utility classes in src/assets/main.css) but a distinct
// accent color (slate instead of blue) so the Platform Admin app is visually
// distinguishable at a glance from the tenant inventory app — spec §10.
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Cairo"', '"Tajawal"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        surface: {
          light: '#ffffff',
          DEFAULT: '#f8fafc',
          dark: '#0f172a',
          'dark-card': '#1e293b',
        },
        status: {
          draft: '#6b7280',
          pending: '#f59e0b',
          approved: '#16a34a',
          cancelled: '#dc2626',
          transit: '#2563eb',
        },
      },
    },
  },
  plugins: [],
};
