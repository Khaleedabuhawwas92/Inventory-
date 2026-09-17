<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import productService from '@/services/productService';
import { MOVEMENT_TYPE_LABELS, isIncomingMovement } from '@/constants/movementTypes';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import BarcodeImage from '@/components/ui/BarcodeImage.vue';

const route = useRoute();
const toast = useToast();
const auth = useAuthStore();

const product = ref(null);
const stockBalances = ref([]);
const movements = ref([]);
const loading = ref(true);

const totalQuantity = computed(() => stockBalances.value.reduce((sum, b) => sum + b.quantity, 0));

async function load() {
  loading.value = true;
  try {
    const [productRes, stockRes, movementsRes] = await Promise.all([
      productService.get(route.params.id),
      productService.stockByWarehouse(route.params.id),
      productService.movements(route.params.id, { limit: 15 }),
    ]);
    product.value = productRes.data.data;
    stockBalances.value = stockRes.data.data;
    movements.value = movementsRes.data.data;
  } catch (err) {
    toast.error('تعذر تحميل بيانات الصنف');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="product">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <router-link to="/products" class="text-sm text-primary-600 hover:underline">← الأصناف</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ product.nameAr }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <router-link v-if="product.barcode" :to="`/barcode-labels?productId=${product._id}`" class="btn-outline">طباعة الباركود</router-link>
          <router-link v-if="auth.can('products.edit')" :to="`/products/${product._id}/edit`" class="btn-primary">تعديل الصنف</router-link>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="card p-4 lg:col-span-1">
          <img v-if="product.image" :src="product.image" class="w-full aspect-square object-cover rounded-xl mb-4" />
          <div v-else class="w-full aspect-square bg-slate-100 dark:bg-slate-700 rounded-xl mb-4 flex items-center justify-center text-slate-400">لا توجد صورة</div>
          <dl class="text-sm space-y-2">
            <div class="flex justify-between"><dt class="text-slate-400">SKU</dt><dd class="font-mono">{{ product.sku }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الباركود</dt><dd class="font-mono">{{ product.barcode || '—' }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">التصنيف</dt><dd>{{ product.category?.nameAr }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الوحدة</dt><dd>{{ product.unit?.nameAr }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">العلامة التجارية</dt><dd>{{ product.brand || '—' }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">سعر الشراء</dt><dd>{{ product.purchasePrice?.toFixed(2) }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">سعر البيع</dt><dd>{{ product.salePrice?.toFixed(2) }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الحد الأدنى</dt><dd>{{ product.minStock }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الحد الأقصى</dt><dd>{{ product.maxStock }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-400">الحالة</dt><dd><StatusBadge :status="product.active ? 'active' : 'inactive'" /></dd></div>
          </dl>
          <div v-if="product.barcode" class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 bg-white rounded-lg p-3 flex justify-center">
            <BarcodeImage :value="product.barcode" :height="45" />
          </div>
          <p v-if="product.description" class="text-sm text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">{{ product.description }}</p>
        </div>

        <div class="lg:col-span-2 space-y-4">
          <div class="card p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-slate-700 dark:text-slate-200">الكمية الحالية حسب المخزن</h3>
              <span class="text-sm text-slate-500 dark:text-slate-400">الإجمالي: <strong>{{ totalQuantity }}</strong></span>
            </div>
            <EmptyState v-if="!stockBalances.length" title="لا يوجد رصيد مسجل بعد" message="سيظهر الرصيد فور تسجيل أول حركة إدخال لهذا الصنف" />
            <table v-else class="table-base">
              <thead><tr><th>المخزن</th><th>الكمية</th><th>المتاح</th><th>متوسط التكلفة</th></tr></thead>
              <tbody>
                <tr v-for="b in stockBalances" :key="b._id">
                  <td>{{ b.warehouse?.name }}</td>
                  <td class="font-medium">{{ b.quantity }}</td>
                  <td>{{ b.availableQuantity }}</td>
                  <td>{{ b.averageCost?.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card p-4">
            <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">سجل الحركات</h3>
            <EmptyState v-if="!movements.length" title="لا توجد حركات مسجلة بعد" />
            <table v-else class="table-base">
              <thead><tr><th>التاريخ</th><th>النوع</th><th>المرجع</th><th>الكمية</th><th>الرصيد بعد</th><th>المخزن</th><th>المستخدم</th></tr></thead>
              <tbody>
                <tr v-for="m in movements" :key="m._id">
                  <td class="text-xs text-slate-400">{{ new Date(m.createdAt).toLocaleString('ar') }}</td>
                  <td>{{ MOVEMENT_TYPE_LABELS[m.type] || m.type }}</td>
                  <td class="font-mono text-xs">{{ m.movementNo }}</td>
                  <td :class="isIncomingMovement(m) ? 'text-green-600' : 'text-red-600'">
                    {{ isIncomingMovement(m) ? '+' : '-' }}{{ m.quantity }}
                  </td>
                  <td class="font-medium">{{ m.afterQty }}</td>
                  <td>{{ m.warehouse?.name }}</td>
                  <td>{{ m.createdBy?.fullName || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
