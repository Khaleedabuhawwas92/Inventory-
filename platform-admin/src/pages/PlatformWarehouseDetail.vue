<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();

const organizationId = route.params.id;
const warehouseId = route.params.warehouseId;

const loading = ref(true);
const data = ref(null);
const filters = reactive({ search: '', lowStock: '', outOfStock: '' });
const productsPage = ref(1);

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString('ar');
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data: res } = await platformService.organizationWarehouse(organizationId, warehouseId, {
      page,
      search: filters.search || undefined,
      lowStock: filters.lowStock || undefined,
      outOfStock: filters.outOfStock || undefined,
    });
    data.value = res.data;
    productsPage.value = page;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل بيانات المخزن');
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch(() => [filters.search, filters.lowStock, filters.outOfStock], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});

async function toggleStatus() {
  const wh = data.value.warehouse;
  const disabling = wh.status === 'active';
  if (disabling && wh.isMain) {
    toast.error('لا يمكن تعطيل المخزن الرئيسي');
    return;
  }
  const ok = await confirm({
    title: disabling ? 'تعطيل المخزن' : 'تفعيل المخزن',
    message: `هل أنت متأكد من ${disabling ? 'تعطيل' : 'تفعيل'} هذا المخزن؟`,
    confirmText: disabling ? 'تعطيل' : 'تفعيل',
    danger: disabling,
  });
  if (!ok) return;
  try {
    await platformService.setWarehouseStatus(organizationId, warehouseId, disabling ? 'inactive' : 'active');
    toast.success(disabling ? 'تم تعطيل المخزن' : 'تم تفعيل المخزن');
    load(productsPage.value);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

onMounted(() => load());
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="data">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <router-link :to="`/organizations/${organizationId}`" class="text-xs text-primary-600 hover:underline">← العودة إلى المؤسسة</router-link>
          <div class="flex items-center gap-2 mt-1">
            <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">{{ data.warehouse.name }}</h1>
            <span v-if="data.warehouse.isMain" class="badge-draft">رئيسي</span>
            <StatusBadge :status="data.warehouse.status" />
          </div>
          <p class="text-xs text-slate-400">{{ data.warehouse.code }} · {{ data.warehouse.address || 'بدون عنوان' }}</p>
        </div>
        <button
          class="btn-outline !px-3 !py-1.5 text-xs"
          :class="data.warehouse.status === 'active' ? 'text-red-600' : 'text-green-600'"
          @click="toggleStatus"
        >
          {{ data.warehouse.status === 'active' ? 'تعطيل المخزن' : 'تفعيل المخزن' }}
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div class="card p-4"><p class="text-xs text-slate-400 mb-1">عدد الأصناف</p><p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ data.stats.productCount }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-400 mb-1">إجمالي الكمية</p><p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ data.stats.totalQuantity }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-400 mb-1">قيمة المخزون</p><p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ fmtMoney(data.stats.inventoryValue) }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-400 mb-1">حركات المخزون</p><p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ data.stats.totalMovements }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-400 mb-1">منخفض المخزون</p><p class="text-2xl font-bold text-amber-600">{{ data.stats.lowStockCount }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-400 mb-1">نافد المخزون</p><p class="text-2xl font-bold text-red-600">{{ data.stats.outOfStockCount }}</p></div>
        <div class="card p-4 sm:col-span-2"><p class="text-xs text-slate-400 mb-1">آخر حركة</p><p class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ fmtDate(data.stats.lastMovementAt) }}</p></div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2 mb-6">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">معلومات المخزن</h3>
          <dl class="text-sm space-y-2">
            <div class="flex justify-between"><dt class="text-slate-400">المدير</dt><dd>{{ data.warehouse.manager?.fullName || '—' }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الهاتف</dt><dd>{{ data.warehouse.phone || '—' }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">تاريخ الإنشاء</dt><dd>{{ fmtDate(data.warehouse.createdAt) }}</dd></div>
          </dl>
        </div>
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">الموظفون المعينون على هذا المخزن</h3>
          <ul class="text-sm space-y-1">
            <li v-for="u in data.assignedUsers" :key="u._id" class="flex justify-between">
              <span>{{ u.fullName }}</span>
              <span class="text-xs text-slate-400">{{ u.role?.nameAr }}</span>
            </li>
            <li v-if="!data.assignedUsers.length" class="text-slate-400">لا يوجد موظفون معينون على هذا المخزن تحديداً</li>
          </ul>
        </div>
      </div>

      <!-- A. Products in warehouse -->
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">الأصناف في هذا المخزن</h3>
      <div class="card p-4 mb-4 flex flex-wrap gap-3">
        <input v-model="filters.search" class="input flex-1 min-w-[200px]" placeholder="بحث..." />
        <label class="flex items-center gap-1.5 text-sm"><input v-model="filters.lowStock" type="checkbox" true-value="true" false-value="" /> منخفض المخزون فقط</label>
        <label class="flex items-center gap-1.5 text-sm"><input v-model="filters.outOfStock" type="checkbox" true-value="true" false-value="" /> نافد فقط</label>
      </div>
      <div class="card overflow-x-auto mb-6">
        <EmptyState v-if="!data.products.items.length" title="لا توجد أصناف مطابقة" />
        <table v-else class="table-base">
          <thead>
            <tr><th>SKU</th><th>الاسم</th><th>التصنيف</th><th>الوحدة</th><th>الكمية</th><th>المتاحة</th><th>متوسط التكلفة</th><th>القيمة</th><th>الحد الأدنى</th><th>الحالة</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in data.products.items" :key="p._id">
              <td class="font-mono text-xs">{{ p.sku }}</td>
              <td class="font-medium">{{ p.nameAr }}</td>
              <td class="text-sm">{{ p.category || '—' }}</td>
              <td class="text-sm">{{ p.unit || '—' }}</td>
              <td>{{ p.quantity }}</td>
              <td>{{ p.availableQuantity }}</td>
              <td>{{ fmtMoney(p.averageCost) }}</td>
              <td>{{ fmtMoney(p.inventoryValue) }}</td>
              <td>{{ p.minStock }}</td>
              <td><StatusBadge :status="p.active ? 'active' : 'inactive'" /></td>
            </tr>
          </tbody>
        </table>
        <Pagination
          v-if="data.products.items.length"
          :page="data.products.meta.page"
          :total-pages="data.products.meta.totalPages"
          :total="data.products.meta.total"
          @update:page="load"
        />
      </div>

      <!-- B. Recent stock movements -->
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">حركات المخزون الأخيرة</h3>
      <div class="card overflow-x-auto">
        <EmptyState v-if="!data.recentMovements.length" title="لا توجد حركات" />
        <table v-else class="table-base">
          <thead><tr><th>التاريخ</th><th>رقم الحركة</th><th>الصنف</th><th>النوع</th><th>الكمية</th><th>المستخدم</th><th>الرصيد بعد الحركة</th></tr></thead>
          <tbody>
            <tr v-for="m in data.recentMovements" :key="m._id">
              <td class="text-xs text-slate-400 whitespace-nowrap">{{ fmtDate(m.createdAt) }}</td>
              <td class="font-mono text-xs">{{ m.movementNo }}</td>
              <td class="text-sm">{{ m.product?.nameAr }} ({{ m.product?.sku }})</td>
              <td class="text-xs">{{ m.type }}</td>
              <td>{{ m.quantity }}</td>
              <td class="text-sm">{{ m.createdBy?.fullName || '—' }}</td>
              <td class="text-xs text-slate-400">{{ m.afterQty }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
