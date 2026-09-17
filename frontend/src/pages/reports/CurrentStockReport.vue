<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import reportsService from '@/services/reportsService';
import warehouseService from '@/services/warehouseService';
import categoryService from '@/services/categoryService';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { exportToCsv } from '@/utils/exportCsv';
import { safePrint } from '@/utils/print';

const toast = useToast();
const rows = ref([]);
const warehouses = ref([]);
const categories = ref([]);
const loading = ref(true);
const filters = reactive({ warehouse: '', category: '', search: '' });

async function load() {
  loading.value = true;
  try {
    const { data } = await reportsService.currentStock({
      warehouse: filters.warehouse || undefined, category: filters.category || undefined, search: filters.search || undefined,
    });
    rows.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل التقرير');
  } finally {
    loading.value = false;
  }
}

let timer = null;
watch(() => [filters.warehouse, filters.category, filters.search], () => { clearTimeout(timer); timer = setTimeout(load, 300); });

function exportCsv() {
  exportToCsv('current-stock-report', rows.value, [
    { label: 'الصنف', value: (r) => r.product.nameAr },
    { label: 'SKU', value: (r) => r.product.sku },
    { label: 'التصنيف', value: (r) => r.category?.nameAr },
    { label: 'المخزن', value: (r) => r.warehouse.name },
    { label: 'الكمية', value: 'quantity' },
    { label: 'متوسط التكلفة', value: 'averageCost' },
    { label: 'القيمة', value: 'value' },
  ]);
}

onMounted(async () => {
  const [whRes, catRes] = await Promise.all([warehouseService.list(), categoryService.list()]);
  warehouses.value = whRes.data.data;
  categories.value = catRes.data.data;
  load();
});
</script>

<template>
  <div>
    <router-link to="/reports" class="text-sm text-primary-600 hover:underline">← مركز التقارير</router-link>
    <div class="flex items-center justify-between flex-wrap gap-3 mt-1 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">تقرير المخزون الحالي</h1>
      <div class="flex items-center gap-2 print:hidden">
        <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
        <button class="btn-outline" @click="safePrint()">طباعة</button>
      </div>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 print:hidden">
      <input v-model="filters.search" class="input flex-1 min-w-[180px]" placeholder="بحث..." />
      <select v-model="filters.warehouse" class="input !w-auto">
        <option value="">كل المخازن</option>
        <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
      </select>
      <select v-model="filters.category" class="input !w-auto">
        <option value="">كل التصنيفات</option>
        <option v-for="c in categories" :key="c._id" :value="c._id">{{ c.nameAr }}</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!rows.length" title="لا توجد نتائج" />
      <table v-else class="table-base">
        <thead><tr><th>الصنف</th><th>SKU</th><th>التصنيف</th><th>المخزن</th><th>الكمية</th><th>متوسط التكلفة</th><th>القيمة</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td class="font-medium">{{ r.product.nameAr }}</td>
            <td class="font-mono text-xs">{{ r.product.sku }}</td>
            <td>{{ r.category?.nameAr || '—' }}</td>
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
