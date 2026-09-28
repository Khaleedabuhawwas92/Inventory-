<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const toast = useToast();
const auth = useAuthStore();

const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  organizationName: '',
  admin: { fullName: '', username: '', email: '', password: '', confirmPassword: '' },
  warehouse: { name: 'المخزن الرئيسي', code: 'MAIN' },
  currency: 'JOD',
});

const currencies = ['JOD', 'USD', 'EUR', 'SAR', 'AED', 'EGP'];

async function handleSubmit() {
  errorMessage.value = '';

  if (!form.organizationName.trim()) {
    errorMessage.value = 'اسم المؤسسة مطلوب';
    return;
  }
  if (!form.admin.fullName || !form.admin.username || !form.admin.email || !form.admin.password) {
    errorMessage.value = 'جميع حقول الحساب مطلوبة';
    return;
  }
  if (form.admin.password.length < 8) {
    errorMessage.value = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    return;
  }
  if (form.admin.password !== form.admin.confirmPassword) {
    errorMessage.value = 'كلمتا المرور غير متطابقتين';
    return;
  }
  if (!form.warehouse.name.trim() || !form.warehouse.code.trim()) {
    errorMessage.value = 'اسم ورمز المخزن الرئيسي مطلوبان';
    return;
  }

  loading.value = true;
  try {
    await auth.registerCompany({
      organizationName: form.organizationName,
      admin: {
        fullName: form.admin.fullName,
        username: form.admin.username,
        email: form.admin.email,
        password: form.admin.password,
      },
      warehouse: form.warehouse,
      currency: form.currency,
    });
    toast.success('تم تسجيل المؤسسة بنجاح، مرحباً بك');
    router.push({ name: 'dashboard' });
  } catch (err) {
    errorMessage.value = err.response?.data?.message || 'حدث خطأ أثناء تسجيل المؤسسة';
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
    <div class="card p-8">
      <div class="text-center mb-6">
        <div class="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3">م</div>
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">تسجيل مؤسسة جديدة</h1>
        <p class="text-sm text-slate-400 mt-1">أنشئ حساباً مستقلاً بالكامل لمؤسستك خلال دقيقة</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="errorMessage" class="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {{ errorMessage }}
        </div>

        <div>
          <label class="label">اسم المؤسسة *</label>
          <input v-model="form.organizationName" class="input" placeholder="مثال: شركة النور للتجارة" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الاسم الكامل *</label>
            <input v-model="form.admin.fullName" class="input" />
          </div>
          <div>
            <label class="label">اسم المستخدم *</label>
            <input v-model="form.admin.username" class="input" placeholder="admin" />
          </div>
        </div>

        <div>
          <label class="label">البريد الإلكتروني *</label>
          <input v-model="form.admin.email" type="email" class="input" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">كلمة المرور *</label>
            <input v-model="form.admin.password" type="password" class="input" />
          </div>
          <div>
            <label class="label">تأكيد كلمة المرور *</label>
            <input v-model="form.admin.confirmPassword" type="password" class="input" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">اسم المخزن الرئيسي *</label>
            <input v-model="form.warehouse.name" class="input" />
          </div>
          <div>
            <label class="label">رمز المخزن *</label>
            <input v-model="form.warehouse.code" class="input" placeholder="MAIN" />
          </div>
        </div>

        <div>
          <label class="label">العملة</label>
          <select v-model="form.currency" class="input">
            <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'جاري التسجيل...' : 'تسجيل المؤسسة' }}
        </button>

        <p class="text-center text-sm text-slate-400">
          لديك حساب بالفعل؟
          <router-link to="/login" class="text-primary-600 hover:underline">تسجيل الدخول</router-link>
          ·
          <router-link to="/join" class="text-primary-600 hover:underline">لديك دعوة انضمام؟</router-link>
        </p>
      </form>
    </div>
  </AuthLayout>
</template>
