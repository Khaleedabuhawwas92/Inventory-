import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarOpen: window.innerWidth >= 1024,
    sidebarCollapsed: false,
    theme: localStorage.getItem('theme') || 'light',
    globalLoading: false,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },
    closeSidebar() {
      this.sidebarOpen = false;
    },
    toggleSidebarCollapsed() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    setTheme(theme) {
      this.theme = theme;
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    },
    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
    },
    initTheme() {
      document.documentElement.classList.toggle('dark', this.theme === 'dark');
    },
    setGlobalLoading(value) {
      this.globalLoading = value;
    },
  },
});
