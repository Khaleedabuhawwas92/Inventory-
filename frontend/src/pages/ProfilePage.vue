<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import authService from '@/services/authService';

const toast = useToast();
const auth = useAuthStore();
const ui = useUiStore();

const saving = ref(false);
const changingPassword = ref(false);
const avatarPreview = ref(null);
const avatarFile = ref(null);

const form = reactive({ fullName: '', phone: '' });
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });

function populateForm() {
  form.fullName = auth.user?.fullName || '';
  form.phone = auth.user?.phone || '';
  avatarPreview.value = auth.user?.profileImage || null;
}

function onAvatarSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  avatarFile.value = file;
  avatarPreview.value = URL.createObjectURL(file);
}

async function saveProfile() {
  saving.value = true;
  try {
    if (avatarFile.value) {
      await authService.uploadAvatar(avatarFile.value);
    }
    const { data } = await authService.updateMe({ fullName: form.fullName, phone: form.phone });
    auth.setSession({ user: data.data.user });
    toast.success('تم تحديث الملف الشخصي بنجاح');
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحديث الملف الشخصي');
  } finally {
    saving.value = false;
  }
}

async function submitPasswordChange() {
  if (passwordForm.newPassword.length < 8) return toast.error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
  if (passwordForm.newPassword !== passwordForm.confirmPassword) return toast.error('كلمتا المرور غير متطابقتين');

  changingPassword.value = true;
  try {
    await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
    toast.success('تم تغيير كلمة المرور، الرجاء تسجيل الدخول مجدداً');
    await auth.logout();
    window.location.href = '/login';
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تغيير كلمة المرور');
  } finally {
    changingPassword.value = false;
  }
}

async function setTheme(theme) {
  ui.setTheme(theme);
  try {
    await authService.updateMe({ theme });
  } catch (err) {
    // Non-critical — the theme still applies locally even if persisting it fails.
  }
}

onMounted(populateForm);
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">الملف الشخصي</h1>

    <div class="grid lg:grid-cols-2 gap-4 max-w-4xl">
      <div class="card p-6">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-4">البيانات الأساسية</h3>
        <div class="flex items-center gap-4 mb-4">
          <img v-if="avatarPreview" :src="avatarPreview" class="w-16 h-16 rounded-full object-cover border border-slate-200 dark:border-slate-600" />
          <div v-else class="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xl font-bold">
            {{ (auth.fullName || 'م')[0] }}
          </div>
          <label class="btn-outline cursor-pointer text-sm">
            تغيير الصورة
            <input type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
          </label>
        </div>

        <div class="space-y-3">
          <div><label class="label">الاسم الكامل</label><input v-model="form.fullName" class="input" /></div>
          <div><label class="label">اسم المستخدم</label><input :value="auth.user?.username" class="input" disabled /></div>
          <div><label class="label">البريد الإلكتروني</label><input :value="auth.user?.email" class="input" disabled /></div>
          <div><label class="label">الهاتف</label><input v-model="form.phone" class="input" /></div>
          <div><label class="label">الدور</label><input :value="auth.roleLabel" class="input" disabled /></div>
        </div>
        <button class="btn-primary mt-4" :disabled="saving" @click="saveProfile">{{ saving ? 'جاري الحفظ...' : 'حفظ التغييرات' }}</button>
      </div>

      <div class="space-y-4">
        <div class="card p-6">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-4">تغيير كلمة المرور</h3>
          <div class="space-y-3">
            <div><label class="label">كلمة المرور الحالية</label><input v-model="passwordForm.currentPassword" type="password" class="input" /></div>
            <div><label class="label">كلمة المرور الجديدة</label><input v-model="passwordForm.newPassword" type="password" class="input" /></div>
            <div><label class="label">تأكيد كلمة المرور</label><input v-model="passwordForm.confirmPassword" type="password" class="input" /></div>
          </div>
          <button class="btn-primary mt-4" :disabled="changingPassword" @click="submitPasswordChange">
            {{ changingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور' }}
          </button>
        </div>

        <div class="card p-6">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-4">المظهر واللغة</h3>
          <div class="flex items-center gap-3 mb-4">
            <button class="btn-outline flex-1" :class="{ '!bg-primary-600 !text-white': ui.theme === 'light' }" @click="setTheme('light')">فاتح</button>
            <button class="btn-outline flex-1" :class="{ '!bg-primary-600 !text-white': ui.theme === 'dark' }" @click="setTheme('dark')">داكن</button>
          </div>
          <div>
            <label class="label">اللغة</label>
            <select class="input" disabled><option>العربية</option></select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
