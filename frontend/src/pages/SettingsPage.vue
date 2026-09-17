<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import settingsService from '@/services/settingsService';
import warehouseService from '@/services/warehouseService';
import backupService from '@/services/backupService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';

const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();

const TABS = [
  { key: 'company', label: 'المؤسسة' },
  { key: 'system', label: 'النظام' },
  { key: 'inventory', label: 'المخزون' },
  { key: 'documents', label: 'ترقيم المستندات' },
  { key: 'barcode', label: 'الباركود' },
  { key: 'backup', label: 'النسخ الاحتياطي' },
];
const activeTab = ref('company');
const loading = ref(true);
const saving = ref(false);
const warehouses = ref([]);

const form = reactive({
  company: { name: '', logo: null, address: '', phone: '', email: '', taxNumber: '' },
  system: { currency: 'JOD', language: 'ar', timezone: 'Asia/Amman', dateFormat: 'DD/MM/YYYY' },
  inventory: { allowNegativeStock: false, defaultWarehouse: '', lowStockAlerts: true, costingMethod: 'WEIGHTED_AVERAGE' },
  documents: { prefixes: { stockIn: 'IN', stockOut: 'OUT', transfer: 'TRF', adjustment: 'ADJ', inventoryCount: 'INVCOUNT', purchaseOrder: 'PO', goodsReceipt: 'GRN' } },
  barcode: { labelWidthMm: 40, labelHeightMm: 25, showPrice: true },
  backup: { autoBackupEnabled: false, frequency: 'weekly' },
});

const backups = ref([]);
const backupsLoading = ref(true);
const backingUp = ref(false);
const isSuperAdmin = computed(() => auth.isSuperAdmin);

// ✅ شعار المؤسسة — يُرفع/يُحذف فوراً عبر endpoint مستقل (multipart)،
// منفصل عن حفظ باقي حقول tab "المؤسسة" النصية (JSON عبر saveTab)
const uploadingLogo = ref(false);
const logoLocalPreview = ref(null); // معاينة فورية قبل اكتمال الرفع
const logoLoadFailed = ref(false);
const displayedLogoUrl = computed(() =>
  logoLocalPreview.value ? logoLocalPreview.value : resolveAssetUrl(form.company.logo)
);

async function onLogoSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  logoLoadFailed.value = false;
  logoLocalPreview.value = URL.createObjectURL(file);
  uploadingLogo.value = true;
  try {
    const { data } = await settingsService.uploadLogo(file);
    form.company.logo = data.data.logo;
    toast.success('تم رفع شعار المؤسسة بنجاح');
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر رفع الشعار');
  } finally {
    uploadingLogo.value = false;
    logoLocalPreview.value = null;
    e.target.value = '';
  }
}

async function removeLogo() {
  const ok = await confirm({ title: 'حذف الشعار', message: 'هل تريد حذف شعار المؤسسة؟', confirmText: 'حذف', danger: true });
  if (!ok) return;
  try {
    await settingsService.deleteLogo();
    form.company.logo = null;
    toast.success('تم حذف الشعار');
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حذف الشعار');
  }
}

async function loadSettings() {
  loading.value = true;
  try {
    const { data } = await settingsService.get();
    const s = data.data;
    form.company = { ...form.company, ...s.company };
    form.system = { ...form.system, ...s.system };
    form.inventory = { ...form.inventory, ...s.inventory, defaultWarehouse: s.inventory.defaultWarehouse || '' };
    form.documents.prefixes = { ...form.documents.prefixes, ...s.documents.prefixes };
    form.barcode = { ...form.barcode, ...s.barcode };
    form.backup = { ...form.backup, autoBackupEnabled: s.backup.autoBackupEnabled, frequency: s.backup.frequency };
  } catch (err) {
    toast.error('تعذر تحميل الإعدادات');
  } finally {
    loading.value = false;
  }
}

async function saveTab(section) {
  saving.value = true;
  try {
    await settingsService.update({ [section]: form[section] });
    toast.success('تم حفظ الإعدادات بنجاح');
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حفظ الإعدادات');
  } finally {
    saving.value = false;
  }
}

async function loadBackups() {
  backupsLoading.value = true;
  try {
    const { data } = await backupService.list();
    backups.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل قائمة النسخ الاحتياطية');
  } finally {
    backupsLoading.value = false;
  }
}

async function createBackup() {
  backingUp.value = true;
  try {
    await backupService.create();
    toast.success('تم إنشاء نسخة احتياطية بنجاح');
    loadBackups();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إنشاء النسخة الاحتياطية');
  } finally {
    backingUp.value = false;
  }
}

async function restoreBackup(backup) {
  const ok = await confirm({
    title: 'استرجاع نسخة احتياطية',
    message: `تحذير: سيتم استبدال جميع بيانات النظام الحالية ببيانات النسخة الاحتياطية (${new Date(backup.createdAt).toLocaleString('ar')}) بشكل نهائي. هل أنت متأكد تماماً؟`,
    confirmText: 'استرجاع نهائياً',
    danger: true,
  });
  if (!ok) return;
  try {
    await backupService.restore(backup.id);
    toast.success('تم استرجاع النسخة الاحتياطية بنجاح، الرجاء إعادة تحميل الصفحة');
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر استرجاع النسخة الاحتياطية');
  }
}

async function deleteBackup(backup) {
  const ok = await confirm({ title: 'حذف النسخة الاحتياطية', message: 'هل تريد حذف هذه النسخة الاحتياطية نهائياً؟', confirmText: 'حذف', danger: true });
  if (!ok) return;
  try {
    await backupService.remove(backup.id);
    toast.success('تم حذف النسخة الاحتياطية');
    loadBackups();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حذف النسخة الاحتياطية');
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

onMounted(async () => {
  const { data } = await warehouseService.list();
  warehouses.value = data.data;
  await loadSettings();
  loadBackups();
});
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">الإعدادات</h1>

    <div class="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-1">
      <button
        v-for="tab in TABS" :key="tab.key"
        class="px-3 py-2 text-sm font-medium rounded-t-lg transition-colors"
        :class="activeTab === tab.key ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </div>

    <LoadingSpinner v-if="loading" />
    <template v-else>
      <!-- Company -->
      <div v-if="activeTab === 'company'" class="card p-6 max-w-2xl space-y-4">
        <div>
          <label class="label">شعار المؤسسة</label>
          <div class="flex items-center gap-4">
            <div class="w-20 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0">
              <img
                v-if="displayedLogoUrl && !logoLoadFailed"
                :src="displayedLogoUrl"
                class="w-full h-full object-contain"
                @error="logoLoadFailed = true"
              />
              <span v-else class="text-xs text-slate-400">لا يوجد</span>
            </div>
            <div class="flex flex-col gap-2">
              <label class="btn-outline cursor-pointer w-fit">
                {{ uploadingLogo ? 'جاري الرفع...' : (form.company.logo ? 'استبدال الشعار' : 'رفع شعار') }}
                <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" :disabled="uploadingLogo" @change="onLogoSelected" />
              </label>
              <button v-if="form.company.logo" class="text-xs text-red-600 hover:underline w-fit" type="button" @click="removeLogo">حذف الشعار</button>
              <p class="text-xs text-slate-400">PNG أو JPG أو WEBP، حتى 5 ميجابايت</p>
            </div>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="label">اسم المؤسسة</label><input v-model="form.company.name" class="input" /></div>
          <div><label class="label">الرقم الضريبي</label><input v-model="form.company.taxNumber" class="input" /></div>
          <div><label class="label">الهاتف</label><input v-model="form.company.phone" class="input" /></div>
          <div><label class="label">البريد الإلكتروني</label><input v-model="form.company.email" type="email" class="input" /></div>
        </div>
        <div><label class="label">العنوان</label><input v-model="form.company.address" class="input" /></div>
        <button class="btn-primary" :disabled="saving" @click="saveTab('company')">حفظ</button>
      </div>

      <!-- System -->
      <div v-if="activeTab === 'system'" class="card p-6 max-w-2xl space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="label">العملة</label><input v-model="form.system.currency" class="input" /></div>
          <div>
            <label class="label">اللغة</label>
            <select v-model="form.system.language" class="input"><option value="ar">العربية</option><option value="en">English</option></select>
          </div>
          <div><label class="label">المنطقة الزمنية</label><input v-model="form.system.timezone" class="input" /></div>
          <div>
            <label class="label">صيغة التاريخ</label>
            <select v-model="form.system.dateFormat" class="input">
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
        <button class="btn-primary" :disabled="saving" @click="saveTab('system')">حفظ</button>
      </div>

      <!-- Inventory -->
      <div v-if="activeTab === 'inventory'" class="card p-6 max-w-2xl space-y-4">
        <div class="flex items-center gap-2">
          <input id="allowNeg" v-model="form.inventory.allowNegativeStock" type="checkbox" class="rounded border-slate-300 text-primary-600" />
          <label for="allowNeg" class="text-sm text-slate-600 dark:text-slate-300">السماح بمخزون سالب (Allow Negative Stock)</label>
        </div>
        <div class="flex items-center gap-2">
          <input id="lowAlert" v-model="form.inventory.lowStockAlerts" type="checkbox" class="rounded border-slate-300 text-primary-600" />
          <label for="lowAlert" class="text-sm text-slate-600 dark:text-slate-300">تفعيل تنبيهات المخزون المنخفض</label>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="label">المخزن الافتراضي</label>
            <select v-model="form.inventory.defaultWarehouse" class="input">
              <option value="">بدون تحديد</option>
              <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
            </select>
          </div>
          <div>
            <label class="label">طريقة التكلفة</label>
            <select v-model="form.inventory.costingMethod" class="input" disabled>
              <option value="WEIGHTED_AVERAGE">المتوسط المرجح (Weighted Average)</option>
            </select>
          </div>
        </div>
        <button class="btn-primary" :disabled="saving" @click="saveTab('inventory')">حفظ</button>
      </div>

      <!-- Documents -->
      <div v-if="activeTab === 'documents'" class="card p-6 max-w-2xl space-y-4">
        <p class="text-sm text-slate-400">بادئة رقم المستند (مثال: IN-2026-000001)</p>
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="label">إدخال بضاعة</label><input v-model="form.documents.prefixes.stockIn" class="input" /></div>
          <div><label class="label">إخراج بضاعة</label><input v-model="form.documents.prefixes.stockOut" class="input" /></div>
          <div><label class="label">نقل مخزون</label><input v-model="form.documents.prefixes.transfer" class="input" /></div>
          <div><label class="label">تسوية</label><input v-model="form.documents.prefixes.adjustment" class="input" /></div>
          <div><label class="label">جرد</label><input v-model="form.documents.prefixes.inventoryCount" class="input" /></div>
          <div><label class="label">طلب شراء</label><input v-model="form.documents.prefixes.purchaseOrder" class="input" /></div>
          <div><label class="label">استلام بضاعة</label><input v-model="form.documents.prefixes.goodsReceipt" class="input" /></div>
        </div>
        <button class="btn-primary" :disabled="saving" @click="saveTab('documents')">حفظ</button>
      </div>

      <!-- Barcode -->
      <div v-if="activeTab === 'barcode'" class="card p-6 max-w-2xl space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="label">عرض الملصق الافتراضي (مم)</label><input v-model.number="form.barcode.labelWidthMm" type="number" class="input" /></div>
          <div><label class="label">ارتفاع الملصق الافتراضي (مم)</label><input v-model.number="form.barcode.labelHeightMm" type="number" class="input" /></div>
        </div>
        <div class="flex items-center gap-2">
          <input id="showPriceDefault" v-model="form.barcode.showPrice" type="checkbox" class="rounded border-slate-300 text-primary-600" />
          <label for="showPriceDefault" class="text-sm text-slate-600 dark:text-slate-300">إظهار السعر افتراضياً على الملصقات</label>
        </div>
        <button class="btn-primary" :disabled="saving" @click="saveTab('barcode')">حفظ</button>
      </div>

      <!-- Backup -->
      <div v-if="activeTab === 'backup'" class="space-y-4">
        <div class="card p-6 max-w-2xl space-y-4">
          <div class="flex items-center gap-2">
            <input id="autoBackup" v-model="form.backup.autoBackupEnabled" type="checkbox" class="rounded border-slate-300 text-primary-600" />
            <label for="autoBackup" class="text-sm text-slate-600 dark:text-slate-300">تفعيل النسخ الاحتياطي التلقائي</label>
          </div>
          <div v-if="form.backup.autoBackupEnabled">
            <label class="label">التكرار</label>
            <select v-model="form.backup.frequency" class="input !w-auto">
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <button class="btn-primary" :disabled="saving" @click="saveTab('backup')">حفظ الإعدادات</button>
            <button class="btn-outline" :disabled="backingUp" @click="createBackup">{{ backingUp ? 'جاري الإنشاء...' : 'إنشاء نسخة احتياطية الآن' }}</button>
          </div>
        </div>

        <div class="card p-6">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">النسخ الاحتياطية المتوفرة</h3>
          <LoadingSpinner v-if="backupsLoading" />
          <EmptyState v-else-if="!backups.length" title="لا توجد نسخ احتياطية بعد" />
          <table v-else class="table-base">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الحجم</th><th>عدد السجلات</th><th></th></tr></thead>
            <tbody>
              <tr v-for="b in backups" :key="b.id">
                <td class="text-xs">{{ new Date(b.createdAt).toLocaleString('ar') }}</td>
                <td>{{ b.type === 'manual' ? 'يدوي' : 'تلقائي' }}</td>
                <td>{{ formatSize(b.sizeBytes) }}</td>
                <td>{{ b.collections.reduce((s, c) => s + c.count, 0) }}</td>
                <td>
                  <div class="flex items-center gap-2 justify-end">
                    <button v-if="isSuperAdmin" class="btn-outline !px-2 !py-1 text-xs text-red-600" @click="restoreBackup(b)">استرجاع</button>
                    <button v-if="isSuperAdmin" class="btn-outline !px-2 !py-1 text-xs" @click="deleteBackup(b)">حذف</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!isSuperAdmin" class="text-xs text-slate-400 mt-3">الاسترجاع والحذف متاحان لمدير النظام العام (Super Admin) فقط.</p>
        </div>
      </div>
    </template>
  </div>
</template>
