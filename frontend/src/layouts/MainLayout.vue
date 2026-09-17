<script setup>
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppNavbar from '@/components/layout/AppNavbar.vue';
</script>

<template>
  <div class="min-h-screen flex bg-surface dark:bg-surface-dark">
    <!-- ✅ لا تُطبع أبداً — القائمة الجانبية جزء من واجهة التطبيق فقط -->
    <div class="print:hidden">
      <AppSidebar />
    </div>
    <div class="flex-1 flex flex-col min-w-0">
      <!-- ✅ لا تُطبع أبداً — نفس السبب -->
      <div class="print:hidden">
        <AppNavbar />
      </div>
      <main class="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto print:p-0 print:max-w-none print:mx-0 print:w-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>
