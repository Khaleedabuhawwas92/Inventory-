<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const form = reactive({ identifier: '', password: '' });
const loading = ref(false);
const errorMessage = ref('');

async function handleSubmit() {
  errorMessage.value = '';
  if (!form.identifier || !form.password) {
    errorMessage.value = 'الرجاء إدخال اسم المستخدم وكلمة المرور';
    return;
  }

  loading.value = true;
  try {
    await auth.login(form.identifier, form.password);
    toast.success('مرحباً بك في لوحة إدارة المنصة');
    router.push('/');
  } catch (err) {
    // auth.login() throws its own clear message when the account is real
    // but not a platform admin (backend/middleware/requirePlatformAdmin.js
    // is the actual enforcement — this is just the matching UI message).
    errorMessage.value = err.response?.data?.message || err.message || 'حدث خطأ أثناء تسجيل الدخول';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="card p-8">
      <div class="text-center mb-6">
        <div class="w-14 h-14 rounded-2xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3">م</div>
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">إدارة المنصة</h1>
        <p class="text-sm text-slate-400 mt-1">تسجيل الدخول مخصص لمدير المنصة (Platform Admin) فقط</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="errorMessage" class="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {{ errorMessage }}
        </div>

        <div>
          <label class="label">اسم المستخدم أو البريد الإلكتروني</label>
          <input v-model="form.identifier" type="text" class="input" autocomplete="username" />
        </div>

        <div>
          <label class="label">كلمة المرور</label>
          <input v-model="form.password" type="password" class="input" autocomplete="current-password" />
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'جاري الدخول...' : 'تسجيل الدخول' }}
        </button>
      </form>
    </div>
  </AuthLayout>
</template>
