<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-surface dark:bg-surface-dark px-4 text-center">
    <p class="text-6xl font-extrabold text-primary-600">404</p>
    <h1 class="mt-4 text-xl font-bold text-slate-700 dark:text-slate-200">الصفحة غير موجودة</h1>
    <p class="mt-2 text-sm text-slate-400">الرابط الذي حاولت الوصول إليه غير موجود أو تم نقله.</p>
    <button class="btn-primary mt-6" @click="router.push('/')">العودة إلى الرئيسية</button>
  </div>
</template>
