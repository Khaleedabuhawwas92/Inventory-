<script setup>
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
    <div class="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
      <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    </div>
    <h1 class="font-bold text-lg text-slate-700 dark:text-slate-200">ليس لديك صلاحية إدارة المنصة</h1>
    <p class="text-sm text-slate-400 max-w-sm">هذا التطبيق مخصص لمدير المنصة (Platform Admin) فقط.</p>
    <router-link v-if="!auth.isAuthenticated" to="/login" class="btn-primary mt-2">تسجيل الدخول</router-link>
  </div>
</template>
