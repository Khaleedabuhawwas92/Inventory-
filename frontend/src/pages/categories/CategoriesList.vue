<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import categoryService from '@/services/categoryService';
import Modal from '@/components/ui/Modal.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();

const categories = ref([]);
const loading = ref(true);
const modalOpen = ref(false);
const editing = ref(null);
const saving = ref(false);

const form = reactive({ nameAr: '', nameEn: '', code: '', parent: '', description: '' });

const mainCategories = computed(() => categories.value.filter((c) => !c.parent));
function childrenOf(id) {
  return categories.value.filter((c) => c.parent?._id === id);
}

async function load() {
  loading.value = true;
  try {
    const { data } = await categoryService.list();
    categories.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل التصنيفات');
  } finally {
    loading.value = false;
  }
}

function openCreate(parent = '') {
  editing.value = null;
  form.nameAr = ''; form.nameEn = ''; form.code = ''; form.parent = parent; form.description = '';
  modalOpen.value = true;
}

function openEdit(c) {
  editing.value = c;
  form.nameAr = c.nameAr; form.nameEn = c.nameEn || ''; form.code = c.code || '';
  form.parent = c.parent?._id || ''; form.description = c.description || '';
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    const payload = { nameAr: form.nameAr, nameEn: form.nameEn, code: form.code || undefined, parent: form.parent || null, description: form.description };
    if (editing.value) {
      await categoryService.update(editing.value._id, payload);
      toast.success('تم تحديث التصنيف');
    } else {
      await categoryService.create(payload);
      toast.success('تم إنشاء التصنيف بنجاح');
    }
    modalOpen.value = false;
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

async function remove(c) {
  const ok = await confirm({ title: 'حذف التصنيف', message: `هل تريد حذف التصنيف "${c.nameAr}"؟`, confirmText: 'حذف', danger: true });
  if (!ok) return;
  try {
    await categoryService.remove(c._id);
    toast.success('تم حذف التصنيف');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حذف التصنيف');
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">التصنيفات</h1>
      <button v-if="auth.can('categories.create')" class="btn-primary" @click="openCreate()">+ تصنيف رئيسي</button>
    </div>

    <LoadingSpinner v-if="loading" />
    <EmptyState v-else-if="!mainCategories.length" title="لا توجد تصنيفات" />
    <div v-else class="space-y-3">
      <div v-for="cat in mainCategories" :key="cat._id" class="card p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-slate-800 dark:text-slate-100">{{ cat.nameAr }}</h3>
          <div class="flex items-center gap-2">
            <button v-if="auth.can('categories.create')" class="btn-outline !px-2 !py-1 text-xs" @click="openCreate(cat._id)">+ تصنيف فرعي</button>
            <button v-if="auth.can('categories.edit')" class="btn-outline !px-2 !py-1 text-xs" @click="openEdit(cat)">تعديل</button>
            <button v-if="auth.can('categories.delete')" class="btn-outline !px-2 !py-1 text-xs text-red-600" @click="remove(cat)">حذف</button>
          </div>
        </div>
        <div v-if="childrenOf(cat._id).length" class="mt-3 mr-5 border-r border-slate-200 dark:border-slate-700 pr-4 space-y-2">
          <div v-for="child in childrenOf(cat._id)" :key="child._id" class="flex items-center justify-between text-sm">
            <span class="text-slate-600 dark:text-slate-300">{{ child.nameAr }}</span>
            <div class="flex items-center gap-2">
              <button v-if="auth.can('categories.edit')" class="text-xs text-primary-600 hover:underline" @click="openEdit(child)">تعديل</button>
              <button v-if="auth.can('categories.delete')" class="text-xs text-red-600 hover:underline" @click="remove(child)">حذف</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Modal v-model="modalOpen" :title="editing ? 'تعديل تصنيف' : 'تصنيف جديد'">
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
          <label class="label">الرمز</label>
          <input v-model="form.code" class="input" />
        </div>
        <div>
          <label class="label">التصنيف الأب</label>
          <select v-model="form.parent" class="input">
            <option value="">بدون (تصنيف رئيسي)</option>
            <option v-for="c in mainCategories" :key="c._id" :value="c._id">{{ c.nameAr }}</option>
          </select>
        </div>
        <div>
          <label class="label">الوصف</label>
          <input v-model="form.description" class="input" />
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="modalOpen = false">إلغاء</button>
        <button class="btn-primary" :disabled="saving" @click="submit">{{ saving ? 'جاري الحفظ...' : 'حفظ' }}</button>
      </template>
    </Modal>
  </div>
</template>
