<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import AuthLayout from '@/layouts/AuthLayout.vue';
import authService from '@/services/authService';
import { invalidateSetupStatusCache } from '@/router';

const router = useRouter();
const toast = useToast();

const steps = [
  { key: 'company', title: 'بيانات المؤسسة' },
  { key: 'admin', title: 'حساب المدير العام' },
  { key: 'warehouse', title: 'المخزن الرئيسي' },
  { key: 'currency', title: 'العملة' },
  { key: 'units', title: 'وحدات القياس' },
  { key: 'finish', title: 'إنهاء الإعداد' },
];
const currentStep = ref(0);
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  company: { name: '', address: '', phone: '', email: '', taxNumber: '' },
  admin: { fullName: '', username: '', email: '', password: '', confirmPassword: '' },
  warehouse: { name: 'المخزن الرئيسي', code: 'MAIN', address: '' },
  currency: 'JOD',
  units: [
    { nameAr: 'حبة', nameEn: 'Piece', shortCode: 'PCS' },
    { nameAr: 'كرتونة', nameEn: 'Carton', shortCode: 'CTN' },
    { nameAr: 'صندوق', nameEn: 'Box', shortCode: 'BOX' },
    { nameAr: 'كيس', nameEn: 'Bag', shortCode: 'BAG' },
    { nameAr: 'كيلوغرام', nameEn: 'Kilogram', shortCode: 'KG' },
    { nameAr: 'لتر', nameEn: 'Liter', shortCode: 'L' },
    { nameAr: 'متر', nameEn: 'Meter', shortCode: 'M' },
  ],
});

const currencies = ['JOD', 'USD', 'EUR', 'SAR', 'AED', 'EGP'];

const progressPercent = computed(() => Math.round(((currentStep.value + 1) / steps.length) * 100));

function validateStep() {
  errorMessage.value = '';
  const key = steps[currentStep.value].key;
  if (key === 'company' && !form.company.name.trim()) {
    errorMessage.value = 'اسم المؤسسة مطلوب';
    return false;
  }
  if (key === 'admin') {
    if (!form.admin.fullName || !form.admin.username || !form.admin.email || !form.admin.password) {
      errorMessage.value = 'جميع حقول حساب المدير العام مطلوبة';
      return false;
    }
    if (form.admin.password.length < 8) {
      errorMessage.value = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
      return false;
    }
    if (form.admin.password !== form.admin.confirmPassword) {
      errorMessage.value = 'كلمتا المرور غير متطابقتين';
      return false;
    }
  }
  if (key === 'warehouse' && (!form.warehouse.name.trim() || !form.warehouse.code.trim())) {
    errorMessage.value = 'اسم ورمز المخزن الرئيسي مطلوبان';
    return false;
  }
  return true;
}

function nextStep() {
  if (!validateStep()) return;
  if (currentStep.value < steps.length - 1) currentStep.value += 1;
}

function prevStep() {
  errorMessage.value = '';
  if (currentStep.value > 0) currentStep.value -= 1;
}

function addUnit() {
  form.units.push({ nameAr: '', nameEn: '', shortCode: '' });
}
function removeUnit(index) {
  form.units.splice(index, 1);
}

async function finishSetup() {
  loading.value = true;
  errorMessage.value = '';
  try {
    await authService.runSetup({
      company: form.company,
      admin: {
        fullName: form.admin.fullName,
        username: form.admin.username,
        email: form.admin.email,
        password: form.admin.password,
      },
      warehouse: form.warehouse,
      currency: form.currency,
      units: form.units.filter((u) => u.nameAr && u.shortCode),
    });
    invalidateSetupStatusCache();
    toast.success('تم إعداد النظام بنجاح، الرجاء تسجيل الدخول');
    router.push({ name: 'login' });
  } catch (err) {
    errorMessage.value = err.response?.data?.message || 'حدث خطأ أثناء إعداد النظام';
    if (err.response?.data?.errors?.length) {
      errorMessage.value += ': ' + err.response.data.errors.map((e) => e.message).join('، ');
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="card p-8 max-w-lg mx-auto">
      <div class="text-center mb-6">
        <div class="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3">م</div>
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">إعداد النظام لأول مرة</h1>
        <p class="text-sm text-slate-400 mt-1">{{ steps[currentStep].title }} ({{ currentStep + 1 }}/{{ steps.length }})</p>
      </div>

      <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-6 overflow-hidden">
        <div class="h-full bg-primary-600 transition-all duration-300" :style="{ width: progressPercent + '%' }" />
      </div>

      <div v-if="errorMessage" class="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 mb-4">
        {{ errorMessage }}
      </div>

      <!-- Step 1: Company -->
      <div v-if="steps[currentStep].key === 'company'" class="space-y-3">
        <div>
          <label class="label">اسم المؤسسة *</label>
          <input v-model="form.company.name" class="input" placeholder="مثال: شركة النور للتجارة" />
        </div>
        <div>
          <label class="label">العنوان</label>
          <input v-model="form.company.address" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الهاتف</label>
            <input v-model="form.company.phone" class="input" />
          </div>
          <div>
            <label class="label">البريد الإلكتروني</label>
            <input v-model="form.company.email" class="input" type="email" />
          </div>
        </div>
        <div>
          <label class="label">الرقم الضريبي</label>
          <input v-model="form.company.taxNumber" class="input" />
        </div>
      </div>

      <!-- Step 2: Super Admin -->
      <div v-else-if="steps[currentStep].key === 'admin'" class="space-y-3">
        <div>
          <label class="label">الاسم الكامل *</label>
          <input v-model="form.admin.fullName" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">اسم المستخدم *</label>
            <input v-model="form.admin.username" class="input" placeholder="admin" />
          </div>
          <div>
            <label class="label">البريد الإلكتروني *</label>
            <input v-model="form.admin.email" class="input" type="email" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">كلمة المرور *</label>
            <input v-model="form.admin.password" class="input" type="password" />
          </div>
          <div>
            <label class="label">تأكيد كلمة المرور *</label>
            <input v-model="form.admin.confirmPassword" class="input" type="password" />
          </div>
        </div>
      </div>

      <!-- Step 3: Main Warehouse -->
      <div v-else-if="steps[currentStep].key === 'warehouse'" class="space-y-3">
        <div>
          <label class="label">اسم المخزن *</label>
          <input v-model="form.warehouse.name" class="input" />
        </div>
        <div>
          <label class="label">رمز المخزن *</label>
          <input v-model="form.warehouse.code" class="input" placeholder="MAIN" />
        </div>
        <div>
          <label class="label">العنوان</label>
          <input v-model="form.warehouse.address" class="input" />
        </div>
      </div>

      <!-- Step 4: Currency -->
      <div v-else-if="steps[currentStep].key === 'currency'" class="space-y-3">
        <label class="label">اختر العملة الافتراضية</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="c in currencies"
            :key="c"
            type="button"
            class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            :class="form.currency === c
              ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'"
            @click="form.currency = c"
          >
            {{ c }}
          </button>
        </div>
      </div>

      <!-- Step 5: Units -->
      <div v-else-if="steps[currentStep].key === 'units'" class="space-y-3">
        <label class="label">الوحدات الافتراضية</label>
        <div class="max-h-64 overflow-y-auto space-y-2 pl-1">
          <div v-for="(unit, i) in form.units" :key="i" class="flex items-center gap-2">
            <input v-model="unit.nameAr" class="input" placeholder="الاسم بالعربية" />
            <input v-model="unit.shortCode" class="input !w-24" placeholder="الرمز" />
            <button type="button" class="text-red-500 hover:text-red-700 shrink-0" @click="removeUnit(i)">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <button type="button" class="btn-outline w-full" @click="addUnit">+ إضافة وحدة</button>
      </div>

      <!-- Step 6: Finish -->
      <div v-else-if="steps[currentStep].key === 'finish'" class="text-center py-4 space-y-2">
        <p class="text-sm text-slate-500 dark:text-slate-400">جاهز لإنهاء إعداد النظام:</p>
        <ul class="text-sm text-slate-700 dark:text-slate-200 space-y-1">
          <li>المؤسسة: <strong>{{ form.company.name }}</strong></li>
          <li>المدير العام: <strong>{{ form.admin.username }}</strong></li>
          <li>المخزن الرئيسي: <strong>{{ form.warehouse.name }} ({{ form.warehouse.code }})</strong></li>
          <li>العملة: <strong>{{ form.currency }}</strong></li>
          <li>عدد الوحدات: <strong>{{ form.units.length }}</strong></li>
        </ul>
      </div>

      <div class="flex items-center gap-3 mt-6">
        <button v-if="currentStep > 0" type="button" class="btn-secondary" @click="prevStep">السابق</button>
        <button
          v-if="currentStep < steps.length - 1"
          type="button"
          class="btn-primary flex-1"
          @click="nextStep"
        >
          التالي
        </button>
        <button v-else type="button" class="btn-primary flex-1" :disabled="loading" @click="finishSetup">
          {{ loading ? 'جاري الإعداد...' : 'إنهاء الإعداد' }}
        </button>
      </div>
    </div>
  </AuthLayout>
</template>
