<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
});

const toast = useToast();
const loading = ref(true);
const saving = ref(false);

const FEATURE_LABELS = {
  multiWarehouse: 'تعدد المخازن',
  barcode: 'الباركود',
  purchasing: 'المشتريات',
  advancedReports: 'التقارير المتقدمة',
  inventoryCount: 'الجرد',
  returns: 'المرتجعات',
  backups: 'النسخ الاحتياطي',
  csvExport: 'تصدير CSV',
  pdfExport: 'تصدير PDF',
};

const features = reactive({});

async function load() {
  loading.value = true;
  try {
    const { data } = await platformService.getFeatures(props.organizationId);
    Object.keys(FEATURE_LABELS).forEach((key) => {
      features[key] = !!data.data[key];
    });
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل ميزات المؤسسة');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await platformService.updateFeatures(props.organizationId, { ...features });
    toast.success('تم تحديث ميزات المؤسسة');
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="card p-4 max-w-2xl">
    <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-1">الميزات المتاحة للمؤسسة</h3>
    <p class="text-xs text-slate-400 mb-4">
      تعطيل ميزة يمنع استخدامها فعلياً من الخادم، ولا يحذف أي بيانات مرتبطة بها. تطبيق المؤسسة يخفي الوحدات المعطّلة تلقائياً.
    </p>
    <LoadingSpinner v-if="loading" />
    <div v-else class="space-y-3">
      <label
        v-for="(label, key) in FEATURE_LABELS"
        :key="key"
        class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
      >
        <span class="text-sm">{{ label }}</span>
        <input v-model="features[key]" type="checkbox" class="w-5 h-5 accent-primary-700" />
      </label>
      <button class="btn-primary mt-2" :disabled="saving" @click="save">
        {{ saving ? 'جارٍ الحفظ...' : 'حفظ الميزات' }}
      </button>
    </div>
  </div>
</template>
