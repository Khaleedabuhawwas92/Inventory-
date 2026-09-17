<script setup>
import { onMounted, ref } from 'vue';
import settingsService from '@/services/settingsService';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  showDate: { type: Boolean, default: true },
  showCompanyDetails: { type: Boolean, default: true },
});

const company = ref({ name: '', logo: null, address: '', phone: '', email: '', taxNumber: '' });
const logoLoadFailed = ref(false);

const today = new Date();
const printDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

onMounted(async () => {
  try {
    const { data } = await settingsService.publicInfo();
    company.value = { ...company.value, ...data.data.company };
  } catch (err) {
    // بيانات المؤسسة اختيارية لرأس الطباعة — فشل التحميل لا يجب أن يمنع الطباعة
  }
});
</script>

<template>
  <!-- ✅ الشاشة العادية: نفس عنوان الصفحة البسيط كما كان دائماً — بدون أي تغيير -->
  <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 print:hidden">{{ title }}</h1>

  <!-- ✅ الطباعة فقط: رأس احترافي ببيانات المؤسسة وشعارها -->
  <div class="hidden print:block print-header" dir="rtl">
    <div class="print-header-top">
      <div v-if="showCompanyDetails" class="print-header-info">
        <p v-if="company.name" class="print-company-name">{{ company.name }}</p>
        <p v-if="company.address">{{ company.address }}</p>
        <p v-if="company.phone">هاتف: {{ company.phone }}</p>
        <p v-if="company.taxNumber">الرقم الضريبي: {{ company.taxNumber }}</p>
      </div>
      <img
        v-if="company.logo && !logoLoadFailed"
        :src="resolveAssetUrl(company.logo)"
        alt=""
        class="print-header-logo"
        @error="logoLoadFailed = true"
      />
    </div>

    <div class="print-header-divider"></div>

    <div class="print-header-title">
      <h2>{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
      <p v-if="showDate" class="print-header-date">تاريخ الطباعة: {{ printDate }}</p>
    </div>
  </div>
</template>

<style scoped>
/* ✅ هذا الجزء بأكمله ظاهر فقط عند الطباعة (hidden على الشاشة عبر Tailwind
   أعلاه) — لا يؤثر على تصميم الشاشة العادي إطلاقاً */
@media print {
  .print-header {
    font-family: 'Cairo', Tahoma, Arial, sans-serif;
    color: #000;
    background: #fff;
    margin-bottom: 6mm;
  }
  .print-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 4mm;
  }
  .print-header-info {
    text-align: right;
  }
  .print-header-info p {
    margin: 0 0 1mm;
    font-size: 10px;
    line-height: 1.4;
    color: #111;
  }
  .print-company-name {
    font-size: 15px !important;
    font-weight: 800 !important;
    color: #000 !important;
    margin-bottom: 1.5mm !important;
  }
  .print-header-logo {
    max-width: 28mm;
    max-height: 18mm;
    object-fit: contain;
  }
  .print-header-divider {
    border-bottom: 1.5px solid #000;
    margin: 3mm 0;
  }
  .print-header-title {
    text-align: center;
  }
  .print-header-title h2 {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 1mm;
  }
  .print-header-title p {
    font-size: 10px;
    margin: 0 0 1mm;
    color: #333;
  }
  .print-header-date {
    font-size: 9px !important;
    color: #444 !important;
  }
}
</style>
