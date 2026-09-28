<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const toast = useToast();
const loading = ref(true);
const data = ref(null);

const STAT_CARDS = [
  { key: 'organizations', label: 'إجمالي المؤسسات' },
  { key: 'activeOrganizations', label: 'مؤسسات نشطة' },
  { key: 'disabledOrganizations', label: 'مؤسسات معلّقة' },
  { key: 'users', label: 'إجمالي المستخدمين' },
  { key: 'activeUsers', label: 'مستخدمون نشطون' },
  { key: 'usersRegisteredToday', label: 'مستخدمون جدد اليوم' },
  { key: 'organizationsRegisteredThisMonth', label: 'مؤسسات جديدة هذا الشهر' },
  { key: 'warehouses', label: 'إجمالي المخازن' },
  { key: 'products', label: 'إجمالي الأصناف' },
  { key: 'openInvitations', label: 'دعوات مفتوحة' },
];

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load() {
  loading.value = true;
  try {
    const { data: res } = await platformService.dashboard();
    data.value = res.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل لوحة المنصة');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">لوحة تحكم المنصة</h1>

    <LoadingSpinner v-if="loading" />
    <template v-else-if="data">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <div v-for="card in STAT_CARDS" :key="card.key" class="card p-4">
          <p class="text-xs text-slate-400 mb-1">{{ card.label }}</p>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ data.totals[card.key] }}</p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2 mb-6">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">ملخص محاولات الدخول الفاشلة</h3>
          <div class="flex gap-6">
            <div>
              <p class="text-xs text-slate-400">آخر 24 ساعة</p>
              <p class="text-xl font-bold text-red-600">{{ data.failedLoginSummary.last24h }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">آخر 7 أيام</p>
              <p class="text-xl font-bold text-amber-600">{{ data.failedLoginSummary.last7d }}</p>
            </div>
          </div>
          <router-link to="/security" class="text-xs text-primary-600 hover:underline mt-3 inline-block">عرض تفاصيل الأمان ←</router-link>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">مؤسسات جديدة</h3>
          <ul class="space-y-2">
            <li v-for="org in data.recentOrganizations" :key="org._id" class="flex items-center justify-between text-sm">
              <router-link :to="`/organizations/${org._id}`" class="text-slate-700 dark:text-slate-200 hover:underline">{{ org.name }}</router-link>
              <span class="text-xs text-slate-400">{{ fmtDate(org.createdAt) }}</span>
            </li>
            <li v-if="!data.recentOrganizations.length" class="text-sm text-slate-400">لا توجد مؤسسات بعد</li>
          </ul>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">مستخدمون جدد</h3>
          <ul class="space-y-2">
            <li v-for="u in data.recentUsers" :key="u._id" class="flex items-center justify-between text-sm">
              <router-link :to="`/users/${u._id}`" class="text-slate-700 dark:text-slate-200 hover:underline">{{ u.fullName }} ({{ u.username }})</router-link>
              <span class="text-xs text-slate-400">{{ u.organizationId?.name }}</span>
            </li>
            <li v-if="!data.recentUsers.length" class="text-sm text-slate-400">لا يوجد مستخدمون بعد</li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">نشاط حديث على مستوى المنصة</h3>
          <ul class="space-y-2 max-h-72 overflow-y-auto">
            <li v-for="log in data.recentActivity" :key="log._id" class="text-sm border-b border-slate-100 dark:border-slate-700 pb-2">
              <p class="text-slate-700 dark:text-slate-200">{{ log.description }}</p>
              <p class="text-xs text-slate-400">{{ log.organizationId?.name || '—' }} · {{ fmtDate(log.createdAt) }}</p>
            </li>
            <li v-if="!data.recentActivity.length" class="text-sm text-slate-400">لا يوجد نشاط بعد</li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
