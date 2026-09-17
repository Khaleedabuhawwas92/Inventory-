<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import supplierService from '@/services/supplierService';
import Modal from '@/components/ui/Modal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const toast = useToast();
const auth = useAuthStore();

const items = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });
const filters = reactive({ search: '' });

const modalOpen = ref(false);
const editing = ref(null);
const saving = ref(false);
const form = reactive({ name: '', code: '', phone: '', whatsapp: '', email: '', taxNumber: '', address: '', contactPerson: '', notes: '' });

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await supplierService.list({ page, search: filters.search || undefined, includeInactive: true });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error('تعذر تحميل قائمة الموردين');
  } finally {
    loading.value = false;
  }
}

let timer = null;
watch(() => filters.search, () => { clearTimeout(timer); timer = setTimeout(() => load(1), 350); });

function resetForm() {
  form.name = ''; form.code = ''; form.phone = ''; form.whatsapp = ''; form.email = '';
  form.taxNumber = ''; form.address = ''; form.contactPerson = ''; form.notes = '';
}

function openCreate() {
  editing.value = null;
  resetForm();
  modalOpen.value = true;
}

function openEdit(s) {
  editing.value = s;
  form.name = s.name; form.code = s.code || ''; form.phone = s.phone || ''; form.whatsapp = s.whatsapp || '';
  form.email = s.email || ''; form.taxNumber = s.taxNumber || ''; form.address = s.address || '';
  form.contactPerson = s.contactPerson || ''; form.notes = s.notes || '';
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    if (editing.value) {
      await supplierService.update(editing.value._id, { ...form });
      toast.success('تم تحديث بيانات المورد');
    } else {
      await supplierService.create({ ...form });
      toast.success('تم إنشاء المورد بنجاح');
    }
    modalOpen.value = false;
    load(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">الموردون</h1>
      <button v-if="auth.can('suppliers.manage')" class="btn-primary" @click="openCreate">+ مورد جديد</button>
    </div>

    <div class="card p-4 mb-4">
      <input v-model="filters.search" class="input" placeholder="بحث باسم المورد..." />
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا يوجد موردون" />
      <table v-else class="table-base">
        <thead><tr><th>الاسم</th><th>الهاتف</th><th>البريد الإلكتروني</th><th>الرصيد</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          <tr v-for="s in items" :key="s._id">
            <td class="font-medium text-slate-700 dark:text-slate-200">{{ s.name }}</td>
            <td>{{ s.phone || '—' }}</td>
            <td>{{ s.email || '—' }}</td>
            <td>{{ s.balance?.toFixed(2) }}</td>
            <td><StatusBadge :status="s.active ? 'active' : 'inactive'" /></td>
            <td>
              <div class="flex items-center gap-2 justify-end">
                <router-link :to="`/suppliers/${s._id}`" class="btn-outline !px-2 !py-1 text-xs">عرض</router-link>
                <button v-if="auth.can('suppliers.manage')" class="btn-outline !px-2 !py-1 text-xs" @click="openEdit(s)">تعديل</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
    </div>

    <Modal v-model="modalOpen" :title="editing ? 'تعديل مورد' : 'مورد جديد'" size="lg">
      <form class="grid sm:grid-cols-2 gap-3" @submit.prevent="submit">
        <div><label class="label">الاسم *</label><input v-model="form.name" class="input" required /></div>
        <div><label class="label">الرمز</label><input v-model="form.code" class="input" /></div>
        <div><label class="label">الهاتف</label><input v-model="form.phone" class="input" /></div>
        <div><label class="label">واتساب</label><input v-model="form.whatsapp" class="input" /></div>
        <div><label class="label">البريد الإلكتروني</label><input v-model="form.email" type="email" class="input" /></div>
        <div><label class="label">الرقم الضريبي</label><input v-model="form.taxNumber" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">العنوان</label><input v-model="form.address" class="input" /></div>
        <div><label class="label">جهة الاتصال</label><input v-model="form.contactPerson" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">ملاحظات</label><input v-model="form.notes" class="input" /></div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="modalOpen = false">إلغاء</button>
        <button class="btn-primary" :disabled="saving" @click="submit">{{ saving ? 'جاري الحفظ...' : 'حفظ' }}</button>
      </template>
    </Modal>
  </div>
</template>
