<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const toast = useToast();
const confirm = useConfirm();

const items = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ search: '', status: '' });

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizations({
      page,
      search: filters.search || undefined,
      status: filters.status || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل قائمة المؤسسات');
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch(() => [filters.search, filters.status], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});

async function toggleStatus(org) {
  const disabling = org.status === 'active';
  const ok = await confirm({
    title: disabling ? 'تعليق المؤسسة' : 'تفعيل المؤسسة',
    message: disabling
      ? `هل أنت متأكد من تعليق مؤسسة "${org.name}"؟ لن يتمكن أي مستخدم فيها من تسجيل الدخول. بيانات المؤسسة تبقى محفوظة بالكامل.`
      : `هل تريد إعادة تفعيل مؤسسة "${org.name}"؟`,
    confirmText: disabling ? 'تعليق' : 'تفعيل',
    danger: disabling,
  });
  if (!ok) return;
  try {
    await platformService.setOrganizationStatus(org._id, disabling ? 'suspended' : 'active');
    toast.success(disabling ? 'تم تعليق المؤسسة' : 'تم تفعيل المؤسسة');
    load(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

onMounted(() => load());
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">المؤسسات</h1>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <input v-model="filters.search" class="input flex-1 min-w-[200px]" placeholder="بحث باسم المؤسسة..." />
      <select v-model="filters.status" class="input !w-auto">
        <option value="">كل الحالات</option>
        <option value="active">نشطة</option>
        <option value="suspended">معلّقة</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد مؤسسات" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>اسم المؤسسة</th>
            <th>المالك</th>
            <th>المستخدمون</th>
            <th>المخازن</th>
            <th>الأصناف</th>
            <th>تاريخ الإنشاء</th>
            <th>آخر نشاط</th>
            <th>الحالة</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="org in items" :key="org._id">
            <td>
              <router-link :to="`/organizations/${org._id}`" class="font-medium text-primary-600 hover:underline">{{ org.name }}</router-link>
              <p class="text-xs text-slate-400">{{ org._id }}</p>
            </td>
            <td class="text-sm">{{ org.owner?.fullName || '—' }}</td>
            <td>{{ org.usersCount }}</td>
            <td>{{ org.warehousesCount }}</td>
            <td>{{ org.productsCount }}</td>
            <td class="text-xs text-slate-400">{{ fmtDate(org.createdAt) }}</td>
            <td class="text-xs text-slate-400">{{ org.lastActivity ? fmtDate(org.lastActivity.at) : '—' }}</td>
            <td><StatusBadge :status="org.status" /></td>
            <td>
              <button
                class="btn-outline !px-2 !py-1 text-xs"
                :class="org.status === 'active' ? 'text-red-600' : 'text-green-600'"
                @click="toggleStatus(org)"
              >
                {{ org.status === 'active' ? 'تعليق' : 'تفعيل' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
