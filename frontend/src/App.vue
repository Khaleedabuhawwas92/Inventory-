<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import systemService from '@/services/systemService';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const ui = useUiStore();
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const bootState = ref('checking'); // checking | backend-down | ready
const retrying = ref(false);

async function checkBackend() {
  try {
    await systemService.checkHealth();
    return true;
  } catch (err) {
    return false;
  }
}

async function boot() {
  bootState.value = 'checking';
  const backendUp = await checkBackend();
  if (!backendUp) {
    bootState.value = 'backend-down';
    return;
  }
  await auth.initSession();
  bootState.value = 'ready';
}

async function retryConnection() {
  retrying.value = true;
  await boot();
  retrying.value = false;
}

function handleSessionExpired() {
  if (auth.isAuthenticated) {
    auth.clearSession();
    toast.info('انتهت جلستك، الرجاء تسجيل الدخول مجدداً');
    router.push({ name: 'login' });
  }
}

onMounted(() => {
  ui.initTheme();
  boot();
  window.addEventListener('auth:session-expired', handleSessionExpired);
});

onUnmounted(() => {
  window.removeEventListener('auth:session-expired', handleSessionExpired);
});
</script>

<template>
  <div v-if="bootState === 'checking'" class="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface dark:bg-surface-dark">
    <div class="w-16 h-16 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-2xl animate-pulse">م</div>
    <p class="text-sm text-slate-400">جاري تحميل نظام إدارة المخزون...</p>
  </div>

  <div v-else-if="bootState === 'backend-down'" class="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface dark:bg-surface-dark px-4 text-center">
    <div class="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
      <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
      </svg>
    </div>
    <h2 class="font-bold text-slate-700 dark:text-slate-200">تعذر الاتصال بالخادم</h2>
    <p class="text-sm text-slate-400 max-w-sm">تأكد من أن الخادم (Backend) يعمل وأن قاعدة البيانات متصلة، ثم حاول مجدداً.</p>
    <button class="btn-primary" :disabled="retrying" @click="retryConnection">
      {{ retrying ? 'جاري المحاولة...' : 'إعادة المحاولة' }}
    </button>
  </div>

  <template v-else>
    <router-view />
    <ConfirmDialog />
  </template>
</template>
