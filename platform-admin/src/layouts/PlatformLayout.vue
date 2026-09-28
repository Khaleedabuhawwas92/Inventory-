<script setup>
import { useRouter } from 'vue-router';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import PlatformSidebar from '@/components/PlatformSidebar.vue';

const ui = useUiStore();
const auth = useAuthStore();
const router = useRouter();

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen flex bg-surface dark:bg-surface-dark">
    <PlatformSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 shrink-0 sticky top-0 z-20 bg-white/90 dark:bg-surface-dark-card/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 px-4">
        <button class="lg:hidden btn-secondary !p-2" @click="ui.toggleSidebar()">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>

        <span class="badge-draft">وضع مدير المنصة</span>

        <div class="flex-1" />

        <button class="btn-secondary !p-2" @click="ui.toggleTheme()">
          <svg v-if="ui.theme === 'dark'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
          </svg>
        </button>

        <span class="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">{{ auth.fullName }}</span>
        <button class="btn-outline !px-3 !py-1.5 text-xs text-red-600" @click="logout">تسجيل الخروج</button>
      </header>

      <main class="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>
