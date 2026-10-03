<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
});

const toast = useToast();
const loading = ref(true);

const PLAN_OPTIONS = ['FREE', 'TRIAL', 'MONTHLY', 'YEARLY', 'CUSTOM'];
const STATUS_OPTIONS = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED'];

const subForm = reactive({
  plan: 'FREE',
  subscriptionStatus: 'ACTIVE',
  trialEndsAt: '',
  subscriptionStartsAt: '',
  subscriptionEndsAt: '',
});
const savingSub = ref(false);
// What's actually enforced right now (backend services/subscriptionService.js),
// which subForm.subscriptionStatus above can disagree with — that field is
// just whatever was last typed into it; nothing keeps it in sync with dates
// actually passing. Shown read-only so this doesn't look like a second,
// editable status.
const effectiveStatus = ref(null);
const EFFECTIVE_LABELS = {
  ACTIVE: 'نشط', PAST_DUE: 'متأخر الدفع', EXPIRED: 'منتهي', TRIAL_EXPIRED: 'انتهت التجربة', SUSPENDED: 'معلّق',
};

const usage = ref({ users: 0, warehouses: 0, products: 0 });
const limitsForm = reactive({ maxUsers: '', maxWarehouses: '', maxProducts: '', maxStorageMB: '' });
const savingLimits = ref(false);

function toDateInput(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function load() {
  loading.value = true;
  try {
    const [{ data: sub }, { data: lim }] = await Promise.all([
      platformService.getSubscription(props.organizationId),
      platformService.getLimits(props.organizationId),
    ]);
    Object.assign(subForm, {
      plan: sub.data.plan,
      subscriptionStatus: sub.data.subscriptionStatus,
      trialEndsAt: toDateInput(sub.data.trialEndsAt),
      subscriptionStartsAt: toDateInput(sub.data.subscriptionStartsAt),
      subscriptionEndsAt: toDateInput(sub.data.subscriptionEndsAt),
    });
    effectiveStatus.value = sub.data.effectiveStatus;
    usage.value = lim.data.usage;
    limitsForm.maxUsers = lim.data.limits.maxUsers ?? '';
    limitsForm.maxWarehouses = lim.data.limits.maxWarehouses ?? '';
    limitsForm.maxProducts = lim.data.limits.maxProducts ?? '';
    limitsForm.maxStorageMB = lim.data.limits.maxStorageMB ?? '';
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل بيانات الاشتراك');
  } finally {
    loading.value = false;
  }
}

async function saveSubscription() {
  savingSub.value = true;
  try {
    const { data } = await platformService.updateSubscription(props.organizationId, {
      plan: subForm.plan,
      subscriptionStatus: subForm.subscriptionStatus,
      trialEndsAt: subForm.trialEndsAt || null,
      subscriptionStartsAt: subForm.subscriptionStartsAt || null,
      subscriptionEndsAt: subForm.subscriptionEndsAt || null,
    });
    effectiveStatus.value = data.data.effectiveStatus;
    toast.success('تم تحديث بيانات الاشتراك');
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    savingSub.value = false;
  }
}

async function saveLimits() {
  savingLimits.value = true;
  try {
    const { data } = await platformService.updateLimits(props.organizationId, {
      maxUsers: numOrNull(limitsForm.maxUsers),
      maxWarehouses: numOrNull(limitsForm.maxWarehouses),
      maxProducts: numOrNull(limitsForm.maxProducts),
      maxStorageMB: numOrNull(limitsForm.maxStorageMB),
    });
    usage.value = data.data.usage;
    toast.success('تم تحديث حدود المؤسسة');
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  } finally {
    savingLimits.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <div v-else class="grid gap-4 lg:grid-cols-2">
      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الاشتراك</h3>
        <div class="space-y-3">
          <div v-if="effectiveStatus" class="flex items-center gap-2 text-xs">
            <span class="text-slate-400">الحالة الفعلية المطبّقة الآن:</span>
            <span
              class="px-2 py-0.5 rounded-full font-medium"
              :class="['EXPIRED', 'TRIAL_EXPIRED', 'SUSPENDED'].includes(effectiveStatus)
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'"
            >{{ EFFECTIVE_LABELS[effectiveStatus] || effectiveStatus }}</span>
          </div>
          <div>
            <label class="label">الخطة</label>
            <select v-model="subForm.plan" class="input">
              <option v-for="p in PLAN_OPTIONS" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div>
            <label class="label">حالة الاشتراك</label>
            <select v-model="subForm.subscriptionStatus" class="input">
              <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="label">بداية الاشتراك</label>
              <input v-model="subForm.subscriptionStartsAt" type="date" class="input" />
            </div>
            <div>
              <label class="label">نهاية الاشتراك</label>
              <input v-model="subForm.subscriptionEndsAt" type="date" class="input" :disabled="subForm.plan === 'FREE'" />
            </div>
            <div>
              <label class="label">نهاية التجربة</label>
              <input v-model="subForm.trialEndsAt" type="date" class="input" />
            </div>
          </div>
          <p v-if="subForm.plan === 'FREE'" class="text-xs text-amber-600 dark:text-amber-400">
            الخطة المجانية دائمة ولا تنتهي — يتم تجاهل تاريخ نهاية الاشتراك بغض النظر عن قيمته.
          </p>
          <button class="btn-primary" :disabled="savingSub" @click="saveSubscription">
            {{ savingSub ? 'جارٍ الحفظ...' : 'حفظ بيانات الاشتراك' }}
          </button>
          <p class="text-xs text-slate-400">هذه بيانات وصفية فقط لأغراض الإدارة، ولا ترتبط بأي بوابة دفع.</p>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الحدود (اتركها فارغة لعدم التحديد)</h3>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">أقصى عدد مستخدمين (الحالي: {{ usage.users }})</label>
              <input v-model="limitsForm.maxUsers" type="number" min="0" class="input" />
            </div>
            <div>
              <label class="label">أقصى عدد مخازن (الحالي: {{ usage.warehouses }})</label>
              <input v-model="limitsForm.maxWarehouses" type="number" min="0" class="input" />
            </div>
            <div>
              <label class="label">أقصى عدد أصناف (الحالي: {{ usage.products }})</label>
              <input v-model="limitsForm.maxProducts" type="number" min="0" class="input" />
            </div>
            <div>
              <label class="label">أقصى مساحة تخزين (MB)</label>
              <input v-model="limitsForm.maxStorageMB" type="number" min="0" class="input" />
            </div>
          </div>
          <button class="btn-primary" :disabled="savingLimits" @click="saveLimits">
            {{ savingLimits ? 'جارٍ الحفظ...' : 'حفظ الحدود' }}
          </button>
          <p class="text-xs text-slate-400">خفض الحد لا يحذف أي بيانات موجودة، بل يمنع فقط إنشاء عناصر جديدة تتجاوز الحد.</p>
        </div>
      </div>
    </div>
  </div>
</template>
