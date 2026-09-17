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

const TYPE_LABELS = { TO_SUPPLIER: 'مرتجع للمورد', FROM_CUSTOMER: 'مرتجع من عميل/داخلي' };

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
    const { data } = await stockService.getReturn(route.params.id);
    doc.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل سند المرتجع');
  } finally {
    loading.value = false;
  }
}

async function approveDoc() {
  const ok = await confirm({ title: 'اعتماد المرتجع', message: 'سيتم تحديث المخزون فور الاعتماد. هل أنت متأكد؟', confirmText: 'اعتماد' });
  if (!ok) return;
  busy.value = true;
  try {
    await stockService.approveReturn(doc.value._id);
    toast.success('تم اعتماد المرتجع');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر اعتماد المرتجع');
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
          <router-link to="/stock/returns" class="text-sm text-primary-600 hover:underline">← المرتجعات</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">مرتجع {{ doc.docNo }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="safePrint()">طباعة</button>
          <button
            v-if="doc.status === 'DRAFT' && (auth.can(doc.type === 'TO_SUPPLIER' ? 'stock.out' : 'stock.in'))"
            class="btn-primary" :disabled="busy" @click="approveDoc"
          >اعتماد</button>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <StatusBadge :status="doc.status" />
          <span class="text-sm text-slate-400">{{ new Date(doc.date).toLocaleDateString('ar') }}</span>
        </div>
        <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-6">
          <div><dt class="text-slate-400">النوع</dt><dd class="font-medium">{{ TYPE_LABELS[doc.type] }}</dd></div>
          <div><dt class="text-slate-400">المخزن</dt><dd class="font-medium">{{ doc.warehouse?.name }}</dd></div>
          <div v-if="doc.supplier"><dt class="text-slate-400">المورد</dt><dd class="font-medium">{{ doc.supplier?.name }}</dd></div>
          <div><dt class="text-slate-400">السبب</dt><dd class="font-medium">{{ doc.reason || '—' }}</dd></div>
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
