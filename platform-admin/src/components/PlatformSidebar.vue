<script setup>
import { useRoute } from 'vue-router';
import { useUiStore } from '@/stores/ui';

const items = [
  { title: 'لوحة المنصة', to: '/', exact: true },
  { title: 'المؤسسات', to: '/organizations' },
  { title: 'المستخدمون', to: '/users' },
  { title: 'سجل النشاط', to: '/audit' },
  { title: 'الأمان', to: '/security' },
  { title: 'الدعوات', to: '/invitations' },
];

const ui = useUiStore();
const route = useRoute();

function isActive(item) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to);
}
</script>

<template>
  <div v-if="ui.sidebarOpen" class="fixed inset-0 z-30 bg-black/40 lg:hidden" @click="ui.closeSidebar()" />

  <aside
    class="fixed z-40 inset-y-0 right-0 w-72 bg-white dark:bg-surface-dark-card border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-0"
    :class="ui.sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'"
  >
    <div class="h-16 flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
      <div class="w-9 h-9 rounded-lg bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold">م</div>
      <div class="leading-tight">
        <p class="font-bold text-sm text-slate-800 dark:text-slate-100">إدارة المنصة</p>
        <p class="text-xs text-slate-400">Platform Admin</p>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
        :class="isActive(item)
          ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'"
      >
        <span class="w-2 h-2 rounded-full shrink-0" :class="isActive(item) ? 'bg-white' : 'bg-slate-300 dark:bg-slate-600'" />
        {{ item.title }}
      </router-link>
    </nav>
  </aside>
</template>
