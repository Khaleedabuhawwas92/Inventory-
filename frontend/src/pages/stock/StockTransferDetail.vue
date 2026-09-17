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
    const { data } = await stockService.getTransfer(route.params.id);
    doc.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل سند التحويل');
  } finally {
    loading.value = false;
  }
}

async function shipDoc() {
  const ok = await confirm({ title: 'شحن التحويل', message: 'ستخرج البضاعة من المخزن المصدر فوراً. هل أنت متأكد؟', confirmText: 'شحن' });
  if (!ok) return;
  busy.value = true;
  try {
    await stockService.shipTransfer(doc.value._id);
    toast.success('تم شحن التحويل');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر شحن التحويل');
  } finally {
    busy.value = false;
  }
}

async function receiveDoc() {
  const ok = await confirm({ title: 'استلام التحويل', message: 'ستدخل البضاعة إلى مخزون الوجهة فوراً. هل أنت متأكد؟', confirmText: 'استلام' });
  if (!ok) return;
  busy.value = true;
  try {
    await stockService.receiveTransfer(doc.value._id);
    toast.success('تم استلام البضاعة');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر استلام التحويل');
  } finally {
    busy.value = false;
  }
}

async function cancelDoc() {
  const ok = await confirm({ title: 'إلغاء التحويل', message: 'سيتم عكس أثر التحويل إن وُجد. هل أنت متأكد؟', confirmText: 'إلغاء', danger: true });
  if (!ok) return;
  busy.value = true;
  try {
    await stockService.cancelTransfer(doc.value._id);
    toast.success('تم إلغاء التحويل');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إلغاء التحويل');
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
          <router-link to="/stock/transfers" class="text-sm text-primary-600 hover:underline">← سندات التحويل</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">تحويل {{ doc.docNo }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="safePrint()">طباعة</button>
          <button v-if="doc.status === 'DRAFT' && auth.can('stock.transfer')" class="btn-primary" :disabled="busy" @click="shipDoc">شحن</button>
          <button v-if="doc.status === 'IN_TRANSIT' && auth.can('stock.transfer')" class="btn-primary" :disabled="busy" @click="receiveDoc">استلام</button>
          <button v-if="!['RECEIVED', 'CANCELLED'].includes(doc.status) && auth.can('stock.transfer')" class="btn-danger" :disabled="busy" @click="cancelDoc">إلغاء</button>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <StatusBadge :status="doc.status" />
          <span class="text-sm text-slate-400">{{ new Date(doc.date).toLocaleDateString('ar') }}</span>
        </div>
        <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-6">
          <div><dt class="text-slate-400">من مخزن</dt><dd class="font-medium">{{ doc.fromWarehouse?.name }}</dd></div>
          <div><dt class="text-slate-400">إلى مخزن</dt><dd class="font-medium">{{ doc.toWarehouse?.name }}</dd></div>
          <div><dt class="text-slate-400">أنشئ بواسطة</dt><dd class="font-medium">{{ doc.createdBy?.fullName }}</dd></div>
          <div v-if="doc.approvedBy"><dt class="text-slate-400">شُحن بواسطة</dt><dd class="font-medium">{{ doc.approvedBy?.fullName }}</dd></div>
          <div v-if="doc.receivedBy"><dt class="text-slate-400">استُلم بواسطة</dt><dd class="font-medium">{{ doc.receivedBy?.fullName }}</dd></div>
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
