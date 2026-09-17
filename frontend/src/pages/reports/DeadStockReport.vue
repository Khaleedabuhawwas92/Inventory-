<script setup>
import { onMounted, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import reportsService from '@/services/reportsService';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { exportToCsv } from '@/utils/exportCsv';
import { safePrint } from '@/utils/print';

const toast = useToast();
const rows = ref([]);
const days = ref(90);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const { data } = await reportsService.deadStock({ days: days.value });
    rows.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل التقرير');
  } finally {
    loading.value = false;
  }
}

watch(days, load);

function exportCsv() {
  exportToCsv('dead-stock-report', rows.value, [
    { label: 'الصنف', value: (r) => r.product.nameAr },
    { label: 'SKU', value: (r) => r.product.sku },
    { label: 'المخزن', value: (r) => r.warehouse.name },
    { label: 'الكمية', value: 'quantity' },
    { label: 'متوسط التكلفة', value: 'averageCost' },
  ]);
}

onMounted(load);
</script>

<template>
  <div>
    <router-link to="/reports" class="text-sm text-primary-600 hover:underline">← مركز التقارير</router-link>
    <div class="flex items-center justify-between flex-wrap gap-3 mt-1 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">الأصناف الراكدة</h1>
      <div class="flex items-center gap-2 print:hidden">
        <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
        <button class="btn-outline" @click="safePrint()">طباعة</button>
      </div>
    </div>

    <div class="card p-4 mb-4 flex items-center gap-3 print:hidden">
      <label class="label !mb-0">بدون حركة منذ (أيام)</label>
      <select v-model.number="days" class="input !w-auto">
        <option :value="30">30</option>
        <option :value="60">60</option>
        <option :value="90">90</option>
        <option :value="180">180</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!rows.length" title="لا توجد أصناف راكدة" />
      <table v-else class="table-base">
        <thead><tr><th>الصنف</th><th>SKU</th><th>المخزن</th><th>الكمية</th><th>متوسط التكلفة</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td class="font-medium">{{ r.product.nameAr }}</td>
            <td class="font-mono text-xs">{{ r.product.sku }}</td>
            <td>{{ r.warehouse.name }}</td>
            <td>{{ r.quantity }}</td>
            <td>{{ r.averageCost?.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
