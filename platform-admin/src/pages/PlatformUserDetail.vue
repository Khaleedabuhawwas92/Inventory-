<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Modal from '@/components/ui/Modal.vue';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();

const loading = ref(true);
const data = ref(null);
const generatedPassword = ref('');
const passwordModalOpen = ref(false);

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load() {
  loading.value = true;
  try {
    const { data: res } = await platformService.user(route.params.id);
    data.value = res.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل بيانات المستخدم');
  } finally {
    loading.value = false;
  }
}

async function toggleStatus() {
  const user = data.value.user;
  const disabling = user.status === 'active';
  const ok = await confirm({
    title: disabling ? 'تعطيل المستخدم' : 'تفعيل المستخدم',
    message: `هل أنت متأكد من ${disabling ? 'تعطيل' : 'تفعيل'} حساب "${user.fullName}"؟`,
    confirmText: disabling ? 'تعطيل' : 'تفعيل',
    danger: disabling,
  });
  if (!ok) return;
  try {
    await platformService.setUserStatus(user._id, disabling ? 'disabled' : 'active');
    toast.success(disabling ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

async function forceResetPassword() {
  const ok = await confirm({
    title: 'إعادة تعيين كلمة المرور',
    message: 'سيتم إنشاء كلمة مرور مؤقتة جديدة لهذا المستخدم، وسيُطلب منه تغييرها عند الدخول التالي. تأكد من مشاركتها معه عبر قناة آمنة.',
    confirmText: 'إعادة التعيين',
    danger: true,
  });
  if (!ok) return;
  try {
    const { data: res } = await platformService.resetUserPassword(data.value.user._id);
    generatedPassword.value = res.data.temporaryPassword;
    passwordModalOpen.value = true;
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="data">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold">
            {{ (data.user.fullName || 'م')[0] }}
          </div>
          <div>
            <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">{{ data.user.fullName }}</h1>
            <p class="text-xs text-slate-400">{{ data.user.username }} · {{ data.user.email }}</p>
          </div>
          <StatusBadge :status="data.user.status" />
        </div>
        <div class="flex gap-2">
          <button class="btn-outline !px-3 !py-1.5 text-xs" @click="forceResetPassword">إعادة تعيين كلمة المرور</button>
          <button
            class="btn-outline !px-3 !py-1.5 text-xs"
            :class="data.user.status === 'active' ? 'text-red-600' : 'text-green-600'"
            @click="toggleStatus"
          >
            {{ data.user.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب' }}
          </button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2 mb-6">
        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">بيانات الحساب</h3>
          <dl class="text-sm space-y-2">
            <div class="flex justify-between"><dt class="text-slate-400">المؤسسة</dt><dd><router-link v-if="data.user.organizationId" :to="`/organizations/${data.user.organizationId._id}`" class="text-primary-600 hover:underline">{{ data.user.organizationId.name }}</router-link></dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الدور</dt><dd>{{ data.user.role?.nameAr }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">المخزن المخصص</dt><dd>{{ data.user.warehouse?.name || '—' }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الهاتف</dt><dd>{{ data.user.phone || '—' }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">تاريخ الإنشاء</dt><dd>{{ fmtDate(data.user.createdAt) }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">آخر دخول</dt><dd>{{ fmtDate(data.user.lastLogin) }}</dd></div>
          </dl>
        </div>

        <div class="card p-4">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الجلسات (سجل تسجيل الدخول)</h3>
          <ul class="space-y-2 max-h-60 overflow-y-auto text-sm">
            <li v-for="s in data.sessions" :key="s._id" class="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
              <span class="text-slate-500 dark:text-slate-400">{{ s.ip || '—' }} · {{ s.userAgent?.slice(0, 40) || '—' }}</span>
              <span class="text-xs" :class="s.revoked ? 'text-slate-400' : 'text-green-600'">{{ fmtDate(s.createdAt) }}</span>
            </li>
            <li v-if="!data.sessions.length" class="text-slate-400">لا توجد جلسات مسجلة</li>
          </ul>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">سجل النشاط الأخير</h3>
        <ul class="space-y-2 max-h-96 overflow-y-auto">
          <li v-for="log in data.recentActivity" :key="log._id" class="text-sm border-b border-slate-100 dark:border-slate-700 pb-2">
            <p class="text-slate-700 dark:text-slate-200">{{ log.description }}</p>
            <p class="text-xs text-slate-400">{{ log.action }} · {{ fmtDate(log.createdAt) }}</p>
          </li>
          <li v-if="!data.recentActivity.length" class="text-sm text-slate-400">لا يوجد نشاط مسجل</li>
        </ul>
      </div>
    </template>

    <Modal v-model="passwordModalOpen" title="كلمة المرور المؤقتة" size="sm">
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">
        شارك كلمة المرور هذه مع المستخدم عبر قناة آمنة. لن تُعرض مرة أخرى، وسيُطلب منه تغييرها عند الدخول.
      </p>
      <input :value="generatedPassword" class="input font-mono" readonly />
      <template #footer>
        <button class="btn-primary" @click="passwordModalOpen = false">تم</button>
      </template>
    </Modal>
  </div>
</template>
