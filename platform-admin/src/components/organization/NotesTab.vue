<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
});

const toast = useToast();
const loading = ref(true);
const items = ref([]);
const meta = ref({ page: 1, totalPages: 1, total: 0 });

const CATEGORY_LABELS = { SUPPORT: 'دعم فني', BILLING: 'فوترة', GENERAL: 'عام' };

const form = reactive({ text: '', category: 'GENERAL' });
const submitting = ref(false);

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await platformService.organizationNotes(props.organizationId, { page });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل الملاحظات');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!form.text.trim()) {
    toast.error('نص الملاحظة مطلوب');
    return;
  }
  submitting.value = true;
  try {
    await platformService.addOrganizationNote(props.organizationId, { text: form.text.trim(), category: form.category });
    toast.success('تمت إضافة الملاحظة');
    form.text = '';
    load(1);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-3">
    <div class="card p-4 lg:col-span-1 h-fit">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">إضافة ملاحظة</h3>
      <p class="text-xs text-slate-400 mb-3">هذه الملاحظات داخلية لفريق منصة الإدارة فقط، ولا تظهر أبداً لأي مستخدم داخل المؤسسة.</p>
      <div class="space-y-3">
        <select v-model="form.category" class="input">
          <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <textarea v-model="form.text" class="input" rows="4" placeholder="نص الملاحظة"></textarea>
        <button class="btn-primary w-full" :disabled="submitting" @click="submit">
          {{ submitting ? 'جارٍ الإضافة...' : 'إضافة الملاحظة' }}
        </button>
      </div>
    </div>

    <div class="card p-4 lg:col-span-2">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الملاحظات ({{ meta.total }})</h3>
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد ملاحظات بعد" />
      <template v-else>
        <ul class="space-y-3">
          <li v-for="note in items" :key="note._id" class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div class="flex items-center justify-between mb-1">
              <span class="badge-draft">{{ CATEGORY_LABELS[note.category] || note.category }}</span>
              <span class="text-xs text-slate-400">{{ fmtDate(note.createdAt) }}</span>
            </div>
            <p class="text-sm whitespace-pre-wrap">{{ note.text }}</p>
            <p class="text-xs text-slate-400 mt-1">بواسطة {{ note.createdBy?.fullName || '—' }}</p>
          </li>
        </ul>
        <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="load" />
      </template>
    </div>
  </div>
</template>
