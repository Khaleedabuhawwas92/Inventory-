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
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizationInvitations(props.organizationId, { page });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل الدعوات');
  } finally {
    loading.value = false;
  }
}

async function revoke(inv) {
  const ok = await confirm({
    title: 'إلغاء الدعوة',
    message: 'هل أنت متأكد من إلغاء رابط هذه الدعوة؟ لن يعود صالحاً للاستخدام.',
    confirmText: 'إلغاء الدعوة',
    danger: true,
  });
  if (!ok) return;
  try {
    await platformService.revokeOrganizationInvitation(props.organizationId, inv._id);
    toast.success('تم إلغاء الدعوة');
    load(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إلغاء الدعوة');
  }
}

onMounted(() => load());
</script>

<template>
  <div class="card overflow-x-auto">
    <LoadingSpinner v-if="loading" />
    <EmptyState v-else-if="!items.length" title="لا توجد دعوات" />
    <table v-else class="table-base">
      <thead>
        <tr>
          <th>الرمز</th>
          <th>الدور</th>
          <th>المخزن</th>
          <th>أنشأها</th>
          <th>تاريخ الإنشاء</th>
          <th>تنتهي في</th>
          <th>الحالة</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="inv in items" :key="inv._id">
          <td class="font-mono text-xs">{{ inv.codeMasked }}</td>
          <td>{{ inv.role?.nameAr }}</td>
          <td class="text-sm">{{ inv.warehouse?.name || '—' }}</td>
          <td class="text-sm">{{ inv.createdBy?.fullName || '—' }}</td>
          <td class="text-xs text-slate-400">{{ fmtDate(inv.createdAt) }}</td>
          <td class="text-xs text-slate-400">{{ fmtDate(inv.expiresAt) }}</td>
          <td><StatusBadge :status="inv.status" /></td>
          <td>
            <button v-if="inv.status === 'active'" class="btn-outline !px-2 !py-1 text-xs text-red-600" @click="revoke(inv)">إلغاء</button>
          </td>
        </tr>
      </tbody>
    </table>
    <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
  </div>
</template>
