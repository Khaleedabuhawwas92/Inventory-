<script setup>
import { onMounted, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import reportsService from '@/services/reportsService';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { safePrint } from '@/utils/print';

const toast = useToast();
const rows = ref([]);
const direction = ref('fast');
const days = ref(30);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const { data } = await reportsService.productMovementRanking({ direction: direction.value, days: days.value });
    rows.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل التقرير');
  } finally {
    loading.value = false;
  }
}

watch([direction, days], load);
onMounted(load);
</script>

<template>
  <div>
    <router-link to="/reports" class="text-sm text-primary-600 hover:underline">← مركز التقارير</router-link>
    <div class="flex items-center justify-between flex-wrap gap-3 mt-1 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">الأصناف الأكثر والأقل حركة</h1>
      <button class="btn-outline print:hidden" @click="safePrint()">طباعة</button>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 print:hidden">
      <div class="flex items-center gap-2">
        <button class="btn-outline" :class="{ '!bg-primary-600 !text-white': direction === 'fast' }" @click="direction = 'fast'">الأكثر حركة</button>
        <button class="btn-outline" :class="{ '!bg-primary-600 !text-white': direction === 'slow' }" @click="direction = 'slow'">الأقل حركة</button>
      </div>
      <select v-model.number="days" class="input !w-auto">
        <option :value="7">آخر 7 أيام</option>
        <option :value="30">آخر 30 يوم</option>
        <option :value="90">آخر 90 يوم</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!rows.length" title="لا توجد بيانات كافية" />
      <table v-else class="table-base">
        <thead><tr><th>الصنف</th><th>SKU</th><th>عدد الحركات</th><th>إجمالي الكمية</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td class="font-medium">{{ r.product.nameAr }}</td>
            <td class="font-mono text-xs">{{ r.product.sku }}</td>
            <td>{{ r.movementCount }}</td>
            <td>{{ r.totalQuantity }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
