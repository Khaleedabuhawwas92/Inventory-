<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import purchaseService from '@/services/purchaseService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { safePrint } from '@/utils/print';

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
    const { data } = await purchaseService.getReceipt(route.params.id);
    doc.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل سند الاستلام');
  } finally {
    loading.value = false;
  }
}

async function approveDoc() {
  const ok = await confirm({ title: 'اعتماد الاستلام', message: 'سيتم تحديث المخزون فور الاعتماد. هل أنت متأكد؟', confirmText: 'اعتماد' });
  if (!ok) return;
  busy.value = true;
  try {
    await purchaseService.approveReceipt(doc.value._id);
    toast.success('تم اعتماد الاستلام');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر اعتماد الاستلام');
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
          <router-link to="/goods-receipts" class="text-sm text-primary-600 hover:underline">← سندات الاستلام</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">سند استلام {{ doc.docNo }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="safePrint()">طباعة</button>
          <button v-if="doc.status === 'DRAFT' && auth.can('purchases.create')" class="btn-primary" :disabled="busy" @click="approveDoc">اعتماد</button>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <StatusBadge :status="doc.status" />
          <span class="text-sm text-slate-400">{{ new Date(doc.date).toLocaleDateString('ar') }}</span>
        </div>
        <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-6">
          <div><dt class="text-slate-400">المورد</dt><dd class="font-medium">{{ doc.supplier?.name }}</dd></div>
          <div><dt class="text-slate-400">المخزن</dt><dd class="font-medium">{{ doc.warehouse?.name }}</dd></div>
          <div v-if="doc.purchaseOrder"><dt class="text-slate-400">طلب الشراء</dt><dd class="font-medium"><router-link :to="`/purchases/${doc.purchaseOrder._id}`" class="text-primary-600 hover:underline">{{ doc.purchaseOrder.docNo }}</router-link></dd></div>
          <div><dt class="text-slate-400">رقم فاتورة المورد</dt><dd class="font-medium">{{ doc.supplierInvoiceNo || '—' }}</dd></div>
        </dl>

        <table class="table-base">
          <thead><tr><th>الصنف</th><th>SKU</th><th>الكمية المستلمة</th><th>تكلفة الوحدة</th><th>الإجمالي</th></tr></thead>
          <tbody>
            <tr v-for="item in doc.items" :key="item.product._id">
              <td class="font-medium">{{ item.product?.nameAr }}</td>
              <td class="font-mono text-xs">{{ item.product?.sku }}</td>
              <td>{{ item.receivingQty }}</td>
              <td>{{ item.unitCost?.toFixed(2) }}</td>
              <td>{{ (item.receivingQty * item.unitCost).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="doc.notes" class="text-sm text-slate-500 dark:text-slate-400 mt-4">ملاحظات: {{ doc.notes }}</p>
      </div>
    </template>
  </div>
</template>
