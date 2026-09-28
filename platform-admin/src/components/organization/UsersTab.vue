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
const roles = ref([]);
const warehouses = ref([]);
const busyUserId = ref(null);

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizationUsers(props.organizationId, { page });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل قائمة المستخدمين');
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  try {
    const [{ data: r }, { data: w }] = await Promise.all([
      platformService.organizationRoles(props.organizationId),
      platformService.organizationWarehouses(props.organizationId, { limit: 100 }),
    ]);
    roles.value = r.data;
    warehouses.value = w.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل الأدوار والمخازن');
  }
}

async function changeRole(user, event) {
  const roleId = event.target.value;
  if (!roleId || roleId === user.role?._id) return;
  busyUserId.value = user._id;
  try {
    await platformService.setOrgUserRole(props.organizationId, user._id, roleId);
    toast.success('تم تحديث دور المستخدم');
    load(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
    event.target.value = user.role?._id || '';
  } finally {
    busyUserId.value = null;
  }
}

async function changeWarehouse(user, event) {
  const warehouseId = event.target.value;
  if (warehouseId === (user.warehouse?._id || '')) return;
  busyUserId.value = user._id;
  try {
    await platformService.setOrgUserWarehouse(props.organizationId, user._id, warehouseId || null);
    toast.success('تم تحديث المخزن المخصص');
    load(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
    event.target.value = user.warehouse?._id || '';
  } finally {
    busyUserId.value = null;
  }
}

async function revokeSessions(user) {
  const ok = await confirm({
    title: 'تسجيل خروج جلسات المستخدم',
    message: `سيتم إنهاء جميع الجلسات النشطة لـ "${user.fullName}" فوراً. لن يتم تغيير كلمة المرور.`,
    confirmText: 'تسجيل الخروج',
    danger: true,
  });
  if (!ok) return;
  busyUserId.value = user._id;
  try {
    await platformService.revokeOrgUserSessions(props.organizationId, user._id);
    toast.success('تم تسجيل خروج جلسات المستخدم');
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    busyUserId.value = null;
  }
}

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

onMounted(() => {
  load();
  loadOptions();
});
</script>

<template>
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
          <th>الدور</th>
          <th>المخزن</th>
          <th>الحالة</th>
          <th>آخر دخول</th>
          <th>تاريخ الإنشاء</th>
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
            <select
              class="input !py-1 !text-xs"
              :value="u.role?._id || ''"
              :disabled="busyUserId === u._id"
              @change="changeRole(u, $event)"
            >
              <option v-for="r in roles" :key="r._id" :value="r._id">{{ r.nameAr }}</option>
            </select>
          </td>
          <td>
            <select
              class="input !py-1 !text-xs"
              :value="u.warehouse?._id || ''"
              :disabled="busyUserId === u._id"
              @change="changeWarehouse(u, $event)"
            >
              <option value="">بدون مخزن</option>
              <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
            </select>
          </td>
          <td><StatusBadge :status="u.status" /></td>
          <td class="text-xs text-slate-400">{{ u.lastLogin ? fmtDate(u.lastLogin) : '—' }}</td>
          <td class="text-xs text-slate-400">{{ fmtDate(u.createdAt) }}</td>
          <td>
            <div class="flex items-center gap-2">
              <router-link :to="`/users/${u._id}`" class="btn-outline !px-2 !py-1 text-xs">عرض</router-link>
              <button
                class="btn-outline !px-2 !py-1 text-xs"
                :class="u.status === 'active' ? 'text-red-600' : 'text-green-600'"
                :disabled="busyUserId === u._id"
                @click="toggleStatus(u)"
              >
                {{ u.status === 'active' ? 'تعطيل' : 'تفعيل' }}
              </button>
              <button
                class="btn-outline !px-2 !py-1 text-xs text-red-600"
                :disabled="busyUserId === u._id"
                @click="revokeSessions(u)"
              >
                تسجيل خروج الجلسات
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
  </div>
</template>
