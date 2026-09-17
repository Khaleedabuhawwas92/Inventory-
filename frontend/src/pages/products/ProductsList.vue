<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import productService from '@/services/productService';
import categoryService from '@/services/categoryService';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PrintHeader from '@/components/print/PrintHeader.vue';
import { exportToCsv } from '@/utils/exportCsv';
import { safePrint } from '@/utils/print';

const toast = useToast();
const auth = useAuthStore();

const items = ref([]);
const categories = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ search: '', category: '', active: '' });

async function loadCategories() {
  const { data } = await categoryService.list();
  categories.value = data.data;
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await productService.list({
      page,
      search: filters.search || undefined,
      category: filters.category || undefined,
      active: filters.active || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error('تعذر تحميل قائمة الأصناف');
  } finally {
    loading.value = false;
  }
}

let timer = null;
watch(() => [filters.search, filters.category, filters.active], () => {
  clearTimeout(timer);
  timer = setTimeout(() => load(1), 350);
});

function exportCsv() {
  exportToCsv('products', items.value, [
    { label: 'SKU', value: 'sku' },
    { label: 'الباركود', value: 'barcode' },
    { label: 'الاسم', value: 'nameAr' },
    { label: 'التصنيف', value: (r) => r.category?.nameAr },
    { label: 'الوحدة', value: (r) => r.unit?.nameAr },
    { label: 'سعر الشراء', value: 'purchasePrice' },
    { label: 'سعر البيع', value: 'salePrice' },
    { label: 'الحد الأدنى', value: 'minStock' },
    { label: 'الحد الأقصى', value: 'maxStock' },
  ]);
}

onMounted(async () => {
  await loadCategories();
  await load();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <PrintHeader title="تقرير الأصناف" />
      <div class="flex items-center gap-2 print:hidden">
        <button class="btn-outline" @click="exportCsv">تصدير Excel</button>
        <button class="btn-outline" @click="safePrint()">طباعة</button>
        <router-link v-if="auth.can('products.create')" to="/products/new" class="btn-primary">+ صنف جديد</router-link>
      </div>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 print:hidden">
      <input v-model="filters.search" class="input flex-1 min-w-[200px]" placeholder="بحث بالاسم أو SKU أو الباركود..." />
      <select v-model="filters.category" class="input !w-auto">
        <option value="">كل التصنيفات</option>
        <option v-for="c in categories" :key="c._id" :value="c._id">{{ c.nameAr }}</option>
      </select>
      <select v-model="filters.active" class="input !w-auto">
        <option value="">كل الحالات</option>
        <option value="true">نشط</option>
        <option value="false">غير نشط</option>
      </select>
    </div>

    <div class="card overflow-x-auto print:overflow-visible print:border-none print:shadow-none print:rounded-none">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد أصناف">
        <template #action>
          <router-link v-if="auth.can('products.create')" to="/products/new" class="btn-primary">+ إضافة أول صنف</router-link>
        </template>
      </EmptyState>
      <table v-else class="table-base print-table">
        <thead>
          <tr>
            <th class="print:hidden"></th><th>SKU</th><th>الاسم</th><th>التصنيف</th><th>الوحدة</th><th>سعر البيع</th><th>الحالة</th><th class="print:hidden"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in items" :key="p._id">
            <td class="print:hidden">
              <img v-if="p.image" :src="p.image" class="w-9 h-9 rounded-lg object-cover" />
              <div v-else class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700" />
            </td>
            <td class="font-mono text-xs">{{ p.sku }}</td>
            <td class="font-medium text-slate-700 dark:text-slate-200">{{ p.nameAr }}</td>
            <td>{{ p.category?.nameAr || '—' }}</td>
            <td>{{ p.unit?.shortCode || '—' }}</td>
            <td>{{ p.salePrice?.toFixed(2) }}</td>
            <td><StatusBadge :status="p.active ? 'active' : 'inactive'" /></td>
            <td class="print:hidden">
              <div class="flex items-center gap-2 justify-end">
                <router-link :to="`/products/${p._id}`" class="btn-outline !px-2 !py-1 text-xs">عرض</router-link>
                <router-link v-if="auth.can('products.edit')" :to="`/products/${p._id}/edit`" class="btn-outline !px-2 !py-1 text-xs">تعديل</router-link>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="items.length" class="print:hidden">
        <Pagination :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ✅ داخل @media print فقط — لا يغيّر شيئاً في العرض العادي على الشاشة.
   .print-table مضافة هنا فقط (بجانب table-base العامة المشتركة مع صفحات
   أخرى) كي لا تتأثر أي صفحة أخرى تستخدم table-base بهذه القواعد. */
@media print {
  .print-table {
    width: 100%;
    border-collapse: collapse;
  }
  .print-table th,
  .print-table td {
    border: 1px solid #000;
    color: #000;
    background: #fff;
    padding: 6px 8px;
  }
  .print-table thead th {
    background: #f3f4f6;
    font-weight: 700;
  }
}
</style>
