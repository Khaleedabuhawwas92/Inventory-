<script setup>
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { navigation } from '@/constants/navigation';
import SidebarLink from './SidebarLink.vue';
import SidebarGroup from './SidebarGroup.vue';

const ui = useUiStore();
const auth = useAuthStore();

const visibleNavigation = computed(() =>
  navigation
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((c) => auth.can(c.permission));
        return children.length ? { ...item, children } : null;
      }
      return auth.can(item.permission) ? item : null;
    })
    .filter(Boolean)
);
</script>

<template>
  <!-- Mobile overlay -->
  <div
    v-if="ui.sidebarOpen"
    class="fixed inset-0 z-30 bg-black/40 lg:hidden"
    @click="ui.closeSidebar()"
  />

  <aside
    class="fixed z-40 inset-y-0 right-0 w-72 bg-white dark:bg-surface-dark-card border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-0"
    :class="ui.sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'"
  >
    <div class="h-16 flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
      <div class="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold">م</div>
      <div class="leading-tight">
        <p class="font-bold text-sm text-slate-800 dark:text-slate-100">نظام إدارة المخزون</p>
        <p class="text-xs text-slate-400">الإصدار 1.0</p>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
      <template v-for="item in visibleNavigation" :key="item.title">
        <SidebarGroup v-if="item.children" :item="item" />
        <SidebarLink v-else :item="item" />
      </template>
    </nav>

    <div class="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
      <router-link to="/profile" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        الملف الشخصي
      </router-link>
    </div>
  </aside>
</template>
