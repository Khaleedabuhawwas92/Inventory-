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
    const { data } = await purchaseService.getOrder(route.params.id);
    doc.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل طلب الشراء');
  } finally {
    loading.value = false;
  }
}

async function approveDoc() {
  const ok = await confirm({ title: 'اعتماد طلب الشراء', message: 'هل أنت متأكد من اعتماد هذا الطلب؟', confirmText: 'اعتماد' });
  if (!ok) return;
  busy.value = true;
  try {
    await purchaseService.approveOrder(doc.value._id);
    toast.success('تم اعتماد طلب الشراء');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر اعتماد الطلب');
  } finally {
    busy.value = false;
  }
}

async function cancelDoc() {
  const ok = await confirm({ title: 'إلغاء طلب الشراء', message: 'هل أنت متأكد من إلغاء هذا الطلب؟', confirmText: 'إلغاء', danger: true });
  if (!ok) return;
  busy.value = true;
  try {
    await purchaseService.cancelOrder(doc.value._id);
    toast.success('تم إلغاء طلب الشراء');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إلغاء الطلب');
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
          <router-link to="/purchases" class="text-sm text-primary-600 hover:underline">← طلبات الشراء</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">طلب شراء {{ doc.docNo }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="safePrint()">طباعة</button>
          <router-link
            v-if="['APPROVED', 'PARTIALLY_RECEIVED'].includes(doc.status) && auth.can('purchases.create')"
            :to="`/goods-receipts/new?poId=${doc._id}`" class="btn-primary"
          >استلام البضاعة</router-link>
          <button v-if="['DRAFT', 'PENDING'].includes(doc.status) && auth.can('purchases.approve')" class="btn-primary" :disabled="busy" @click="approveDoc">اعتماد</button>
          <button v-if="!['RECEIVED', 'CANCELLED'].includes(doc.status) && auth.can('purchases.create')" class="btn-danger" :disabled="busy" @click="cancelDoc">إلغاء</button>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <StatusBadge :status="doc.status" />
          <span class="text-sm text-slate-400">{{ new Date(doc.orderDate).toLocaleDateString('ar') }}</span>
        </div>
        <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-6">
          <div><dt class="text-slate-400">المورد</dt><dd class="font-medium">{{ doc.supplier?.name }}</dd></div>
          <div><dt class="text-slate-400">المخزن</dt><dd class="font-medium">{{ doc.warehouse?.name }}</dd></div>
          <div v-if="doc.expectedDate"><dt class="text-slate-400">تاريخ التسليم المتوقع</dt><dd class="font-medium">{{ new Date(doc.expectedDate).toLocaleDateString('ar') }}</dd></div>
        </dl>

        <table class="table-base">
          <thead><tr><th>الصنف</th><th>SKU</th><th>الكمية المطلوبة</th><th>المستلم</th><th>تكلفة الوحدة</th><th>الإجمالي</th></tr></thead>
          <tbody>
            <tr v-for="item in doc.items" :key="item.product._id">
              <td class="font-medium">{{ item.product?.nameAr }}</td>
              <td class="font-mono text-xs">{{ item.product?.sku }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ item.receivedQty }}</td>
              <td>{{ item.unitCost?.toFixed(2) }}</td>
              <td>{{ (item.quantity * item.unitCost - item.discount + item.tax).toFixed(2) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td colspan="5" class="text-left font-bold">الإجمالي</td><td class="font-bold">{{ doc.total?.toFixed(2) }}</td></tr>
          </tfoot>
        </table>

        <p v-if="doc.notes" class="text-sm text-slate-500 dark:text-slate-400 mt-4">ملاحظات: {{ doc.notes }}</p>
      </div>
    </template>
  </div>
</template>
