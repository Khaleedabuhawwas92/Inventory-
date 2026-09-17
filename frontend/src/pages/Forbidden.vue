<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <div class="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
      <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    </div>
    <h2 class="text-lg font-bold text-slate-700 dark:text-slate-200">غير مصرح لك بالوصول</h2>
    <p class="text-sm text-slate-400 mt-2">ليس لديك الصلاحية اللازمة لعرض هذه الصفحة.</p>
    <button class="btn-primary mt-6" @click="router.push('/dashboard')">العودة إلى الرئيسية</button>
  </div>
</template>
