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

const toast = useToast();

const items = ref([]);
const actions = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ user: '', action: '', entityType: '', dateFrom: '', dateTo: '', search: '' });

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizationAudit(props.organizationId, {
      page,
      user: filters.user || undefined,
      action: filters.action || undefined,
      entityType: filters.entityType || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      search: filters.search || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
    if (data.meta.actions) actions.value = data.meta.actions;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل سجل النشاط');
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch(
  () => [filters.user, filters.action, filters.entityType, filters.dateFrom, filters.dateTo, filters.search],
  () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => load(1), 350);
  }
);

onMounted(() => load());
</script>

<template>
  <div>
    <div class="card p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input v-model="filters.search" class="input" placeholder="بحث في الوصف..." />
      <input v-model="filters.user" class="input" placeholder="معرّف المستخدم" />
      <input v-model="filters.entityType" class="input" placeholder="نوع الكيان (User, Product...)" />
      <select v-model="filters.action" class="input">
        <option value="">كل الإجراءات</option>
        <option v-for="a in actions" :key="a" :value="a">{{ a }}</option>
      </select>
      <input v-model="filters.dateFrom" type="date" class="input" />
      <input v-model="filters.dateTo" type="date" class="input" />
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا يوجد نشاط مطابق" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>الوقت</th>
            <th>المستخدم</th>
            <th>الإجراء</th>
            <th>الكيان</th>
            <th>الوصف</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in items" :key="log._id">
            <td class="text-xs text-slate-400 whitespace-nowrap">{{ fmtDate(log.createdAt) }}</td>
            <td class="text-sm">{{ log.user?.fullName || log.userDisplay || '—' }}</td>
            <td class="text-xs">{{ log.action }}</td>
            <td class="text-xs">{{ log.entityType || '—' }}</td>
            <td class="text-sm">{{ log.description }}</td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
