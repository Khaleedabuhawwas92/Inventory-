<script setup>
import { onMounted, reactive, ref, computed } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import roleService from '@/services/roleService';
import Modal from '@/components/ui/Modal.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const toast = useToast();
const confirm = useConfirm();

const roles = ref([]);
const allPermissions = ref([]);
const loading = ref(true);
const modalOpen = ref(false);
const editingRole = ref(null);
const saving = ref(false);

const form = reactive({ name: '', nameAr: '', description: '', permissions: [] });

const groupedPermissions = computed(() => {
  const groups = {};
  for (const p of allPermissions.value) {
    const [module] = p.split('.');
    if (!groups[module]) groups[module] = [];
    groups[module].push(p);
  }
  return groups;
});

const MODULE_LABELS = {
  dashboard: 'لوحة التحكم', products: 'الأصناف', categories: 'التصنيفات', units: 'الوحدات',
  warehouses: 'المخازن', stock: 'الحركات', inventory: 'الجرد', suppliers: 'الموردون',
  purchases: 'المشتريات', reports: 'التقارير', users: 'المستخدمون', roles: 'الأدوار',
  audit: 'سجل العمليات', settings: 'الإعدادات',
};

async function loadData() {
  loading.value = true;
  try {
    const [rolesRes, permsRes] = await Promise.all([roleService.list(), roleService.permissions()]);
    roles.value = rolesRes.data.data;
    allPermissions.value = permsRes.data.data;
  } catch (err) {
    toast.error('تعذر تحميل الأدوار والصلاحيات');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingRole.value = null;
  form.name = ''; form.nameAr = ''; form.description = ''; form.permissions = [];
  modalOpen.value = true;
}

function openEdit(role) {
  editingRole.value = role;
  form.name = role.name; form.nameAr = role.nameAr; form.description = role.description || '';
  form.permissions = [...role.permissions];
  modalOpen.value = true;
}

function toggleAllInModule(module, checked) {
  const modulePerms = groupedPermissions.value[module];
  if (checked) {
    form.permissions = [...new Set([...form.permissions, ...modulePerms])];
  } else {
    form.permissions = form.permissions.filter((p) => !modulePerms.includes(p));
  }
}

function isModuleFullyChecked(module) {
  return groupedPermissions.value[module].every((p) => form.permissions.includes(p));
}

async function submitForm() {
  saving.value = true;
  try {
    if (editingRole.value) {
      await roleService.update(editingRole.value._id, {
        nameAr: form.nameAr, description: form.description, permissions: form.permissions,
      });
      toast.success('تم تحديث الدور بنجاح');
    } else {
      await roleService.create(form);
      toast.success('تم إنشاء الدور بنجاح');
    }
    modalOpen.value = false;
    loadData();
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

async function removeRole(role) {
  const ok = await confirm({
    title: 'حذف الدور',
    message: `هل أنت متأكد من حذف الدور "${role.nameAr}"؟ هذا الإجراء لا يمكن التراجع عنه.`,
    confirmText: 'حذف',
    danger: true,
  });
  if (!ok) return;
  try {
    await roleService.remove(role._id);
    toast.success('تم حذف الدور');
    loadData();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حذف الدور');
  }
}

onMounted(loadData);
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">الأدوار والصلاحيات</h1>
      <button class="btn-primary" @click="openCreate">+ دور جديد</button>
    </div>

    <LoadingSpinner v-if="loading" />
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="role in roles" :key="role._id" class="card p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-slate-800 dark:text-slate-100">{{ role.nameAr }}</h3>
          <span v-if="role.isSystem" class="badge-draft">نظامي</span>
        </div>
        <p class="text-xs text-slate-400">{{ role.name }}</p>
        <p class="text-sm text-slate-500 dark:text-slate-400 min-h-[1.25rem]">{{ role.description }}</p>
        <p class="text-xs text-slate-400">{{ role.permissions.length }} صلاحية</p>
        <div class="flex items-center gap-2 mt-2">
          <button class="btn-outline !px-2 !py-1 text-xs flex-1" @click="openEdit(role)">تعديل الصلاحيات</button>
          <button v-if="!role.isSystem" class="btn-outline !px-2 !py-1 text-xs text-red-600" @click="removeRole(role)">حذف</button>
        </div>
      </div>
    </div>

    <Modal v-model="modalOpen" :title="editingRole ? `تعديل: ${editingRole.nameAr}` : 'دور جديد'" size="lg">
      <form class="space-y-4" @submit.prevent="submitForm">
        <div v-if="!editingRole" class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الاسم (بالإنجليزية)</label>
            <input v-model="form.name" class="input" placeholder="e.g. accountant" required />
          </div>
          <div>
            <label class="label">الاسم بالعربية</label>
            <input v-model="form.nameAr" class="input" required />
          </div>
        </div>
        <div v-else>
          <label class="label">الاسم بالعربية</label>
          <input v-model="form.nameAr" class="input" required />
        </div>
        <div>
          <label class="label">الوصف</label>
          <input v-model="form.description" class="input" />
        </div>

        <div>
          <label class="label mb-3">الصلاحيات</label>
          <div class="space-y-3 max-h-96 overflow-y-auto pl-1">
            <div v-for="(perms, module) in groupedPermissions" :key="module" class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <label class="flex items-center gap-2 font-medium text-sm text-slate-700 dark:text-slate-200 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="isModuleFullyChecked(module)"
                  class="rounded border-slate-300 text-primary-600"
                  @change="toggleAllInModule(module, $event.target.checked)"
                />
                {{ MODULE_LABELS[module] || module }}
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pr-5">
                <label v-for="p in perms" :key="p" class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                  <input v-model="form.permissions" type="checkbox" :value="p" class="rounded border-slate-300 text-primary-600" />
                  {{ p }}
                </label>
              </div>
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="modalOpen = false">إلغاء</button>
        <button class="btn-primary" :disabled="saving" @click="submitForm">{{ saving ? 'جاري الحفظ...' : 'حفظ' }}</button>
      </template>
    </Modal>
  </div>
</template>
