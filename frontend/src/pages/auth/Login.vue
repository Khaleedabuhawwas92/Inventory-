<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';
import settingsService from '@/services/settingsService';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const form = reactive({
  identifier: '',
  password: '',
  remember: true,
});
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const companyName = ref('نظام إدارة المخزون');
const companyLogo = ref(null);
const logoLoadFailed = ref(false);

onMounted(async () => {
  try {
    const { data } = await settingsService.publicInfo();
    if (data.data.company.name) companyName.value = data.data.company.name;
    companyLogo.value = data.data.company.logo;
  } catch (err) {
    // Keep default branding if settings can't be fetched yet.
  }
});

async function handleSubmit() {
  errorMessage.value = '';
  if (!form.identifier || !form.password) {
    errorMessage.value = 'الرجاء إدخال اسم المستخدم وكلمة المرور';
    return;
  }

  loading.value = true;
  try {
    await auth.login(form.identifier, form.password);
    toast.success('مرحباً بك مجدداً');
    router.push(route.query.redirect || { name: 'dashboard' });
  } catch (err) {
    errorMessage.value = err.response?.data?.message || 'حدث خطأ أثناء تسجيل الدخول';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="card p-8">
      <div class="text-center mb-6">
        <img
          v-if="companyLogo && !logoLoadFailed"
          :src="resolveAssetUrl(companyLogo)"
          class="w-14 h-14 rounded-2xl mx-auto mb-3 object-cover"
          @error="logoLoadFailed = true"
        />
        <div v-else class="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3">م</div>
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ companyName }}</h1>
        <p class="text-sm text-slate-400 mt-1">تسجيل الدخول إلى نظام إدارة المخزون</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="errorMessage" class="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {{ errorMessage }}
        </div>

        <div>
          <label class="label">اسم المستخدم أو البريد الإلكتروني</label>
          <input v-model="form.identifier" type="text" class="input" placeholder="مثال: admin" autocomplete="username" />
        </div>

        <div>
          <label class="label">كلمة المرور</label>
          <div class="relative">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              class="input !pl-10"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              @click="showPassword = !showPassword"
            >
              <svg v-if="showPassword" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-sm">
          <label class="flex items-center gap-2 text-slate-500 dark:text-slate-400 cursor-pointer">
            <input v-model="form.remember" type="checkbox" class="rounded border-slate-300 text-primary-600 focus:ring-primary-400" />
            تذكرني
          </label>
          <router-link to="/forgot-password" class="text-primary-600 hover:underline">نسيت كلمة المرور؟</router-link>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'جاري الدخول...' : 'تسجيل الدخول' }}
        </button>
      </form>
    </div>
  </AuthLayout>
</template>
