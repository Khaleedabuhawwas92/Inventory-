<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
});

const toast = useToast();
const confirm = useConfirm();

const items = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('ar') : '—';
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString('ar');
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizationWarehouses(props.organizationId, { page });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل قائمة المخازن');
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(wh) {
  const disabling = wh.status === 'active';
  if (disabling && wh.isMain) {
    toast.error('لا يمكن تعطيل المخزن الرئيسي');
    return;
  }
  const ok = await confirm({
    title: disabling ? 'تعطيل المخزن' : 'تفعيل المخزن',
    message: `هل أنت متأكد من ${disabling ? 'تعطيل' : 'تفعيل'} مخزن "${wh.name}"؟`,
    confirmText: disabling ? 'تعطيل' : 'تفعيل',
    danger: disabling,
  });
  if (!ok) return;
  try {
    await platformService.setWarehouseStatus(props.organizationId, wh._id, disabling ? 'inactive' : 'active');
    toast.success(disabling ? 'تم تعطيل المخزن' : 'تم تفعيل المخزن');
    load(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

onMounted(() => load());
</script>

<template>
  <div class="card overflow-x-auto">
    <LoadingSpinner v-if="loading" />
    <EmptyState v-else-if="!items.length" title="لا توجد مخازن" />
    <table v-else class="table-base">
      <thead>
        <tr>
          <th>اسم المخزن</th>
          <th>الرمز</th>
          <th>المدير</th>
          <th>الهاتف</th>
          <th>الأصناف</th>
          <th>الكمية الإجمالية</th>
          <th>قيمة المخزون</th>
          <th>منخفض المخزون</th>
          <th>تاريخ الإنشاء</th>
          <th>آخر نشاط</th>
          <th>الحالة</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="wh in items" :key="wh._id">
          <td>
            <router-link :to="`/organizations/${organizationId}/warehouses/${wh._id}`" class="font-medium text-primary-600 hover:underline">
              {{ wh.name }}
            </router-link>
            <span v-if="wh.isMain" class="badge-draft mr-1">رئيسي</span>
          </td>
          <td>{{ wh.code }}</td>
          <td class="text-sm">{{ wh.manager?.fullName || '—' }}</td>
          <td class="text-sm">{{ wh.phone || '—' }}</td>
          <td>{{ wh.productCount }}</td>
          <td>{{ wh.totalQuantity }}</td>
          <td>{{ fmtMoney(wh.inventoryValue) }}</td>
          <td>
            <span :class="wh.lowStockCount > 0 ? 'text-amber-600 font-bold' : ''">{{ wh.lowStockCount }}</span>
          </td>
          <td class="text-xs text-slate-400">{{ fmtDate(wh.createdAt) }}</td>
          <td class="text-xs text-slate-400">{{ wh.lastActivity ? fmtDate(wh.lastActivity) : '—' }}</td>
          <td><StatusBadge :status="wh.status" /></td>
          <td>
            <div class="flex items-center gap-2">
              <router-link :to="`/organizations/${organizationId}/warehouses/${wh._id}`" class="btn-outline !px-2 !py-1 text-xs">عرض</router-link>
              <button
                class="btn-outline !px-2 !py-1 text-xs"
                :class="wh.status === 'active' ? 'text-red-600' : 'text-green-600'"
                @click="toggleStatus(wh)"
              >
                {{ wh.status === 'active' ? 'تعطيل' : 'تفعيل' }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
  </div>
</template>
