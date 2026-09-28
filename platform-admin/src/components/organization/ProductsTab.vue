<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Modal from '@/components/ui/Modal.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
});

const toast = useToast();

const items = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ search: '', active: '' });

const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref(null);

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('ar');
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizationProducts(props.organizationId, {
      page,
      search: filters.search || undefined,
      active: filters.active || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل قائمة الأصناف');
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch(() => [filters.search, filters.active], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});

async function openProduct(product) {
  detailOpen.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    const { data } = await platformService.organizationProduct(props.organizationId, product._id);
    detail.value = data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل تفاصيل الصنف');
  } finally {
    detailLoading.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <div>
    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <input v-model="filters.search" class="input flex-1 min-w-[200px]" placeholder="بحث بالاسم أو SKU أو الباركود..." />
      <select v-model="filters.active" class="input !w-auto">
        <option value="">كل الحالات</option>
        <option value="true">نشط</option>
        <option value="false">غير نشط</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد أصناف" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>SKU</th>
            <th>الباركود</th>
            <th>الاسم</th>
            <th>التصنيف</th>
            <th>الوحدة</th>
            <th>الكمية الإجمالية</th>
            <th>عدد المخازن</th>
            <th>سعر الشراء</th>
            <th>سعر البيع</th>
            <th>قيمة المخزون</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in items" :key="p._id" class="cursor-pointer" @click="openProduct(p)">
            <td class="font-mono text-xs">{{ p.sku }}</td>
            <td class="font-mono text-xs">{{ p.barcode || '—' }}</td>
            <td class="font-medium text-primary-600">{{ p.nameAr }}</td>
            <td class="text-sm">{{ p.category?.nameAr || '—' }}</td>
            <td class="text-sm">{{ p.unit?.shortCode || '—' }}</td>
            <td>{{ p.totalQuantity }}</td>
            <td>{{ p.warehouseCount }}</td>
            <td>{{ fmtMoney(p.purchasePrice) }}</td>
            <td>{{ fmtMoney(p.salePrice) }}</td>
            <td>{{ fmtMoney(p.stockValue) }}</td>
            <td><StatusBadge :status="p.active ? 'active' : 'inactive'" /></td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>

    <Modal v-model="detailOpen" :title="detail?.product?.nameAr || 'تفاصيل الصنف'" size="lg">
      <LoadingSpinner v-if="detailLoading" />
      <template v-else-if="detail">
        <table class="table-base mb-4">
          <thead><tr><th>المخزن</th><th>الكمية</th><th>المتاحة</th><th>متوسط التكلفة</th><th>القيمة</th></tr></thead>
          <tbody>
            <tr v-for="b in detail.warehouseBalances" :key="b.warehouse?._id">
              <td>{{ b.warehouse?.name }}</td>
              <td>{{ b.quantity }}</td>
              <td>{{ b.availableQuantity }}</td>
              <td>{{ fmtMoney(b.averageCost) }}</td>
              <td>{{ fmtMoney(b.inventoryValue) }}</td>
            </tr>
            <tr v-if="!detail.warehouseBalances.length"><td colspan="5" class="text-center text-slate-400">لا يوجد مخزون لهذا الصنف</td></tr>
          </tbody>
          <tfoot>
            <tr class="font-bold">
              <td>الإجمالي</td>
              <td>{{ detail.totals.quantity }}</td>
              <td></td>
              <td></td>
              <td>{{ fmtMoney(detail.totals.value) }}</td>
            </tr>
          </tfoot>
        </table>

        <h4 class="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2">حركات حديثة</h4>
        <ul class="space-y-1.5 max-h-56 overflow-y-auto text-sm">
          <li v-for="m in detail.recentMovements" :key="m._id" class="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-1">
            <span>{{ m.type }} · {{ m.warehouse?.name }} · {{ m.quantity }}</span>
            <span class="text-xs text-slate-400">{{ fmtDate(m.createdAt) }}</span>
          </li>
          <li v-if="!detail.recentMovements.length" class="text-slate-400">لا يوجد حركات مسجلة</li>
        </ul>
      </template>
      <template #footer>
        <button class="btn-primary" @click="detailOpen = false">إغلاق</button>
      </template>
    </Modal>
  </div>
</template>
