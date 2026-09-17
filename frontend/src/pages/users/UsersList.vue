<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import { useConfirm } from '@/composables/useConfirm';
import userService from '@/services/userService';
import roleService from '@/services/roleService';
import warehouseService from '@/services/warehouseService';
import Modal from '@/components/ui/Modal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();

const items = ref([]);
const roles = ref([]);
const warehouses = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });

const filters = reactive({ search: '', role: '', status: '' });

const modalOpen = ref(false);
const editingUser = ref(null);
const saving = ref(false);
const formErrors = ref([]);

const resetPasswordModalOpen = ref(false);
const resetPasswordUser = ref(null);
const resetPasswordValue = ref('');

const form = reactive({
  fullName: '', username: '', email: '', phone: '', password: '', role: '', warehouse: '', status: 'active',
});

function resetForm() {
  form.fullName = ''; form.username = ''; form.email = ''; form.phone = '';
  form.password = ''; form.role = roles.value[0]?._id || ''; form.warehouse = ''; form.status = 'active';
  formErrors.value = [];
}

async function loadLookups() {
  const [rolesRes, warehousesRes] = await Promise.all([roleService.list(), warehouseService.list()]);
  roles.value = rolesRes.data.data;
  warehouses.value = warehousesRes.data.data;
}

async function loadUsers(page = 1) {
  loading.value = true;
  try {
    const { data } = await userService.list({
      page,
      search: filters.search || undefined,
      role: filters.role || undefined,
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
watch(() => [filters.search, filters.role, filters.status], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadUsers(1), 350);
});

function openCreate() {
  editingUser.value = null;
  resetForm();
  modalOpen.value = true;
}

function openEdit(user) {
  editingUser.value = user;
  form.fullName = user.fullName;
  form.username = user.username;
  form.email = user.email;
  form.phone = user.phone || '';
  form.password = '';
  form.role = user.role?._id || '';
  form.warehouse = user.warehouse?._id || '';
  form.status = user.status;
  formErrors.value = [];
  modalOpen.value = true;
}

async function submitForm() {
  saving.value = true;
  formErrors.value = [];
  try {
    if (editingUser.value) {
      await userService.update(editingUser.value._id, {
        fullName: form.fullName, email: form.email, phone: form.phone,
        role: form.role, warehouse: form.warehouse || null, status: form.status,
      });
      toast.success('تم تحديث بيانات المستخدم');
    } else {
      await userService.create({
        fullName: form.fullName, username: form.username, email: form.email, phone: form.phone,
        password: form.password, role: form.role, warehouse: form.warehouse || null, status: form.status,
      });
      toast.success('تم إنشاء المستخدم بنجاح');
    }
    modalOpen.value = false;
    loadUsers(meta.value.page);
  } catch (err) {
    formErrors.value = err.response?.data?.errors || [];
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(user) {
  const disabling = user.status === 'active';
  const ok = await confirm({
    title: disabling ? 'تعطيل المستخدم' : 'تفعيل المستخدم',
    message: disabling
      ? `هل أنت متأكد من تعطيل حساب "${user.fullName}"؟ لن يتمكن من الدخول للنظام.`
      : `هل تريد إعادة تفعيل حساب "${user.fullName}"؟`,
    confirmText: disabling ? 'تعطيل' : 'تفعيل',
    danger: disabling,
  });
  if (!ok) return;

  try {
    if (disabling) await userService.disable(user._id);
    else await userService.enable(user._id);
    toast.success(disabling ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
    loadUsers(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

function openResetPassword(user) {
  resetPasswordUser.value = user;
  resetPasswordValue.value = '';
  resetPasswordModalOpen.value = true;
}

async function submitResetPassword() {
  if (resetPasswordValue.value.length < 8) {
    toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    return;
  }
  try {
    await userService.resetPassword(resetPasswordUser.value._id, resetPasswordValue.value);
    toast.success('تم إعادة تعيين كلمة المرور بنجاح');
    resetPasswordModalOpen.value = false;
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

onMounted(async () => {
  await loadLookups();
  await loadUsers();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">المستخدمون</h1>
      <button v-if="auth.can('users.manage')" class="btn-primary" @click="openCreate">+ مستخدم جديد</button>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3">
      <input v-model="filters.search" class="input flex-1 min-w-[200px]" placeholder="بحث بالاسم أو اسم المستخدم أو البريد..." />
      <select v-model="filters.role" class="input !w-auto">
        <option value="">كل الأدوار</option>
        <option v-for="r in roles" :key="r._id" :value="r._id">{{ r.nameAr }}</option>
      </select>
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
            <th>البريد الإلكتروني</th>
            <th>الدور</th>
            <th>المخزن</th>
            <th>الحالة</th>
            <th>آخر دخول</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in items" :key="user._id">
            <td class="font-medium text-slate-700 dark:text-slate-200">{{ user.fullName }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role?.nameAr }}</td>
            <td>{{ user.warehouse?.name || '—' }}</td>
            <td><StatusBadge :status="user.status" /></td>
            <td class="text-xs text-slate-400">{{ user.lastLogin ? new Date(user.lastLogin).toLocaleString('ar') : '—' }}</td>
            <td>
              <div class="flex items-center gap-2 justify-end">
                <button v-if="auth.can('users.manage')" class="btn-outline !px-2 !py-1 text-xs" @click="openEdit(user)">تعديل</button>
                <button v-if="auth.can('users.manage')" class="btn-outline !px-2 !py-1 text-xs" @click="openResetPassword(user)">إعادة تعيين كلمة المرور</button>
                <button
                  v-if="auth.can('users.manage')"
                  class="btn-outline !px-2 !py-1 text-xs"
                  :class="user.status === 'active' ? 'text-red-600' : 'text-green-600'"
                  @click="toggleStatus(user)"
                >
                  {{ user.status === 'active' ? 'تعطيل' : 'تفعيل' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="loadUsers" />
    </div>

    <Modal v-model="modalOpen" :title="editingUser ? 'تعديل مستخدم' : 'مستخدم جديد'">
      <form class="space-y-3" @submit.prevent="submitForm">
        <div>
          <label class="label">الاسم الكامل</label>
          <input v-model="form.fullName" class="input" required />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">اسم المستخدم</label>
            <input v-model="form.username" class="input" :disabled="!!editingUser" required />
          </div>
          <div>
            <label class="label">البريد الإلكتروني</label>
            <input v-model="form.email" type="email" class="input" required />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الهاتف</label>
            <input v-model="form.phone" class="input" />
          </div>
          <div v-if="!editingUser">
            <label class="label">كلمة المرور</label>
            <input v-model="form.password" type="password" class="input" required minlength="8" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الدور</label>
            <select v-model="form.role" class="input" required>
              <option v-for="r in roles" :key="r._id" :value="r._id">{{ r.nameAr }}</option>
            </select>
          </div>
          <div>
            <label class="label">المخزن المخصص</label>
            <select v-model="form.warehouse" class="input">
              <option value="">بدون تخصيص</option>
              <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
            </select>
          </div>
        </div>
        <div v-if="editingUser">
          <label class="label">الحالة</label>
          <select v-model="form.status" class="input">
            <option value="active">نشط</option>
            <option value="disabled">معطل</option>
          </select>
        </div>
        <ul v-if="formErrors.length" class="text-sm text-red-600 list-disc pr-5">
          <li v-for="(e, i) in formErrors" :key="i">{{ e.message }}</li>
        </ul>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="modalOpen = false">إلغاء</button>
        <button class="btn-primary" :disabled="saving" @click="submitForm">{{ saving ? 'جاري الحفظ...' : 'حفظ' }}</button>
      </template>
    </Modal>

    <Modal v-model="resetPasswordModalOpen" title="إعادة تعيين كلمة المرور" size="sm">
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">
        إعادة تعيين كلمة مرور المستخدم "{{ resetPasswordUser?.fullName }}"
      </p>
      <input v-model="resetPasswordValue" type="password" class="input" placeholder="كلمة المرور الجديدة" />
      <template #footer>
        <button class="btn-secondary" @click="resetPasswordModalOpen = false">إلغاء</button>
        <button class="btn-primary" @click="submitResetPassword">حفظ</button>
      </template>
    </Modal>
  </div>
</template>
