<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import unitService from '@/services/unitService';
import Modal from '@/components/ui/Modal.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();

const items = ref([]);
const loading = ref(true);
const modalOpen = ref(false);
const editing = ref(null);
const saving = ref(false);
const form = reactive({ nameAr: '', nameEn: '', shortCode: '' });

async function load() {
  loading.value = true;
  try {
    const { data } = await unitService.list();
    items.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل الوحدات');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.nameAr = ''; form.nameEn = ''; form.shortCode = '';
  modalOpen.value = true;
}
function openEdit(u) {
  editing.value = u;
  form.nameAr = u.nameAr; form.nameEn = u.nameEn || ''; form.shortCode = u.shortCode;
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    if (editing.value) {
      await unitService.update(editing.value._id, { ...form });
      toast.success('تم تحديث الوحدة');
    } else {
      await unitService.create({ ...form });
      toast.success('تم إنشاء الوحدة بنجاح');
    }
    modalOpen.value = false;
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

async function remove(u) {
  const ok = await confirm({ title: 'حذف الوحدة', message: `هل تريد حذف الوحدة "${u.nameAr}"؟`, confirmText: 'حذف', danger: true });
  if (!ok) return;
  try {
    await unitService.remove(u._id);
    toast.success('تم حذف الوحدة');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حذف الوحدة');
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">الوحدات</h1>
      <button v-if="auth.can('units.manage')" class="btn-primary" @click="openCreate">+ وحدة جديدة</button>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد وحدات" />
      <table v-else class="table-base">
        <thead><tr><th>الاسم بالعربية</th><th>الاسم بالإنجليزية</th><th>الرمز</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in items" :key="u._id">
            <td class="font-medium text-slate-700 dark:text-slate-200">{{ u.nameAr }}</td>
            <td>{{ u.nameEn || '—' }}</td>
            <td class="font-mono">{{ u.shortCode }}</td>
            <td>
              <div class="flex items-center gap-2 justify-end">
                <button v-if="auth.can('units.manage')" class="btn-outline !px-2 !py-1 text-xs" @click="openEdit(u)">تعديل</button>
                <button v-if="auth.can('units.manage')" class="btn-outline !px-2 !py-1 text-xs text-red-600" @click="remove(u)">حذف</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal v-model="modalOpen" :title="editing ? 'تعديل وحدة' : 'وحدة جديدة'" size="sm">
      <form class="space-y-3" @submit.prevent="submit">
        <div>
          <label class="label">الاسم بالعربية</label>
          <input v-model="form.nameAr" class="input" required />
        </div>
        <div>
          <label class="label">الاسم بالإنجليزية</label>
          <input v-model="form.nameEn" class="input" />
        </div>
        <div>
          <label class="label">الرمز المختصر</label>
          <input v-model="form.shortCode" class="input" required />
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="modalOpen = false">إلغاء</button>
        <button class="btn-primary" :disabled="saving" @click="submit">{{ saving ? 'جاري الحفظ...' : 'حفظ' }}</button>
      </template>
    </Modal>
  </div>
</template>
