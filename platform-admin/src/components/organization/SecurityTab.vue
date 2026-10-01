<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
  organization: { type: Object, required: true },
});

const toast = useToast();
const confirm = useConfirm();

const loading = ref(true);
const disabledUsers = ref([]);
const failedLogins = ref([]);
const passwordResets = ref([]);
const revokeReason = ref('');
const revoking = ref(false);

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load() {
  loading.value = true;
  try {
    const [{ data: disabled }, { data: failed }, { data: resets }] = await Promise.all([
      platformService.organizationUsers(props.organizationId, { status: 'disabled', limit: 20 }),
      platformService.organizationAudit(props.organizationId, { action: 'LOGIN_FAILED', limit: 20 }),
      platformService.organizationAudit(props.organizationId, { action: 'PASSWORD_RESET', limit: 20 }),
    ]);
    disabledUsers.value = disabled.data;
    failedLogins.value = failed.data;
    passwordResets.value = resets.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل بيانات الأمان');
  } finally {
    loading.value = false;
  }
}

async function revokeAllSessions() {
  const ok = await confirm({
    title: 'تسجيل خروج جميع مستخدمي المؤسسة',
    message: 'سيتم إنهاء جميع الجلسات النشطة لكل مستخدمي هذه المؤسسة فوراً. لن يتم تغيير أي كلمة مرور.',
    confirmText: 'تسجيل الخروج للجميع',
    danger: true,
  });
  if (!ok) return;
  revoking.value = true;
  try {
    const { data } = await platformService.revokeOrganizationSessions(props.organizationId, revokeReason.value.trim() || undefined);
    const note = data.data.selfExcluded ? ' (باستثناء جلستك الحالية كمدير منصة)' : '';
    toast.success(`تم تسجيل خروج ${data.data.usersAffected} مستخدم${note}`);
    revokeReason.value = '';
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    revoking.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <div v-else class="space-y-4">
      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">حالة المؤسسة</h3>
        <dl class="text-sm grid sm:grid-cols-2 gap-2">
          <div class="flex justify-between"><dt class="text-slate-400">الحالة</dt><dd>{{ organization.status }}</dd></div>
          <div v-if="organization.suspensionReason" class="flex justify-between">
            <dt class="text-slate-400">سبب التعليق/التعطيل</dt><dd>{{ organization.suspensionReason }}</dd>
          </div>
          <div v-if="organization.suspendedAt" class="flex justify-between">
            <dt class="text-slate-400">تاريخ التعليق/التعطيل</dt><dd>{{ fmtDate(organization.suspendedAt) }}</dd>
          </div>
        </dl>
      </div>

      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">تسجيل خروج جميع مستخدمي المؤسسة</h3>
        <p class="text-xs text-slate-400 mb-3">ينهي جميع الجلسات النشطة فوراً. لا يتم تغيير أي كلمة مرور.</p>
        <div class="flex flex-wrap gap-3 items-start">
          <input v-model="revokeReason" type="text" class="input flex-1 min-w-[200px]" placeholder="سبب (اختياري)" />
          <button class="btn-outline text-red-600 whitespace-nowrap" :disabled="revoking" @click="revokeAllSessions">
            {{ revoking ? 'جارٍ التنفيذ...' : 'تسجيل خروج الجميع' }}
          </button>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">المستخدمون المعطّلون ({{ disabledUsers.length }})</h3>
        <EmptyState v-if="!disabledUsers.length" title="لا يوجد مستخدمون معطّلون" />
        <ul v-else class="text-sm divide-y divide-slate-100 dark:divide-slate-700">
          <li v-for="u in disabledUsers" :key="u._id" class="py-2 flex justify-between">
            <span>{{ u.fullName }} ({{ u.username }})</span>
            <span class="text-xs text-slate-400">{{ fmtDate(u.updatedAt) }}</span>
          </li>
        </ul>
      </div>

      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">محاولات دخول فاشلة أخيرة</h3>
        <EmptyState v-if="!failedLogins.length" title="لا توجد محاولات فاشلة" />
        <ul v-else class="text-sm divide-y divide-slate-100 dark:divide-slate-700">
          <li v-for="log in failedLogins" :key="log._id" class="py-2 flex justify-between">
            <span>{{ log.description }}</span>
            <span class="text-xs text-slate-400">{{ fmtDate(log.createdAt) }}</span>
          </li>
        </ul>
      </div>

      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">عمليات إعادة تعيين كلمة المرور الأخيرة</h3>
        <EmptyState v-if="!passwordResets.length" title="لا توجد عمليات إعادة تعيين" />
        <ul v-else class="text-sm divide-y divide-slate-100 dark:divide-slate-700">
          <li v-for="log in passwordResets" :key="log._id" class="py-2 flex justify-between">
            <span>{{ log.description }}</span>
            <span class="text-xs text-slate-400">{{ fmtDate(log.createdAt) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
