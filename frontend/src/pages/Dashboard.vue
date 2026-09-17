<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import dashboardService from '@/services/dashboardService';
import { MOVEMENT_TYPE_LABELS } from '@/constants/movementTypes';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import MovementTrendChart from '@/components/dashboard/MovementTrendChart.vue';
import WarehouseValueChart from '@/components/dashboard/WarehouseValueChart.vue';

const toast = useToast();
const loading = ref(true);

const summary = ref(null);
const recentIn = ref([]);
const recentOut = ref([]);
const lowStock = ref([]);
const outOfStock = ref([]);
const activity = ref({ mostActive: [], leastActive: [] });
const trend = ref([]);
const valueByWarehouse = ref([]);

const STAT_CARDS = [
  { key: 'totalProducts', label: 'إجمالي الأصناف', icon: 'box' },
  { key: 'totalStockQuantity', label: 'إجمالي الكمية بالمخزون', icon: 'archive' },
  { key: 'totalInventoryValue', label: 'قيمة المخزون', icon: 'currency', money: true },
  { key: 'lowStockCount', label: 'أصناف منخفضة المخزون', icon: 'warning', tone: 'amber' },
  { key: 'outOfStockCount', label: 'أصناف نافدة', icon: 'error', tone: 'red' },
  { key: 'totalWarehouses', label: 'عدد المخازن', icon: 'warehouse' },
  { key: 'totalSuppliers', label: 'عدد الموردين', icon: 'truck' },
];

async function load() {
  loading.value = true;
  try {
    const [summaryRes, inRes, outRes, lowRes, outOfStockRes, activityRes, trendRes, valueRes] = await Promise.all([
      dashboardService.summary(),
      dashboardService.recentMovements({ type: 'IN', limit: 5 }),
      dashboardService.recentMovements({ type: 'OUT', limit: 5 }),
      dashboardService.lowStock(),
      dashboardService.outOfStock(),
      dashboardService.productActivity(),
      dashboardService.movementTrend(),
      dashboardService.valueByWarehouse(),
    ]);
    summary.value = summaryRes.data.data;
    recentIn.value = inRes.data.data;
    recentOut.value = outRes.data.data;
    lowStock.value = lowRes.data.data;
    outOfStock.value = outOfStockRes.data.data;
    activity.value = activityRes.data.data;
    trend.value = trendRes.data.data;
    valueByWarehouse.value = valueRes.data.data;
  } catch (err) {
    toast.error('تعذر تحميل بيانات لوحة التحكم');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">لوحة التحكم</h1>

    <LoadingSpinner v-if="loading" />
    <template v-else-if="summary">
      <!-- Alerts -->
      <div v-if="summary.lowStockCount || summary.outOfStockCount" class="card p-4 mb-4 border-r-4 border-amber-400 flex items-center gap-3">
        <svg class="w-6 h-6 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <p class="text-sm text-amber-700 dark:text-amber-400">
          تنبيه: يوجد {{ summary.lowStockCount }} صنف منخفض المخزون و {{ summary.outOfStockCount }} صنف نافد. راجع تقرير المخزون المنخفض لاتخاذ إجراء.
        </p>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div v-for="card in STAT_CARDS" :key="card.key" class="card p-4">
          <p class="text-xs text-slate-400 mb-1">{{ card.label }}</p>
          <p
            class="text-2xl font-bold"
            :class="card.tone === 'red' ? 'text-red-600' : card.tone === 'amber' ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'"
          >
            {{ card.money ? summary[card.key].toFixed(2) : summary[card.key] }}
          </p>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid lg:grid-cols-2 gap-4 mb-6">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">حركة المخزون - آخر 7 أيام</h3>
          <MovementTrendChart :data="trend" />
        </div>
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">قيمة المخزون حسب المخزن</h3>
          <EmptyState v-if="!valueByWarehouse.length" title="لا توجد بيانات بعد" />
          <WarehouseValueChart v-else :data="valueByWarehouse" />
        </div>
      </div>

      <!-- Widgets -->
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">آخر عمليات الإدخال</h3>
          <EmptyState v-if="!recentIn.length" title="لا توجد عمليات" />
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-700">
            <li v-for="m in recentIn" :key="m._id" class="py-2 flex items-center justify-between text-sm">
              <span>{{ m.product?.nameAr }}</span>
              <span class="text-green-600 font-medium">+{{ m.quantity }}</span>
            </li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">آخر عمليات الإخراج</h3>
          <EmptyState v-if="!recentOut.length" title="لا توجد عمليات" />
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-700">
            <li v-for="m in recentOut" :key="m._id" class="py-2 flex items-center justify-between text-sm">
              <span>{{ m.product?.nameAr }}</span>
              <span class="text-red-600 font-medium">-{{ m.quantity }}</span>
            </li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الأصناف منخفضة المخزون</h3>
          <EmptyState v-if="!lowStock.length" title="لا توجد أصناف منخفضة" />
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-700">
            <li v-for="row in lowStock" :key="row._id" class="py-2 flex items-center justify-between text-sm">
              <span>{{ row.product?.nameAr }}</span>
              <span class="text-amber-600 font-medium">{{ row.quantity }} / {{ row.product?.minStock }}</span>
            </li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الأصناف النافدة</h3>
          <EmptyState v-if="!outOfStock.length" title="لا توجد أصناف نافدة" />
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-700">
            <li v-for="row in outOfStock" :key="row._id" class="py-2 flex items-center justify-between text-sm">
              <span>{{ row.product?.nameAr }}</span>
              <span class="badge-cancelled">نافد</span>
            </li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">أكثر الأصناف حركة (30 يوم)</h3>
          <EmptyState v-if="!activity.mostActive.length" title="لا توجد بيانات كافية" />
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-700">
            <li v-for="row in activity.mostActive" :key="row._id" class="py-2 flex items-center justify-between text-sm">
              <span>{{ row.product?.nameAr }}</span>
              <span class="text-slate-500">{{ row.movementCount }} حركة</span>
            </li>
          </ul>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">أقل الأصناف حركة (30 يوم)</h3>
          <EmptyState v-if="!activity.leastActive.length" title="لا توجد بيانات كافية" />
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-700">
            <li v-for="row in activity.leastActive" :key="row._id" class="py-2 flex items-center justify-between text-sm">
              <span>{{ row.product?.nameAr }}</span>
              <span class="text-slate-500">{{ row.movementCount }} حركة</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
