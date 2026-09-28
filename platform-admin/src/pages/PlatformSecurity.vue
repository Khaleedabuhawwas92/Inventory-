<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const toast = useToast();
const loading = ref(true);
const data = ref(null);

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load() {
  loading.value = true;
  try {
    const { data: res } = await platformService.security();
    data.value = res.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل بيانات الأمان');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">الأمان</h1>

    <LoadingSpinner v-if="loading" />
    <template v-else-if="data">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div class="card p-4">
          <p class="text-xs text-slate-400 mb-1">محاولات دخول فاشلة (24 ساعة)</p>
          <p class="text-2xl font-bold text-red-600">{{ data.failedLoginSummary.last24h }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-slate-400 mb-1">محاولات دخول فاشلة (7 أيام)</p>
          <p class="text-2xl font-bold text-amber-600">{{ data.failedLoginSummary.last7d }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-slate-400 mb-1">حسابات معطّلة</p>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ data.disabledUsers.count }}</p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2 mb-6">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-1">محاولات مشبوهة (تكرار فشل الدخول)</h3>
          <p class="text-xs text-slate-400 mb-3">3 محاولات فاشلة أو أكثر لنفس الحساب خلال 24 ساعة</p>
          <ul class="space-y-2 max-h-72 overflow-y-auto">
            <li v-for="s in data.suspiciousRepeatedFailures" :key="s._id" class="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5">
              <router-link :to="`/users/${s.user._id}`" class="text-primary-600 hover:underline">{{ s.user.fullName }} ({{ s.user.username }})</router-link>
              <span class="text-red-600 font-bold">{{ s.count }}</span>
            </li>
            <li v-if="!data.suspiciousRepeatedFailures.length" class="text-sm text-slate-400">لا توجد محاولات مشبوهة حالياً</li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">حسابات معطّلة حديثاً</h3>
          <ul class="space-y-2 max-h-72 overflow-y-auto">
            <li v-for="u in data.disabledUsers.recent" :key="u._id" class="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5">
              <router-link :to="`/users/${u._id}`" class="text-primary-600 hover:underline">{{ u.fullName }}</router-link>
              <span class="text-xs text-slate-400">{{ u.organizationId?.name }}</span>
            </li>
            <li v-if="!data.disabledUsers.recent.length" class="text-sm text-slate-400">لا يوجد حسابات معطّلة</li>
          </ul>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">إعادة تعيين كلمات مرور حديثة</h3>
          <ul class="space-y-2 max-h-72 overflow-y-auto">
            <li v-for="log in data.recentPasswordResets" :key="log._id" class="text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5">
              <p class="text-slate-700 dark:text-slate-200">{{ log.description }}</p>
              <p class="text-xs text-slate-400">{{ log.organizationId?.name }} · {{ fmtDate(log.createdAt) }}</p>
            </li>
            <li v-if="!data.recentPasswordResets.length" class="text-sm text-slate-400">لا يوجد سجل</li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">إجراءات مدير المنصة الأخيرة</h3>
          <ul class="space-y-2 max-h-72 overflow-y-auto">
            <li v-for="log in data.recentPlatformAdminActions" :key="log._id" class="text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5">
              <p class="text-slate-700 dark:text-slate-200">{{ log.description }}</p>
              <p class="text-xs text-slate-400">{{ log.organizationId?.name }} · {{ fmtDate(log.createdAt) }}</p>
            </li>
            <li v-if="!data.recentPlatformAdminActions.length" class="text-sm text-slate-400">لا يوجد سجل</li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
