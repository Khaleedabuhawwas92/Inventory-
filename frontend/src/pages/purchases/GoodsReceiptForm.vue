<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import purchaseService from '@/services/purchaseService';
import warehouseService from '@/services/warehouseService';
import supplierService from '@/services/supplierService';
import productService from '@/services/productService';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const warehouses = ref([]);
const suppliers = ref([]);
const saving = ref(false);
const items = ref([]);
const searchQuery = ref('');
const searchResults = ref([]);
const poId = ref(route.query.poId || null);

const form = reactive({ supplier: '', warehouse: '', supplierInvoiceNo: '', notes: '' });

async function loadFromPo() {
  const { data } = await purchaseService.openLines(poId.value);
  form.supplier = data.data.supplier;
  form.warehouse = data.data.warehouse;
  items.value = data.data.items.map((i) => ({
    product: i.product._id, nameAr: i.product.nameAr, sku: i.product.sku,
    orderedQty: i.orderedQty, alreadyReceivedQty: i.alreadyReceivedQty,
    receivingQty: i.remainingQty, unitCost: i.unitCost,
  }));
}

async function loadLookups() {
  const [whRes, supRes] = await Promise.all([warehouseService.list(), supplierService.list()]);
  warehouses.value = whRes.data.data;
  suppliers.value = supRes.data.data;

  if (poId.value) {
    await loadFromPo();
  } else {
    if (warehouses.value.length) form.warehouse = warehouses.value[0]._id;
    if (suppliers.value.length) form.supplier = suppliers.value[0]._id;
  }
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

function addProduct(p) {
  if (items.value.some((i) => i.product === p._id)) return;
  items.value.push({ product: p._id, nameAr: p.nameAr, sku: p.sku, orderedQty: 0, alreadyReceivedQty: 0, receivingQty: 1, unitCost: p.purchasePrice || 0 });
  searchQuery.value = ''; searchResults.value = [];
}

function removeItem(index) {
  items.value.splice(index, 1);
}

async function submit(shouldApprove) {
  if (!form.supplier || !form.warehouse) return toast.error('الرجاء اختيار المورد والمخزن');
  if (!items.value.length) return toast.error('الرجاء إضافة صنف واحد على الأقل');

  saving.value = true;
  try {
    const { data } = await purchaseService.createReceipt({
      supplier: form.supplier, warehouse: form.warehouse, purchaseOrder: poId.value || undefined,
      supplierInvoiceNo: form.supplierInvoiceNo, notes: form.notes,
      items: items.value.map((i) => ({
        product: i.product, orderedQty: i.orderedQty, alreadyReceivedQty: i.alreadyReceivedQty,
        receivingQty: i.receivingQty, unitCost: i.unitCost,
      })),
      submit: shouldApprove,
    });
    toast.success(shouldApprove ? 'تم اعتماد الاستلام وتحديث المخزون' : 'تم حفظ سند الاستلام كمسودة');
    router.push(`/goods-receipts/${data.data._id}`);
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
    <router-link to="/goods-receipts" class="text-sm text-primary-600 hover:underline">← سندات الاستلام</router-link>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">
      سند استلام بضاعة جديد <span v-if="poId" class="text-sm font-normal text-slate-400">(من طلب شراء)</span>
    </h1>

    <div class="card p-6 mb-4">
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="label">المورد *</label>
          <select v-model="form.supplier" class="input" :disabled="!!poId">
            <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">المخزن *</label>
          <select v-model="form.warehouse" class="input" :disabled="!!poId">
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">رقم فاتورة المورد</label>
          <input v-model="form.supplierInvoiceNo" class="input" />
        </div>
        <div class="sm:col-span-3">
          <label class="label">ملاحظات</label>
          <input v-model="form.notes" class="input" />
        </div>
      </div>
    </div>

    <div class="card p-6 mb-4">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الأصناف</h3>

      <div v-if="!poId" class="relative mb-4 max-w-md">
        <input v-model="searchQuery" class="input" placeholder="ابحث عن صنف لإضافته..." @input="onSearchInput" />
        <div v-if="searchResults.length" class="absolute z-10 mt-1 w-full card p-1 max-h-56 overflow-y-auto">
          <button
            v-for="p in searchResults" :key="p._id" type="button"
            class="w-full text-right px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
            @click="addProduct(p)"
          >{{ p.nameAr }} <span class="text-xs text-slate-400">({{ p.sku }})</span></button>
        </div>
      </div>

      <table class="table-base">
        <thead>
          <tr>
            <th>الصنف</th>
            <th v-if="poId">الكمية المطلوبة</th>
            <th v-if="poId">المستلم سابقاً</th>
            <th>الكمية المستلمة الآن</th>
            <th>تكلفة الوحدة</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!items.length"><td colspan="6" class="text-center text-slate-400 py-6">لم تتم إضافة أصناف بعد</td></tr>
          <tr v-for="(item, index) in items" :key="item.product">
            <td class="font-medium">{{ item.nameAr }}<span class="block text-xs text-slate-400 font-mono">{{ item.sku }}</span></td>
            <td v-if="poId">{{ item.orderedQty }}</td>
            <td v-if="poId">{{ item.alreadyReceivedQty }}</td>
            <td><input v-model.number="item.receivingQty" type="number" min="0.001" step="0.001" class="input !w-24" /></td>
            <td><input v-model.number="item.unitCost" type="number" min="0" step="0.01" class="input !w-24" /></td>
            <td><button v-if="!poId" type="button" class="text-red-500 hover:text-red-700" @click="removeItem(index)">×</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center gap-3">
      <button class="btn-secondary" :disabled="saving" @click="submit(false)">حفظ كمسودة</button>
      <button class="btn-primary" :disabled="saving" @click="submit(true)">{{ saving ? 'جاري الحفظ...' : 'اعتماد الاستلام' }}</button>
    </div>
  </div>
</template>
