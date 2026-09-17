<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import reportsService from '@/services/reportsService';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { exportToCsv } from '@/utils/exportCsv';
import { safePrint } from '@/utils/print';

const toast = useToast();
const rows = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const { data } = await reportsService.supplierPurchases();
    rows.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل التقرير');
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  exportToCsv('supplier-purchases-report', rows.value, [
    { label: 'المورد', value: 'supplier' },
    { label: 'عدد الطلبات', value: 'orderCount' },
    { label: 'إجمالي القيمة', value: 'totalValue' },
  ]);
}

onMounted(load);
</script>

<template>
  <div>
    <router-link to="/reports" class="text-sm text-primary-600 hover:underline">← مركز التقارير</router-link>
    <div class="flex items-center justify-between flex-wrap gap-3 mt-1 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">مشتريات الموردين</h1>
      <div class="flex items-center gap-2 print:hidden">
        <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
        <button class="btn-outline" @click="safePrint()">طباعة</button>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!rows.length" title="لا توجد بيانات مشتريات" />
      <table v-else class="table-base">
        <thead><tr><th>المورد</th><th>عدد الطلبات</th><th>إجمالي القيمة</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td class="font-medium">{{ r.supplier }}</td>
            <td>{{ r.orderCount }}</td>
            <td>{{ r.totalValue?.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
