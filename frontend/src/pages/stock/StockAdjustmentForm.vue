<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import stockService from '@/services/stockService';
import warehouseService from '@/services/warehouseService';
import productService from '@/services/productService';

const REASONS = [
  { value: 'DAMAGE', label: 'تالف' },
  { value: 'LOSS', label: 'فقدان' },
  { value: 'WRONG_ENTRY', label: 'خطأ إدخال' },
  { value: 'INVENTORY_COUNT', label: 'جرد فعلي' },
  { value: 'FOUND_STOCK', label: 'بضاعة موجودة' },
  { value: 'OTHER', label: 'أخرى' },
];

const router = useRouter();
const toast = useToast();

const warehouses = ref([]);
const saving = ref(false);
const items = ref([]);
const searchQuery = ref('');
const searchResults = ref([]);

const form = reactive({ warehouse: '', notes: '' });

async function loadLookups() {
  const { data } = await warehouseService.list();
  warehouses.value = data.data;
  if (warehouses.value.length) form.warehouse = warehouses.value[0]._id;
}

let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  if (!searchQuery.value.trim()) { searchResults.value = []; return; }
  searchTimer = setTimeout(async () => {
    const { data } = await productService.list({ search: searchQuery.value, limit: 8, active: 'true' });
    searchResults.value = data.data;
  }, 300);
}

async function addProduct(product) {
  if (items.value.some((i) => i.product === product._id)) {
    toast.info('الصنف مضاف مسبقاً');
    return;
  }
  const { data } = await productService.stockByWarehouse(product._id);
  const balance = data.data.find((b) => b.warehouse?._id === form.warehouse);
  const systemQty = balance?.quantity ?? 0;
  items.value.push({ product: product._id, nameAr: product.nameAr, sku: product.sku, systemQty, newQty: systemQty, reason: 'INVENTORY_COUNT', notes: '' });
  searchQuery.value = '';
  searchResults.value = [];
}

watch(() => form.warehouse, () => {
  items.value = []; // system quantities are warehouse-specific; start over on warehouse change
});

function removeItem(index) {
  items.value.splice(index, 1);
}

async function submit(shouldApprove) {
  if (!form.warehouse) return toast.error('الرجاء اختيار المخزن');
  if (!items.value.length) return toast.error('الرجاء إضافة صنف واحد على الأقل');

  saving.value = true;
  try {
    const { data } = await stockService.createAdjustment({
      warehouse: form.warehouse,
      notes: form.notes,
      items: items.value.map((i) => ({ product: i.product, newQty: i.newQty, reason: i.reason, notes: i.notes })),
      submit: shouldApprove,
    });
    toast.success(shouldApprove ? 'تم اعتماد التسوية وتحديث المخزون' : 'تم حفظ التسوية كمسودة');
    router.push(`/stock/adjustments/${data.data._id}`);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

onMounted(loadLookups);
</script>

<template>
  <div>
    <router-link to="/stock/adjustments" class="text-sm text-primary-600 hover:underline">← التسويات</router-link>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">تسوية مخزون جديدة</h1>

    <div class="card p-6 mb-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="label">المخزن *</label>
          <select v-model="form.warehouse" class="input">
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">ملاحظات عامة</label>
          <input v-model="form.notes" class="input" />
        </div>
      </div>
    </div>

    <div class="card p-6 mb-4">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الأصناف</h3>
      <div class="relative mb-4 max-w-md">
        <input v-model="searchQuery" class="input" placeholder="ابحث عن صنف لإضافته..." @input="onSearchInput" />
        <div v-if="searchResults.length" class="absolute z-10 mt-1 w-full card p-1 max-h-56 overflow-y-auto">
          <button
            v-for="p in searchResults" :key="p._id" type="button"
            class="w-full text-right px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
            @click="addProduct(p)"
          >
            {{ p.nameAr }} <span class="text-xs text-slate-400">({{ p.sku }})</span>
          </button>
        </div>
      </div>

      <table class="table-base">
        <thead><tr><th>الصنف</th><th>الكمية بالنظام</th><th>الكمية الجديدة</th><th>الفرق</th><th>السبب</th><th></th></tr></thead>
        <tbody>
          <tr v-if="!items.length"><td colspan="6" class="text-center text-slate-400 py-6">لم تتم إضافة أصناف بعد</td></tr>
          <tr v-for="(item, index) in items" :key="item.product">
            <td class="font-medium">{{ item.nameAr }}</td>
            <td>{{ item.systemQty }}</td>
            <td><input v-model.number="item.newQty" type="number" min="0" class="input !w-24" /></td>
            <td :class="item.newQty - item.systemQty > 0 ? 'text-green-600' : item.newQty - item.systemQty < 0 ? 'text-red-600' : ''">
              {{ item.newQty - item.systemQty > 0 ? '+' : '' }}{{ item.newQty - item.systemQty }}
            </td>
            <td>
              <select v-model="item.reason" class="input !w-40">
                <option v-for="r in REASONS" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
            </td>
            <td>
              <button type="button" class="text-red-500 hover:text-red-700" @click="removeItem(index)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center gap-3">
      <button class="btn-secondary" :disabled="saving" @click="submit(false)">حفظ كمسودة</button>
      <button class="btn-primary" :disabled="saving" @click="submit(true)">{{ saving ? 'جاري الحفظ...' : 'اعتماد التسوية' }}</button>
    </div>
  </div>
</template>
