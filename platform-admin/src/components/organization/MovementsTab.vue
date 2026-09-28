<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
});

// Matches backend/models/StockMovement.js's MOVEMENT_TYPES exactly.
const MOVEMENT_TYPES = [
  'OPENING', 'IN', 'OUT', 'TRANSFER_OUT', 'TRANSFER_IN',
  'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
  'INVENTORY_ADJUSTMENT', 'REVERSAL',
];

const toast = useToast();

const items = ref([]);
const warehouseOptions = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ dateFrom: '', dateTo: '', warehouse: '', type: '', product: '' });

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizationMovements(props.organizationId, {
      page,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      warehouse: filters.warehouse || undefined,
      type: filters.type || undefined,
      product: filters.product || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل حركات المخزون');
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch(() => [filters.dateFrom, filters.dateTo, filters.warehouse, filters.type, filters.product], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});

onMounted(async () => {
  try {
    const { data } = await platformService.organizationWarehouses(props.organizationId, { limit: 100 });
    warehouseOptions.value = data.data;
  } catch (err) {
    // non-fatal — the warehouse filter just stays empty
  }
  load();
});
</script>

<template>
  <div>
    <div class="card p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input v-model="filters.dateFrom" type="date" class="input" placeholder="من تاريخ" />
      <input v-model="filters.dateTo" type="date" class="input" placeholder="إلى تاريخ" />
      <select v-model="filters.warehouse" class="input">
        <option value="">كل المخازن</option>
        <option v-for="w in warehouseOptions" :key="w._id" :value="w._id">{{ w.name }}</option>
      </select>
      <select v-model="filters.type" class="input">
        <option value="">كل الأنواع</option>
        <option v-for="t in MOVEMENT_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
      <input v-model="filters.product" class="input" placeholder="معرّف الصنف (SKU ID)" />
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد حركات مطابقة" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>رقم الحركة</th>
            <th>المخزن</th>
            <th>الصنف</th>
            <th>النوع</th>
            <th>الكمية</th>
            <th>قبل</th>
            <th>بعد</th>
            <th>المستخدم</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in items" :key="m._id">
            <td class="text-xs text-slate-400 whitespace-nowrap">{{ fmtDate(m.createdAt) }}</td>
            <td class="font-mono text-xs">{{ m.movementNo }}</td>
            <td class="text-sm">{{ m.warehouse?.name }}</td>
            <td class="text-sm">{{ m.product?.nameAr }} ({{ m.product?.sku }})</td>
            <td class="text-xs">{{ m.type }}</td>
            <td>{{ m.quantity }}</td>
            <td class="text-xs text-slate-400">{{ m.beforeQty }}</td>
            <td class="text-xs text-slate-400">{{ m.afterQty }}</td>
            <td class="text-sm">{{ m.createdBy?.fullName || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
