<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import inventoryCountService from '@/services/inventoryCountService';
import warehouseService from '@/services/warehouseService';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const STATUS_LABELS = { DRAFT: 'مسودة', COUNTING: 'قيد العد', REVIEW: 'قيد المراجعة', APPROVED: 'معتمد', CANCELLED: 'ملغى' };

const toast = useToast();
const auth = useAuthStore();

const items = ref([]);
const warehouses = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ warehouse: '', status: '' });

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await inventoryCountService.list({ page, warehouse: filters.warehouse || undefined, status: filters.status || undefined });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error('تعذر تحميل جلسات الجرد');
  } finally {
    loading.value = false;
  }
}

watch(() => [filters.warehouse, filters.status], () => load(1));

onMounted(async () => {
  const { data } = await warehouseService.list();
  warehouses.value = data.data;
  load();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">الجرد</h1>
      <router-link v-if="auth.can('inventory.create')" to="/inventory/new" class="btn-primary">+ جلسة جرد جديدة</router-link>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <select v-model="filters.warehouse" class="input !w-auto">
        <option value="">كل المخازن</option>
        <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
      </select>
      <select v-model="filters.status" class="input !w-auto">
        <option value="">كل الحالات</option>
        <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد جلسات جرد" />
      <table v-else class="table-base">
        <thead><tr><th>رقم الجلسة</th><th>التاريخ</th><th>المخزن</th><th>عدد الأصناف</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          <tr v-for="doc in items" :key="doc._id">
            <td class="font-mono text-xs">{{ doc.docNo }}</td>
            <td class="text-xs text-slate-400">{{ new Date(doc.date).toLocaleDateString('ar') }}</td>
            <td>{{ doc.warehouse?.name }}</td>
            <td>{{ doc.items?.length }}</td>
            <td><StatusBadge :status="doc.status" /></td>
            <td><router-link :to="`/inventory/${doc._id}`" class="btn-outline !px-2 !py-1 text-xs">عرض</router-link></td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
