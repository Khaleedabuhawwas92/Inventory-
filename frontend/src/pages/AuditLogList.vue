<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import auditLogService from '@/services/auditLogService';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const ACTION_LABELS = {
  LOGIN: 'تسجيل دخول', LOGOUT: 'تسجيل خروج', LOGIN_FAILED: 'محاولة دخول فاشلة',
  CREATE: 'إنشاء', UPDATE: 'تعديل', DELETE: 'حذف',
  APPROVE: 'اعتماد', CANCEL: 'إلغاء', REVERSAL: 'عكس عملية',
  PRINT: 'طباعة', EXPORT: 'تصدير',
  PASSWORD_RESET: 'إعادة تعيين كلمة مرور', PERMISSION_CHANGE: 'تعديل صلاحيات',
};
const ACTION_TONES = {
  LOGIN_FAILED: 'text-red-600', DELETE: 'text-red-600', CANCEL: 'text-red-600',
  CREATE: 'text-green-600', APPROVE: 'text-green-600',
};

const toast = useToast();
const items = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ action: '', entityType: '', from: '', to: '' });

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await auditLogService.list({
      page, action: filters.action || undefined, entityType: filters.entityType || undefined,
      from: filters.from || undefined, to: filters.to || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error('تعذر تحميل سجل العمليات');
  } finally {
    loading.value = false;
  }
}

watch(() => [filters.action, filters.entityType, filters.from, filters.to], () => load(1));
onMounted(() => load());
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">سجل العمليات</h1>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <select v-model="filters.action" class="input !w-auto">
        <option value="">كل الإجراءات</option>
        <option v-for="(label, key) in ACTION_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <input v-model="filters.entityType" class="input !w-auto" placeholder="نوع العنصر (مثال: Product)" />
      <input v-model="filters.from" type="date" class="input !w-auto" />
      <input v-model="filters.to" type="date" class="input !w-auto" />
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد عمليات مسجلة" />
      <table v-else class="table-base">
        <thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>الوصف</th><th>IP</th></tr></thead>
        <tbody>
          <tr v-for="log in items" :key="log._id">
            <td class="text-xs text-slate-400 whitespace-nowrap">{{ new Date(log.createdAt).toLocaleString('ar') }}</td>
            <td>{{ log.user?.fullName || log.userDisplay || '—' }}</td>
            <td :class="ACTION_TONES[log.action] || ''" class="font-medium">{{ ACTION_LABELS[log.action] || log.action }}</td>
            <td class="text-sm text-slate-600 dark:text-slate-300">{{ log.description }}</td>
            <td class="text-xs text-slate-400 font-mono">{{ log.ip || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
