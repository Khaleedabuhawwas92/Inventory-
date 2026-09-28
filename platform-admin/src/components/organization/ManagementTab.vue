<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
  organization: { type: Object, required: true },
  company: { type: Object, default: null },
  owner: { type: Object, default: null },
});

const emit = defineEmits(['refresh']);

const toast = useToast();
const confirm = useConfirm();

const infoForm = reactive({
  name: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
  country: '',
  logo: '',
});
const savingInfo = ref(false);

const activeUsers = ref([]);
const loadingUsers = ref(true);
const newOwnerId = ref('');
const transferring = ref(false);

const statusForm = reactive({ status: 'active', reason: '' });
const savingStatus = ref(false);

const revokeReason = ref('');
const revoking = ref(false);

const STATUS_OPTIONS = [
  { value: 'active', label: 'نشطة' },
  { value: 'suspended', label: 'معلّقة' },
  { value: 'disabled', label: 'معطّلة' },
  { value: 'trial_expired', label: 'انتهت الفترة التجريبية' },
];

function resetForms() {
  infoForm.name = props.organization.name || '';
  infoForm.phone = props.company?.phone || '';
  infoForm.email = props.company?.email || '';
  infoForm.address = props.company?.address || '';
  infoForm.taxNumber = props.company?.taxNumber || '';
  infoForm.country = props.company?.country || '';
  infoForm.logo = props.company?.logo || '';
  statusForm.status = props.organization.status || 'active';
  statusForm.reason = '';
}

async function loadActiveUsers() {
  loadingUsers.value = true;
  try {
    const { data } = await platformService.organizationUsers(props.organizationId, { status: 'active', limit: 100 });
    activeUsers.value = data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل قائمة المستخدمين');
  } finally {
    loadingUsers.value = false;
  }
}

async function saveInfo() {
  if (!infoForm.name.trim()) {
    toast.error('اسم المؤسسة مطلوب');
    return;
  }
  savingInfo.value = true;
  try {
    await platformService.updateOrganizationInfo(props.organizationId, { ...infoForm });
    toast.success('تم تحديث بيانات المؤسسة');
    emit('refresh');
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    savingInfo.value = false;
  }
}

async function transferOwnership() {
  if (!newOwnerId.value) {
    toast.error('يجب اختيار مستخدم');
    return;
  }
  const target = activeUsers.value.find((u) => u._id === newOwnerId.value);
  const ok = await confirm({
    title: 'نقل ملكية المؤسسة',
    message: `سيتم نقل ملكية هذه المؤسسة إلى "${target?.fullName}". هذا الإجراء يمكن التراجع عنه لاحقاً بنقل الملكية مجدداً.`,
    confirmText: 'نقل الملكية',
    danger: true,
  });
  if (!ok) return;
  transferring.value = true;
  try {
    await platformService.transferOwnership(props.organizationId, newOwnerId.value);
    toast.success('تم نقل ملكية المؤسسة بنجاح');
    newOwnerId.value = '';
    emit('refresh');
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    transferring.value = false;
  }
}

async function saveStatus() {
  if (statusForm.status !== 'active' && !statusForm.reason.trim()) {
    toast.error('يجب إدخال سبب عند تعليق أو تعطيل المؤسسة');
    return;
  }
  const ok = await confirm({
    title: 'تغيير حالة المؤسسة',
    message: 'بيانات المؤسسة تبقى محفوظة بالكامل ولا يتم حذف أي شيء عند تغيير الحالة.',
    confirmText: 'تأكيد',
    danger: statusForm.status !== 'active',
  });
  if (!ok) return;
  savingStatus.value = true;
  try {
    await platformService.setOrganizationStatus(props.organizationId, statusForm.status, statusForm.reason.trim() || undefined);
    toast.success('تم تحديث حالة المؤسسة');
    emit('refresh');
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    savingStatus.value = false;
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
    toast.success(`تم تسجيل خروج ${data.data.usersAffected} مستخدم`);
    revokeReason.value = '';
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    revoking.value = false;
  }
}

onMounted(() => {
  resetForms();
  loadActiveUsers();
});
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <!-- Company info -->
    <div class="card p-4">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">بيانات الشركة</h3>
      <div class="space-y-3">
        <div>
          <label class="label">اسم المؤسسة</label>
          <input v-model="infoForm.name" type="text" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الهاتف</label>
            <input v-model="infoForm.phone" type="text" class="input" />
          </div>
          <div>
            <label class="label">البريد الإلكتروني</label>
            <input v-model="infoForm.email" type="email" class="input" />
          </div>
        </div>
        <div>
          <label class="label">العنوان</label>
          <input v-model="infoForm.address" type="text" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">الرقم الضريبي</label>
            <input v-model="infoForm.taxNumber" type="text" class="input" />
          </div>
          <div>
            <label class="label">الدولة</label>
            <input v-model="infoForm.country" type="text" class="input" />
          </div>
        </div>
        <div>
          <label class="label">رابط الشعار (Logo URL)</label>
          <input v-model="infoForm.logo" type="text" class="input" placeholder="https://..." />
        </div>
        <button class="btn-primary" :disabled="savingInfo" @click="saveInfo">
          {{ savingInfo ? 'جارٍ الحفظ...' : 'حفظ بيانات المؤسسة' }}
        </button>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Owner transfer -->
      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">نقل ملكية المؤسسة</h3>
        <p class="text-xs text-slate-400 mb-3">
          المالك الحالي: <span class="font-medium text-slate-600 dark:text-slate-300">{{ owner?.fullName || '—' }} ({{ owner?.username || '—' }})</span>
        </p>
        <LoadingSpinner v-if="loadingUsers" />
        <template v-else>
          <select v-model="newOwnerId" class="input mb-3">
            <option value="" disabled>اختر مستخدماً نشطاً من هذه المؤسسة</option>
            <option v-for="u in activeUsers" :key="u._id" :value="u._id">{{ u.fullName }} ({{ u.username }})</option>
          </select>
          <button class="btn-outline" :disabled="transferring || !newOwnerId" @click="transferOwnership">
            {{ transferring ? 'جارٍ النقل...' : 'نقل الملكية' }}
          </button>
        </template>
      </div>

      <!-- Status -->
      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">حالة المؤسسة</h3>
        <div class="space-y-3">
          <select v-model="statusForm.status" class="input">
            <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <textarea
            v-if="statusForm.status !== 'active'"
            v-model="statusForm.reason"
            class="input"
            rows="2"
            placeholder="سبب التعليق أو التعطيل (مطلوب)"
          ></textarea>
          <button class="btn-outline text-red-600" :disabled="savingStatus" @click="saveStatus">
            {{ savingStatus ? 'جارٍ الحفظ...' : 'تطبيق الحالة' }}
          </button>
        </div>
      </div>

      <!-- Org-wide session revoke -->
      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">تسجيل خروج جميع مستخدمي المؤسسة</h3>
        <p class="text-xs text-slate-400 mb-3">ينهي جميع الجلسات النشطة فوراً. لا يتم تغيير أي كلمة مرور.</p>
        <textarea v-model="revokeReason" class="input mb-3" rows="2" placeholder="سبب (اختياري)"></textarea>
        <button class="btn-outline text-red-600" :disabled="revoking" @click="revokeAllSessions">
          {{ revoking ? 'جارٍ التنفيذ...' : 'تسجيل خروج الجميع' }}
        </button>
      </div>
    </div>
  </div>
</template>
