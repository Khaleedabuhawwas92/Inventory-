<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import reportsService from '@/services/reportsService';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { exportToCsv } from '@/utils/exportCsv';
import { safePrint } from '@/utils/print';

const toast = useToast();
const tab = ref('low');
const lowRows = ref([]);
const outRows = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const [lowRes, outRes] = await Promise.all([reportsService.lowStock(), reportsService.outOfStock()]);
    lowRows.value = lowRes.data.data;
    outRows.value = outRes.data.data;
  } catch (err) {
    toast.error('تعذر تحميل التقرير');
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  const rows = tab.value === 'low' ? lowRows.value : outRows.value;
  const columns = [
    { label: 'الصنف', value: (r) => r.product.nameAr },
    { label: 'SKU', value: (r) => r.product.sku },
    { label: 'المخزن', value: (r) => r.warehouse.name },
    { label: 'الكمية الحالية', value: 'quantity' },
  ];
  if (tab.value === 'low') columns.push({ label: 'الحد الأدنى', value: (r) => r.product.minStock });
  exportToCsv(tab.value === 'low' ? 'low-stock-report' : 'out-of-stock-report', rows, columns);
}

onMounted(load);
</script>

<template>
  <div>
    <router-link to="/reports" class="text-sm text-primary-600 hover:underline">← مركز التقارير</router-link>
    <div class="flex items-center justify-between flex-wrap gap-3 mt-1 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">المخزون المنخفض والنافد</h1>
      <div class="flex items-center gap-2 print:hidden">
        <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
        <button class="btn-outline" @click="safePrint()">طباعة</button>
      </div>
    </div>

    <div class="flex items-center gap-2 mb-4 print:hidden">
      <button class="btn-outline" :class="{ '!bg-primary-600 !text-white': tab === 'low' }" @click="tab = 'low'">منخفض المخزون ({{ lowRows.length }})</button>
      <button class="btn-outline" :class="{ '!bg-primary-600 !text-white': tab === 'out' }" @click="tab = 'out'">نافد ({{ outRows.length }})</button>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <template v-else-if="tab === 'low'">
        <EmptyState v-if="!lowRows.length" title="لا توجد أصناف منخفضة المخزون" />
        <table v-else class="table-base">
          <thead><tr><th>الصنف</th><th>SKU</th><th>المخزن</th><th>الكمية الحالية</th><th>الحد الأدنى</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in lowRows" :key="i">
              <td class="font-medium">{{ r.product.nameAr }}</td>
              <td class="font-mono text-xs">{{ r.product.sku }}</td>
              <td>{{ r.warehouse.name }}</td>
              <td class="text-amber-600 font-medium">{{ r.quantity }}</td>
              <td>{{ r.product.minStock }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <template v-else>
        <EmptyState v-if="!outRows.length" title="لا توجد أصناف نافدة" />
        <table v-else class="table-base">
          <thead><tr><th>الصنف</th><th>SKU</th><th>المخزن</th><th>الكمية</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in outRows" :key="i">
              <td class="font-medium">{{ r.product.nameAr }}</td>
              <td class="font-mono text-xs">{{ r.product.sku }}</td>
              <td>{{ r.warehouse.name }}</td>
              <td class="text-red-600 font-medium">{{ r.quantity }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>
