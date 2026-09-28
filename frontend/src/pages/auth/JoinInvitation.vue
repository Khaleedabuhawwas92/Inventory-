<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';
import authService from '@/services/authService';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();

const code = ref(route.params.code || route.query.code || '');
const checking = ref(false);
const invitation = ref(null);
const invalidCode = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });

async function checkCode() {
  if (!code.value.trim()) return;
  checking.value = true;
  invalidCode.value = false;
  invitation.value = null;
  try {
    const { data } = await authService.invitationInfo(code.value.trim());
    invitation.value = data.data;
    if (invitation.value.email) form.email = invitation.value.email;
  } catch (err) {
    invalidCode.value = true;
  } finally {
    checking.value = false;
  }
}

onMounted(checkCode);

async function handleSubmit() {
  errorMessage.value = '';
  if (!form.fullName || !form.username || !form.email || !form.password) {
    errorMessage.value = 'جميع الحقول مطلوبة';
    return;
  }
  if (form.password.length < 8) {
    errorMessage.value = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    return;
  }
  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'كلمتا المرور غير متطابقتين';
    return;
  }

  loading.value = true;
  try {
    await auth.joinByInvitation({
      code: code.value.trim(),
      fullName: form.fullName,
      username: form.username,
      email: form.email,
      password: form.password,
    });
    toast.success('تم الانضمام بنجاح، مرحباً بك');
    router.push({ name: 'dashboard' });
  } catch (err) {
    errorMessage.value = err.response?.data?.message || 'حدث خطأ أثناء الانضمام';
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
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">الانضمام عبر دعوة</h1>
      </div>

      <div v-if="!invitation" class="space-y-3">
        <div>
          <label class="label">رمز الدعوة *</label>
          <input v-model="code" class="input" placeholder="الصق رمز الدعوة هنا" @keyup.enter="checkCode" />
        </div>
        <p v-if="invalidCode" class="text-sm text-red-600">رابط الدعوة غير صالح أو منتهي الصلاحية</p>
        <button type="button" class="btn-primary w-full" :disabled="checking" @click="checkCode">
          {{ checking ? 'جاري التحقق...' : 'التحقق من الدعوة' }}
        </button>
      </div>

      <template v-else>
        <p class="text-sm text-center text-slate-500 dark:text-slate-400 mb-4">
          أنت على وشك الانضمام إلى <strong>{{ invitation.organizationName }}</strong> بدور <strong>{{ invitation.roleName }}</strong>
        </p>

        <form class="space-y-3" @submit.prevent="handleSubmit">
          <div v-if="errorMessage" class="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
            {{ errorMessage }}
          </div>

          <div>
            <label class="label">الاسم الكامل *</label>
            <input v-model="form.fullName" class="input" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">اسم المستخدم *</label>
              <input v-model="form.username" class="input" />
            </div>
            <div>
              <label class="label">البريد الإلكتروني *</label>
              <input v-model="form.email" type="email" class="input" :disabled="!!invitation.email" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">كلمة المرور *</label>
              <input v-model="form.password" type="password" class="input" />
            </div>
            <div>
              <label class="label">تأكيد كلمة المرور *</label>
              <input v-model="form.confirmPassword" type="password" class="input" />
            </div>
          </div>

          <button type="submit" class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'جاري الانضمام...' : 'انضمام' }}
          </button>
        </form>
      </template>

      <p class="text-center text-sm text-slate-400 mt-4">
        <router-link to="/login" class="text-primary-600 hover:underline">تسجيل الدخول</router-link>
        ·
        <router-link to="/register" class="text-primary-600 hover:underline">تسجيل مؤسسة جديدة</router-link>
      </p>
    </div>
  </AuthLayout>
</template>
