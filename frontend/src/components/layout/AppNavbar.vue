<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import searchService from '@/services/searchService';
import notificationService from '@/services/notificationService';
import { NOTIFICATION_DOT } from '@/constants/notificationTypes';

const TYPE_LABELS = {
  product: 'صنف', supplier: 'مورد', warehouse: 'مخزن', movement: 'حركة مخزون',
  'purchase-order': 'طلب شراء', 'goods-receipt': 'سند استلام',
};

const ui = useUiStore();
const auth = useAuthStore();
const router = useRouter();

const search = ref('');
const searchResults = ref([]);
const searchOpen = ref(false);
const searching = ref(false);
const userMenuOpen = ref(false);
const notifOpen = ref(false);
const notifications = ref([]);
const unreadCount = ref(0);
let pollTimer = null;

async function loadUnreadCount() {
  try {
    const { data } = await notificationService.list({ limit: 1 });
    unreadCount.value = data.meta.unreadCount;
  } catch (err) {
    // Silent — the badge just stays at its last known value.
  }
}

async function toggleNotifications() {
  notifOpen.value = !notifOpen.value;
  if (notifOpen.value) {
    const { data } = await notificationService.list({ limit: 10 });
    notifications.value = data.data;
    unreadCount.value = data.meta.unreadCount;
  }
}

async function openNotification(n) {
  if (!n.isRead) {
    await notificationService.markRead(n._id);
    n.isRead = true;
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  }
  notifOpen.value = false;
  if (n.route) router.push(n.route);
}

async function markAllRead() {
  await notificationService.markAllRead();
  notifications.value = notifications.value.map((n) => ({ ...n, isRead: true }));
  unreadCount.value = 0;
}

onMounted(() => {
  loadUnreadCount();
  pollTimer = setInterval(loadUnreadCount, 60000);
});
onUnmounted(() => clearInterval(pollTimer));

let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  if (search.value.trim().length < 2) {
    searchResults.value = [];
    searchOpen.value = false;
    return;
  }
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      const { data } = await searchService.search(search.value.trim());
      searchResults.value = data.data;
      searchOpen.value = true;
    } finally {
      searching.value = false;
    }
  }, 300);
}

function goToResult(result) {
  search.value = '';
  searchResults.value = [];
  searchOpen.value = false;
  router.push(result.route);
}

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <header class="h-16 shrink-0 sticky top-0 z-20 bg-white/90 dark:bg-surface-dark-card/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 px-4">
    <button class="lg:hidden btn-secondary !p-2" @click="ui.toggleSidebar()">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      </svg>
    </button>

    <div class="flex-1 max-w-md relative hidden sm:block">
      <svg class="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        v-model="search"
        type="text"
        placeholder="بحث شامل: صنف، باركود، مورد، رقم حركة..."
        class="input !pr-9"
        @input="onSearchInput"
        @focus="search.trim().length >= 2 && (searchOpen = true)"
        @blur="() => setTimeout(() => (searchOpen = false), 150)"
      />
      <div v-if="searchOpen" class="absolute z-30 mt-1 w-full card p-1 max-h-80 overflow-y-auto">
        <p v-if="searching" class="px-3 py-2 text-sm text-slate-400">جاري البحث...</p>
        <p v-else-if="!searchResults.length" class="px-3 py-2 text-sm text-slate-400">لا توجد نتائج</p>
        <button
          v-for="(r, i) in searchResults" :key="i" type="button"
          class="w-full text-right px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center justify-between gap-2"
          @mousedown.prevent="goToResult(r)"
        >
          <span class="truncate">{{ r.label }}</span>
          <span class="text-xs text-slate-400 shrink-0">{{ TYPE_LABELS[r.type] }}<span v-if="r.sublabel"> · {{ r.sublabel }}</span></span>
        </button>
      </div>
    </div>

    <div class="flex-1 sm:hidden" />

    <select class="input !w-auto hidden md:block">
      <option>المخزن الرئيسي</option>
    </select>

    <button class="btn-secondary !p-2" @click="ui.toggleTheme()">
      <svg v-if="ui.theme === 'dark'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
      <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
      </svg>
    </button>

    <div class="relative">
      <button class="btn-secondary !p-2 relative" @click="toggleNotifications">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        <span v-if="unreadCount > 0" class="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-surface-dark-card" />
      </button>
      <div v-if="notifOpen" class="absolute left-0 mt-2 w-80 card p-0 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700">
          <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200">الإشعارات</h4>
          <button v-if="unreadCount > 0" class="text-xs text-primary-600 hover:underline" @click="markAllRead">وضع علامة مقروء على الكل</button>
        </div>
        <div class="max-h-80 overflow-y-auto">
          <p v-if="!notifications.length" class="px-3 py-6 text-sm text-slate-400 text-center">لا توجد إشعارات</p>
          <button
            v-for="n in notifications" :key="n._id" type="button"
            class="w-full text-right px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 border-b border-slate-50 dark:border-slate-700/60"
            :class="{ 'bg-primary-50/50 dark:bg-primary-900/10': !n.isRead }"
            @click="openNotification(n)"
          >
            <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" :class="NOTIFICATION_DOT[n.type] || 'bg-slate-400'" />
            <span class="flex-1 min-w-0">
              <span class="block text-sm text-slate-700 dark:text-slate-200 truncate">{{ n.title }}</span>
              <span class="block text-xs text-slate-400 truncate">{{ n.message }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="relative">
      <button class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" @click="userMenuOpen = !userMenuOpen">
        <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-bold">
          {{ (auth.fullName || 'م')[0] }}
        </div>
        <span class="hidden md:block text-sm font-medium text-slate-700 dark:text-slate-200">{{ auth.fullName || 'المستخدم' }}</span>
      </button>
      <div v-if="userMenuOpen" class="absolute left-0 mt-2 w-48 card p-1 text-sm">
        <router-link to="/profile" class="block px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700" @click="userMenuOpen = false">الملف الشخصي</router-link>
        <router-link to="/settings" class="block px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700" @click="userMenuOpen = false">الإعدادات</router-link>
        <hr class="my-1 border-slate-200 dark:border-slate-700" />
        <button class="w-full text-right px-3 py-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" @click="logout">تسجيل الخروج</button>
      </div>
    </div>
  </header>
</template>
