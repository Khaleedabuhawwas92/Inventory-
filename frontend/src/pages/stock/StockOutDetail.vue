<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import stockService from '@/services/stockService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { safePrint } from '@/utils/print';

const OUTPUT_TYPE_LABELS = {
  INTERNAL_USE: 'استخدام داخلي', SALE: 'بيع', DAMAGE: 'تالف', MAINTENANCE: 'صيانة', SAMPLE: 'عينة', OTHER: 'أخرى',
};

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();

const doc = ref(null);
const loading = ref(true);
const busy = ref(false);

async function load() {
  loading.value = true;
  try {
    const { data } = await stockService.getOut(route.params.id);
    doc.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل السند');
  } finally {
    loading.value = false;
  }
}

async function approveDoc() {
  const ok = await confirm({ title: 'اعتماد السند', message: 'سيتم تحديث المخزون فور الاعتماد. هل أنت متأكد؟', confirmText: 'اعتماد' });
  if (!ok) return;
  busy.value = true;
  try {
    await stockService.approveOut(doc.value._id);
    toast.success('تم اعتماد السند');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر اعتماد السند');
  } finally {
    busy.value = false;
  }
}

async function cancelDoc() {
  const ok = await confirm({ title: 'إلغاء السند', message: 'سيتم عكس أثر السند على المخزون. هل أنت متأكد؟', confirmText: 'إلغاء السند', danger: true });
  if (!ok) return;
  busy.value = true;
  try {
    await stockService.cancelOut(doc.value._id);
    toast.success('تم إلغاء السند');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إلغاء السند');
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="doc">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6 print:hidden">
        <div>
          <router-link to="/stock/out" class="text-sm text-primary-600 hover:underline">← سندات الإخراج</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">سند إخراج {{ doc.docNo }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="safePrint()">طباعة</button>
          <button v-if="doc.status === 'DRAFT' && auth.can('stock.out')" class="btn-primary" :disabled="busy" @click="approveDoc">اعتماد</button>
          <button v-if="doc.status !== 'CANCELLED' && auth.can('stock.out')" class="btn-danger" :disabled="busy" @click="cancelDoc">إلغاء</button>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <StatusBadge :status="doc.status" />
          <span class="text-sm text-slate-400">{{ new Date(doc.date).toLocaleDateString('ar') }}</span>
        </div>
        <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-6">
          <div><dt class="text-slate-400">المخزن</dt><dd class="font-medium">{{ doc.warehouse?.name }}</dd></div>
          <div><dt class="text-slate-400">نوع الإخراج</dt><dd class="font-medium">{{ OUTPUT_TYPE_LABELS[doc.outputType] }}</dd></div>
          <div><dt class="text-slate-400">الجهة المستلمة</dt><dd class="font-medium">{{ doc.receivingParty || '—' }}</dd></div>
          <div><dt class="text-slate-400">المرجع</dt><dd class="font-medium">{{ doc.reference || '—' }}</dd></div>
          <div><dt class="text-slate-400">أنشئ بواسطة</dt><dd class="font-medium">{{ doc.createdBy?.fullName }}</dd></div>
          <div v-if="doc.approvedBy"><dt class="text-slate-400">اعتمد بواسطة</dt><dd class="font-medium">{{ doc.approvedBy?.fullName }}</dd></div>
        </dl>

        <table class="table-base">
          <thead><tr><th>الصنف</th><th>SKU</th><th>الكمية</th></tr></thead>
          <tbody>
            <tr v-for="item in doc.items" :key="item.product._id">
              <td class="font-medium">{{ item.product?.nameAr }}</td>
              <td class="font-mono text-xs">{{ item.product?.sku }}</td>
              <td>{{ item.quantity }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="doc.notes" class="text-sm text-slate-500 dark:text-slate-400 mt-4">ملاحظات: {{ doc.notes }}</p>
      </div>
    </template>
  </div>
</template>
