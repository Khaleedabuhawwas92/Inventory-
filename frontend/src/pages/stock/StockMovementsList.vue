<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import stockService from '@/services/stockService';
import warehouseService from '@/services/warehouseService';
import { MOVEMENT_TYPE_LABELS, isIncomingMovement } from '@/constants/movementTypes';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { exportToCsv } from '@/utils/exportCsv';

const toast = useToast();
const items = ref([]);
const warehouses = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ warehouse: '', type: '', from: '', to: '' });

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await stockService.movements({
      page,
      warehouse: filters.warehouse || undefined,
      type: filters.type || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error('تعذر تحميل سجل الحركات');
  } finally {
    loading.value = false;
  }
}

watch(() => [filters.warehouse, filters.type, filters.from, filters.to], () => load(1));

function exportCsv() {
  exportToCsv('stock-movements', items.value, [
    { label: 'رقم الحركة', value: 'movementNo' },
    { label: 'النوع', value: (r) => MOVEMENT_TYPE_LABELS[r.type] || r.type },
    { label: 'الصنف', value: (r) => r.product?.nameAr },
    { label: 'المخزن', value: (r) => r.warehouse?.name },
    { label: 'الكمية', value: 'quantity' },
    { label: 'الرصيد بعد', value: 'afterQty' },
    { label: 'التاريخ', value: (r) => new Date(r.createdAt).toLocaleString('ar') },
    { label: 'المستخدم', value: (r) => r.createdBy?.fullName },
  ]);
}

onMounted(async () => {
  const { data } = await warehouseService.list();
  warehouses.value = data.data;
  load();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">سجل الحركات</h1>
      <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <select v-model="filters.warehouse" class="input !w-auto">
        <option value="">كل المخازن</option>
        <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
      </select>
      <select v-model="filters.type" class="input !w-auto">
        <option value="">كل الأنواع</option>
        <option v-for="(label, key) in MOVEMENT_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <input v-model="filters.from" type="date" class="input !w-auto" />
      <input v-model="filters.to" type="date" class="input !w-auto" />
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد حركات" />
      <table v-else class="table-base">
        <thead>
          <tr><th>التاريخ</th><th>رقم الحركة</th><th>النوع</th><th>الصنف</th><th>المخزن</th><th>الكمية</th><th>الرصيد بعد</th><th>المستخدم</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in items" :key="m._id">
            <td class="text-xs text-slate-400">{{ new Date(m.createdAt).toLocaleString('ar') }}</td>
            <td class="font-mono text-xs">{{ m.movementNo }}</td>
            <td>{{ MOVEMENT_TYPE_LABELS[m.type] || m.type }}</td>
            <td>{{ m.product?.nameAr }}</td>
            <td>{{ m.warehouse?.name }}</td>
            <td :class="isIncomingMovement(m) ? 'text-green-600' : 'text-red-600'">
              {{ isIncomingMovement(m) ? '+' : '-' }}{{ m.quantity }}
            </td>
            <td class="font-medium">{{ m.afterQty }}</td>
            <td>{{ m.createdBy?.fullName || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
