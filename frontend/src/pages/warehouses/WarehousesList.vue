<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import warehouseService from '@/services/warehouseService';
import userService from '@/services/userService';
import Modal from '@/components/ui/Modal.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const toast = useToast();
const auth = useAuthStore();

const items = ref([]);
const managers = ref([]);
const loading = ref(true);
const modalOpen = ref(false);
const editing = ref(null);
const saving = ref(false);

const form = reactive({ name: '', code: '', address: '', phone: '', manager: '', notes: '', status: 'active' });

async function loadManagers() {
  try {
    const { data } = await userService.list({ limit: 100 });
    managers.value = data.data;
  } catch (err) {
    managers.value = [];
  }
}

async function load() {
  loading.value = true;
  try {
    const { data } = await warehouseService.list({ includeInactive: true });
    items.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل قائمة المخازن');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.name = ''; form.code = ''; form.address = ''; form.phone = ''; form.manager = ''; form.notes = ''; form.status = 'active';
  modalOpen.value = true;
}

function openEdit(w) {
  editing.value = w;
  form.name = w.name; form.code = w.code; form.address = w.address || '';
  form.phone = w.phone || ''; form.manager = w.manager?._id || ''; form.notes = w.notes || ''; form.status = w.status;
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    if (editing.value) {
      await warehouseService.update(editing.value._id, {
        name: form.name, address: form.address, phone: form.phone, manager: form.manager || null, notes: form.notes, status: form.status,
      });
      toast.success('تم تحديث المخزن');
    } else {
      await warehouseService.create({ name: form.name, code: form.code, address: form.address, phone: form.phone, manager: form.manager || null, notes: form.notes });
      toast.success('تم إنشاء المخزن بنجاح');
    }
    modalOpen.value = false;
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

onMounted(() => { load(); loadManagers(); });
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">المخازن</h1>
      <button v-if="auth.can('warehouses.create')" class="btn-primary" @click="openCreate">+ مخزن جديد</button>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد مخازن" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>الاسم</th><th>الرمز</th><th>العنوان</th><th>المسؤول</th><th>الهاتف</th><th>الحالة</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in items" :key="w._id">
            <td class="font-medium text-slate-700 dark:text-slate-200">
              {{ w.name }}
              <span v-if="w.isMain" class="badge-approved mr-1">رئيسي</span>
            </td>
            <td>{{ w.code }}</td>
            <td>{{ w.address || '—' }}</td>
            <td>{{ w.manager?.fullName || '—' }}</td>
            <td>{{ w.phone || '—' }}</td>
            <td><StatusBadge :status="w.status" /></td>
            <td>
              <div class="flex items-center gap-2 justify-end">
                <router-link :to="`/warehouses/${w._id}`" class="btn-outline !px-2 !py-1 text-xs">المواقع</router-link>
                <button v-if="auth.can('warehouses.edit')" class="btn-outline !px-2 !py-1 text-xs" @click="openEdit(w)">تعديل</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal v-model="modalOpen" :title="editing ? 'تعديل مخزن' : 'مخزن جديد'">
      <form class="space-y-3" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">اسم المخزن</label>
            <input v-model="form.name" class="input" required />
          </div>
          <div>
            <label class="label">الرمز</label>
            <input v-model="form.code" class="input" :disabled="!!editing" required />
          </div>
        </div>
        <div>
          <label class="label">العنوان</label>
          <input v-model="form.address" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الهاتف</label>
            <input v-model="form.phone" class="input" />
          </div>
          <div>
            <label class="label">المسؤول</label>
            <select v-model="form.manager" class="input">
              <option value="">بدون تخصيص</option>
              <option v-for="m in managers" :key="m._id" :value="m._id">{{ m.fullName }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="label">ملاحظات</label>
          <input v-model="form.notes" class="input" />
        </div>
        <div v-if="editing">
          <label class="label">الحالة</label>
          <select v-model="form.status" class="input" :disabled="editing.isMain">
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="modalOpen = false">إلغاء</button>
        <button class="btn-primary" :disabled="saving" @click="submit">{{ saving ? 'جاري الحفظ...' : 'حفظ' }}</button>
      </template>
    </Modal>
  </div>
</template>
