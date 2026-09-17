<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import reportsService from '@/services/reportsService';
import warehouseService from '@/services/warehouseService';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { exportToCsv } from '@/utils/exportCsv';
import { safePrint } from '@/utils/print';

const toast = useToast();
const rows = ref([]);
const total = ref(0);
const warehouses = ref([]);
const loading = ref(true);
const filters = reactive({ warehouse: '' });

async function load() {
  loading.value = true;
  try {
    const { data } = await reportsService.stockValuation({ warehouse: filters.warehouse || undefined });
    rows.value = data.data;
    total.value = data.meta.total;
  } catch (err) {
    toast.error('تعذر تحميل التقرير');
  } finally {
    loading.value = false;
  }
}

watch(() => filters.warehouse, load);

function exportCsv() {
  exportToCsv('stock-valuation-report', rows.value, [
    { label: 'الصنف', value: (r) => r.product.nameAr },
    { label: 'SKU', value: (r) => r.product.sku },
    { label: 'المخزن', value: (r) => r.warehouse.name },
    { label: 'الكمية', value: 'quantity' },
    { label: 'متوسط التكلفة', value: 'averageCost' },
    { label: 'القيمة', value: 'value' },
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
    <router-link to="/reports" class="text-sm text-primary-600 hover:underline">← مركز التقارير</router-link>
    <div class="flex items-center justify-between flex-wrap gap-3 mt-1 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">تقرير تقييم المخزون</h1>
      <div class="flex items-center gap-2 print:hidden">
        <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
        <button class="btn-outline" @click="safePrint()">طباعة</button>
      </div>
    </div>

    <div class="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3 print:hidden">
      <select v-model="filters.warehouse" class="input !w-auto">
        <option value="">كل المخازن</option>
        <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
      </select>
      <p class="text-sm text-slate-500 dark:text-slate-400">إجمالي القيمة: <strong class="text-slate-800 dark:text-slate-100">{{ total.toFixed(2) }}</strong></p>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!rows.length" title="لا توجد بيانات" />
      <table v-else class="table-base">
        <thead><tr><th>الصنف</th><th>SKU</th><th>المخزن</th><th>الكمية</th><th>متوسط التكلفة</th><th>القيمة</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td class="font-medium">{{ r.product.nameAr }}</td>
            <td class="font-mono text-xs">{{ r.product.sku }}</td>
            <td>{{ r.warehouse.name }}</td>
            <td>{{ r.quantity }}</td>
            <td>{{ r.averageCost?.toFixed(2) }}</td>
            <td>{{ r.value?.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
