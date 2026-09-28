<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const toast = useToast();

const items = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ organizationId: '', status: '' });

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.invitations({
      page,
      organizationId: filters.organizationId || undefined,
      status: filters.status || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل الدعوات');
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch(() => [filters.organizationId, filters.status], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});

onMounted(() => load());
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">الدعوات (كل المؤسسات)</h1>
    <p class="text-sm text-slate-400 mb-4">مدير المؤسسة يرى دعواته الخاصة فقط؛ هذه القائمة عرض شامل لكل مؤسسة.</p>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <input v-model="filters.organizationId" class="input !w-auto" placeholder="معرّف المؤسسة" />
      <select v-model="filters.status" class="input !w-auto">
        <option value="">كل الحالات</option>
        <option value="active">فعّالة</option>
        <option value="used">مستخدمة</option>
        <option value="revoked">ملغاة</option>
        <option value="expired">منتهية</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد دعوات" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>المؤسسة</th>
            <th>الرمز</th>
            <th>الدور</th>
            <th>أنشأها</th>
            <th>تاريخ الإنشاء</th>
            <th>تنتهي في</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in items" :key="inv._id">
            <td>{{ inv.organization?.name || '—' }}</td>
            <td class="font-mono text-xs">{{ inv.codeMasked }}</td>
            <td>{{ inv.role?.nameAr }}</td>
            <td class="text-sm">{{ inv.createdBy?.fullName || '—' }}</td>
            <td class="text-xs text-slate-400">{{ fmtDate(inv.createdAt) }}</td>
            <td class="text-xs text-slate-400">{{ fmtDate(inv.expiresAt) }}</td>
            <td><StatusBadge :status="inv.status" /></td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
