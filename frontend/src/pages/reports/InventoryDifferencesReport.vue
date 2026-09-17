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
const warehouses = ref([]);
const loading = ref(true);
const filters = reactive({ warehouse: '', direction: '' });

async function load() {
  loading.value = true;
  try {
    const { data } = await reportsService.inventoryDifferences({
      warehouse: filters.warehouse || undefined, direction: filters.direction || undefined,
    });
    rows.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل التقرير');
  } finally {
    loading.value = false;
  }
}

watch(() => [filters.warehouse, filters.direction], load);

function exportCsv() {
  exportToCsv('inventory-differences-report', rows.value, [
    { label: 'رقم الجرد', value: 'docNo' },
    { label: 'التاريخ', value: (r) => new Date(r.date).toLocaleDateString('ar') },
    { label: 'المخزن', value: 'warehouse' },
    { label: 'الصنف', value: 'product' },
    { label: 'SKU', value: 'sku' },
    { label: 'الكمية بالنظام', value: 'systemQty' },
    { label: 'الكمية الفعلية', value: 'physicalQty' },
    { label: 'الفرق', value: 'difference' },
    { label: 'فرق القيمة', value: 'differenceValue' },
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
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">فروقات الجرد</h1>
      <div class="flex items-center gap-2 print:hidden">
        <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
        <button class="btn-outline" @click="safePrint()">طباعة</button>
      </div>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 print:hidden">
      <select v-model="filters.warehouse" class="input !w-auto">
        <option value="">كل المخازن</option>
        <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
      </select>
      <select v-model="filters.direction" class="input !w-auto">
        <option value="">الكل</option>
        <option value="shortage">نقص فقط</option>
        <option value="surplus">زيادة فقط</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!rows.length" title="لا توجد فروقات" />
      <table v-else class="table-base">
        <thead><tr><th>رقم الجرد</th><th>التاريخ</th><th>المخزن</th><th>الصنف</th><th>بالنظام</th><th>فعلي</th><th>الفرق</th><th>فرق القيمة</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td class="font-mono text-xs">{{ r.docNo }}</td>
            <td class="text-xs text-slate-400">{{ new Date(r.date).toLocaleDateString('ar') }}</td>
            <td>{{ r.warehouse }}</td>
            <td class="font-medium">{{ r.product }}</td>
            <td>{{ r.systemQty }}</td>
            <td>{{ r.physicalQty }}</td>
            <td :class="r.difference > 0 ? 'text-green-600' : 'text-red-600'">{{ r.difference > 0 ? '+' : '' }}{{ r.difference }}</td>
            <td :class="r.differenceValue > 0 ? 'text-green-600' : 'text-red-600'">{{ r.differenceValue?.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
