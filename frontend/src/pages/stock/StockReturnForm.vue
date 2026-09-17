<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import stockService from '@/services/stockService';
import warehouseService from '@/services/warehouseService';
import supplierService from '@/services/supplierService';
import ProductLineItems from '@/components/stock/ProductLineItems.vue';

const router = useRouter();
const toast = useToast();

const warehouses = ref([]);
const suppliers = ref([]);
const saving = ref(false);
const items = ref([]);
const form = reactive({ type: 'FROM_CUSTOMER', warehouse: '', supplier: '', reason: '', notes: '' });

async function loadLookups() {
  const [whRes, supRes] = await Promise.all([warehouseService.list(), supplierService.list()]);
  warehouses.value = whRes.data.data;
  suppliers.value = supRes.data.data;
  if (warehouses.value.length) form.warehouse = warehouses.value[0]._id;
}

async function submit(shouldApprove) {
  if (!form.warehouse) return toast.error('الرجاء اختيار المخزن');
  if (!items.value.length) return toast.error('الرجاء إضافة صنف واحد على الأقل');

  saving.value = true;
  try {
    const { data } = await stockService.createReturn({
      type: form.type,
      warehouse: form.warehouse,
      supplier: form.type === 'TO_SUPPLIER' ? form.supplier || undefined : undefined,
      reason: form.reason,
      notes: form.notes,
      items: items.value.map((i) => ({ product: i.product, quantity: i.quantity })),
      submit: shouldApprove,
    });
    toast.success(shouldApprove ? 'تم اعتماد المرتجع وتحديث المخزون' : 'تم حفظ المرتجع كمسودة');
    router.push(`/stock/returns/${data.data._id}`);
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
    <router-link to="/stock/returns" class="text-sm text-primary-600 hover:underline">← المرتجعات</router-link>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">مرتجع جديد</h1>

    <div class="card p-6 mb-4">
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="label">نوع المرتجع *</label>
          <select v-model="form.type" class="input">
            <option value="FROM_CUSTOMER">مرتجع من عميل / داخلي (إضافة للمخزون)</option>
            <option value="TO_SUPPLIER">مرتجع للمورد (خصم من المخزون)</option>
          </select>
        </div>
        <div>
          <label class="label">المخزن *</label>
          <select v-model="form.warehouse" class="input">
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div v-if="form.type === 'TO_SUPPLIER'">
          <label class="label">المورد</label>
          <select v-model="form.supplier" class="input">
            <option value="">بدون تحديد</option>
            <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">السبب</label>
          <input v-model="form.reason" class="input" />
        </div>
        <div class="sm:col-span-2">
          <label class="label">ملاحظات</label>
          <input v-model="form.notes" class="input" />
        </div>
      </div>
    </div>

    <div class="card p-6 mb-4">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الأصناف</h3>
      <ProductLineItems v-model="items" />
    </div>

    <div class="flex items-center gap-3">
      <button class="btn-secondary" :disabled="saving" @click="submit(false)">حفظ كمسودة</button>
      <button class="btn-primary" :disabled="saving" @click="submit(true)">{{ saving ? 'جاري الحفظ...' : 'اعتماد المرتجع' }}</button>
    </div>
  </div>
</template>
