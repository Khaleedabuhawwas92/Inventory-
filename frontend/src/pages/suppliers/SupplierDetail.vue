<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import supplierService from '@/services/supplierService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const route = useRoute();
const toast = useToast();

const supplier = ref(null);
const history = ref({ purchaseOrders: [], goodsReceipts: [], returns: [] });
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const [supRes, histRes] = await Promise.all([
      supplierService.get(route.params.id),
      supplierService.history(route.params.id),
    ]);
    supplier.value = supRes.data.data;
    history.value = histRes.data.data;
  } catch (err) {
    toast.error('تعذر تحميل بيانات المورد');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="supplier">
      <router-link to="/suppliers" class="text-sm text-primary-600 hover:underline">← الموردون</router-link>
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">{{ supplier.name }}</h1>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="card p-4 lg:col-span-1 space-y-2 text-sm">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">بيانات المورد</h3>
          <p><span class="text-slate-400">الرمز:</span> {{ supplier.code || '—' }}</p>
          <p><span class="text-slate-400">الهاتف:</span> {{ supplier.phone || '—' }}</p>
          <p><span class="text-slate-400">واتساب:</span> {{ supplier.whatsapp || '—' }}</p>
          <p><span class="text-slate-400">البريد:</span> {{ supplier.email || '—' }}</p>
          <p><span class="text-slate-400">الرقم الضريبي:</span> {{ supplier.taxNumber || '—' }}</p>
          <p><span class="text-slate-400">العنوان:</span> {{ supplier.address || '—' }}</p>
          <p><span class="text-slate-400">جهة الاتصال:</span> {{ supplier.contactPerson || '—' }}</p>
          <p><span class="text-slate-400">الرصيد:</span> {{ supplier.balance?.toFixed(2) }}</p>
          <p><StatusBadge :status="supplier.active ? 'active' : 'inactive'" /></p>
        </div>

        <div class="lg:col-span-2 space-y-4">
          <div class="card p-4">
            <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">طلبات الشراء</h3>
            <EmptyState v-if="!history.purchaseOrders.length" title="لا توجد طلبات شراء" />
            <table v-else class="table-base">
              <thead><tr><th>رقم الطلب</th><th>المخزن</th><th>الحالة</th></tr></thead>
              <tbody>
                <tr v-for="po in history.purchaseOrders" :key="po._id">
                  <td class="font-mono text-xs"><router-link :to="`/purchases/${po._id}`" class="text-primary-600 hover:underline">{{ po.docNo }}</router-link></td>
                  <td>{{ po.warehouse?.name }}</td>
                  <td><StatusBadge :status="po.status" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card p-4">
            <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">سندات الاستلام</h3>
            <EmptyState v-if="!history.goodsReceipts.length" title="لا توجد سندات استلام" />
            <table v-else class="table-base">
              <thead><tr><th>رقم السند</th><th>المخزن</th><th>الحالة</th></tr></thead>
              <tbody>
                <tr v-for="grn in history.goodsReceipts" :key="grn._id">
                  <td class="font-mono text-xs">{{ grn.docNo }}</td>
                  <td>{{ grn.warehouse?.name }}</td>
                  <td><StatusBadge :status="grn.status" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card p-4">
            <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">المرتجعات للمورد</h3>
            <EmptyState v-if="!history.returns.length" title="لا توجد مرتجعات" />
            <table v-else class="table-base">
              <thead><tr><th>رقم السند</th><th>المخزن</th><th>الحالة</th></tr></thead>
              <tbody>
                <tr v-for="ret in history.returns" :key="ret._id">
                  <td class="font-mono text-xs">{{ ret.docNo }}</td>
                  <td>{{ ret.warehouse?.name }}</td>
                  <td><StatusBadge :status="ret.status" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
