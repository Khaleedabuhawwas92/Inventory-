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

const REASON_LABELS = {
  DAMAGE: 'تالف', LOSS: 'فقدان', WRONG_ENTRY: 'خطأ إدخال', INVENTORY_COUNT: 'جرد فعلي', FOUND_STOCK: 'بضاعة موجودة', OTHER: 'أخرى',
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
    const { data } = await stockService.getAdjustment(route.params.id);
    doc.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل سند التسوية');
  } finally {
    loading.value = false;
  }
}

async function approveDoc() {
  const ok = await confirm({ title: 'اعتماد التسوية', message: 'سيتم تحديث المخزون بالكميات الجديدة فور الاعتماد. هل أنت متأكد؟', confirmText: 'اعتماد' });
  if (!ok) return;
  busy.value = true;
  try {
    await stockService.approveAdjustment(doc.value._id);
    toast.success('تم اعتماد التسوية');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر اعتماد التسوية');
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
          <router-link to="/stock/adjustments" class="text-sm text-primary-600 hover:underline">← التسويات</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">تسوية {{ doc.docNo }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="safePrint()">طباعة</button>
          <button v-if="doc.status === 'DRAFT' && auth.can('stock.adjust')" class="btn-primary" :disabled="busy" @click="approveDoc">اعتماد</button>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <StatusBadge :status="doc.status" />
          <span class="text-sm text-slate-400">{{ new Date(doc.date).toLocaleDateString('ar') }}</span>
        </div>
        <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-6">
          <div><dt class="text-slate-400">المخزن</dt><dd class="font-medium">{{ doc.warehouse?.name }}</dd></div>
          <div><dt class="text-slate-400">أنشئ بواسطة</dt><dd class="font-medium">{{ doc.createdBy?.fullName }}</dd></div>
          <div v-if="doc.approvedBy"><dt class="text-slate-400">اعتمد بواسطة</dt><dd class="font-medium">{{ doc.approvedBy?.fullName }}</dd></div>
        </dl>

        <table class="table-base">
          <thead><tr><th>الصنف</th><th>الكمية بالنظام</th><th>الكمية الجديدة</th><th>الفرق</th><th>السبب</th></tr></thead>
          <tbody>
            <tr v-for="item in doc.items" :key="item.product._id">
              <td class="font-medium">{{ item.product?.nameAr }}</td>
              <td>{{ item.systemQty }}</td>
              <td>{{ item.newQty }}</td>
              <td :class="item.newQty - item.systemQty > 0 ? 'text-green-600' : item.newQty - item.systemQty < 0 ? 'text-red-600' : ''">
                {{ item.newQty - item.systemQty > 0 ? '+' : '' }}{{ item.newQty - item.systemQty }}
              </td>
              <td>{{ REASON_LABELS[item.reason] }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="doc.notes" class="text-sm text-slate-500 dark:text-slate-400 mt-4">ملاحظات: {{ doc.notes }}</p>
      </div>
    </template>
  </div>
</template>
