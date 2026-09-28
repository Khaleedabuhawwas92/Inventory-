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
const filters = reactive({ search: '', organizationId: '', roleName: '', status: '' });

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.users({
      page,
      search: filters.search || undefined,
      organizationId: filters.organizationId || undefined,
      roleName: filters.roleName || undefined,
      status: filters.status || undefined,
    });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل قائمة المستخدمين');
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch(() => [filters.search, filters.organizationId, filters.roleName, filters.status], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});

async function toggleStatus(user) {
  const disabling = user.status === 'active';
  const ok = await confirm({
    title: disabling ? 'تعطيل المستخدم' : 'تفعيل المستخدم',
    message: `هل أنت متأكد من ${disabling ? 'تعطيل' : 'تفعيل'} حساب "${user.fullName}"؟`,
    confirmText: disabling ? 'تعطيل' : 'تفعيل',
    danger: disabling,
  });
  if (!ok) return;
  try {
    await platformService.setUserStatus(user._id, disabling ? 'disabled' : 'active');
    toast.success(disabling ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
    load(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

onMounted(() => load());
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">المستخدمون (كل المؤسسات)</h1>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <input v-model="filters.search" class="input flex-1 min-w-[200px]" placeholder="بحث بالاسم أو اسم المستخدم أو البريد أو الهاتف..." />
      <input v-model="filters.roleName" class="input !w-auto" placeholder="اسم الدور (مثال: admin)" />
      <select v-model="filters.status" class="input !w-auto">
        <option value="">كل الحالات</option>
        <option value="active">نشط</option>
        <option value="disabled">معطل</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا يوجد مستخدمون" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>الاسم الكامل</th>
            <th>اسم المستخدم</th>
            <th>البريد</th>
            <th>الهاتف</th>
            <th>المؤسسة</th>
            <th>الدور</th>
            <th>المخزن</th>
            <th>الحالة</th>
            <th>آخر دخول</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in items" :key="u._id">
            <td><router-link :to="`/users/${u._id}`" class="text-primary-600 hover:underline">{{ u.fullName }}</router-link></td>
            <td>{{ u.username }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.phone || '—' }}</td>
            <td>
              <router-link v-if="u.organizationId" :to="`/organizations/${u.organizationId._id}`" class="hover:underline">{{ u.organizationId.name }}</router-link>
            </td>
            <td>{{ u.role?.nameAr }}</td>
            <td>{{ u.warehouse?.name || '—' }}</td>
            <td><StatusBadge :status="u.status" /></td>
            <td class="text-xs text-slate-400">{{ u.lastLogin ? fmtDate(u.lastLogin) : '—' }}</td>
            <td>
              <button
                class="btn-outline !px-2 !py-1 text-xs"
                :class="u.status === 'active' ? 'text-red-600' : 'text-green-600'"
                @click="toggleStatus(u)"
              >
                {{ u.status === 'active' ? 'تعطيل' : 'تفعيل' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>
  </div>
</template>
