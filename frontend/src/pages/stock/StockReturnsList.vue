<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import stockService from '@/services/stockService';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const TYPE_LABELS = { TO_SUPPLIER: 'مرتجع للمورد', FROM_CUSTOMER: 'مرتجع من عميل/داخلي' };

const toast = useToast();
const auth = useAuthStore();

const items = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ type: '', status: '' });

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await stockService.listReturns({ page, type: filters.type || undefined, status: filters.status || undefined });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error('تعذر تحميل سندات المرتجعات');
  } finally {
    loading.value = false;
  }
}

watch(() => [filters.type, filters.status], () => load(1));
onMounted(() => load());
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">المرتجعات</h1>
      <router-link v-if="auth.can('stock.in') || auth.can('stock.out')" to="/stock/returns/new" class="btn-primary">+ مرتجع جديد</router-link>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <select v-model="filters.type" class="input !w-auto">
        <option value="">كل الأنواع</option>
        <option value="TO_SUPPLIER">مرتجع للمورد</option>
        <option value="FROM_CUSTOMER">مرتجع من عميل/داخلي</option>
      </select>
      <select v-model="filters.status" class="input !w-auto">
        <option value="">كل الحالات</option>
        <option value="DRAFT">مسودة</option>
        <option value="APPROVED">معتمد</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد مرتجعات" />
      <table v-else class="table-base">
        <thead><tr><th>رقم السند</th><th>النوع</th><th>المخزن</th><th>عدد الأصناف</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          <tr v-for="doc in items" :key="doc._id">
            <td class="font-mono text-xs">{{ doc.docNo }}</td>
            <td>{{ TYPE_LABELS[doc.type] }}</td>
            <td>{{ doc.warehouse?.name }}</td>
            <td>{{ doc.items?.length }}</td>
            <td><StatusBadge :status="doc.status" /></td>
            <td><router-link :to="`/stock/returns/${doc._id}`" class="btn-outline !px-2 !py-1 text-xs">عرض</router-link></td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
