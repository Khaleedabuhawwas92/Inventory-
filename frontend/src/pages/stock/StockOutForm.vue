<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import stockService from '@/services/stockService';
import warehouseService from '@/services/warehouseService';
import productService from '@/services/productService';
import ProductLineItems from '@/components/stock/ProductLineItems.vue';

const OUTPUT_TYPES = [
  { value: 'INTERNAL_USE', label: 'استخدام داخلي' },
  { value: 'SALE', label: 'بيع' },
  { value: 'DAMAGE', label: 'تالف' },
  { value: 'MAINTENANCE', label: 'صيانة' },
  { value: 'SAMPLE', label: 'عينة' },
  { value: 'OTHER', label: 'أخرى' },
];

const router = useRouter();
const toast = useToast();

const warehouses = ref([]);
const saving = ref(false);
const items = ref([]);

const form = reactive({ warehouse: '', outputType: 'INTERNAL_USE', receivingParty: '', reference: '', notes: '' });

async function fetchAvailable(item) {
  const { data } = await productService.stockByWarehouse(item.product);
  const balance = data.data.find((b) => b.warehouse?._id === form.warehouse);
  item.available = balance?.availableQuantity ?? 0;
}

async function refreshAllAvailability() {
  if (!form.warehouse) return;
  await Promise.all(items.value.map(fetchAvailable));
}

watch(() => form.warehouse, refreshAllAvailability);
watch(
  () => items.value.map((i) => i.product),
  () => {
    // ProductLineItems seeds new lines with `available: null` (it has no
    // warehouse context of its own); treat that the same as "not fetched yet".
    const missing = items.value.filter((i) => i.available === undefined || i.available === null);
    missing.forEach(fetchAvailable);
  }
);

async function loadLookups() {
  const { data } = await warehouseService.list();
  warehouses.value = data.data;
  if (warehouses.value.length) form.warehouse = warehouses.value[0]._id;
}

async function submit(shouldApprove) {
  if (!form.warehouse) return toast.error('الرجاء اختيار المخزن');
  if (!items.value.length) return toast.error('الرجاء إضافة صنف واحد على الأقل');

  const overLimit = items.value.find((i) => i.available !== null && i.quantity > i.available);
  if (overLimit && shouldApprove) {
    toast.error(`الكمية المطلوبة لـ "${overLimit.nameAr}" أكبر من المتوفر (${overLimit.available})`);
    return;
  }

  saving.value = true;
  try {
    const { data } = await stockService.createOut({
      warehouse: form.warehouse,
      outputType: form.outputType,
      receivingParty: form.receivingParty,
      reference: form.reference,
      notes: form.notes,
      items: items.value.map((i) => ({ product: i.product, quantity: i.quantity })),
      submit: shouldApprove,
    });
    toast.success(shouldApprove ? 'تم اعتماد السند وتحديث المخزون' : 'تم حفظ السند كمسودة');
    router.push(`/stock/out/${data.data._id}`);
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
    <router-link to="/stock/out" class="text-sm text-primary-600 hover:underline">← سندات الإخراج</router-link>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">سند إخراج بضاعة جديد</h1>

    <div class="card p-6 mb-4">
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="label">المخزن *</label>
          <select v-model="form.warehouse" class="input">
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">نوع الإخراج *</label>
          <select v-model="form.outputType" class="input">
            <option v-for="t in OUTPUT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div>
          <label class="label">الجهة المستلمة</label>
          <input v-model="form.receivingParty" class="input" />
        </div>
        <div>
          <label class="label">المرجع</label>
          <input v-model="form.reference" class="input" />
        </div>
        <div class="sm:col-span-2">
          <label class="label">ملاحظات</label>
          <input v-model="form.notes" class="input" />
        </div>
      </div>
    </div>

    <div class="card p-6 mb-4">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">الأصناف</h3>
      <ProductLineItems v-model="items" show-available />
    </div>

    <div class="flex items-center gap-3">
      <button class="btn-secondary" :disabled="saving" @click="submit(false)">حفظ كمسودة</button>
      <button class="btn-primary" :disabled="saving" @click="submit(true)">{{ saving ? 'جاري الحفظ...' : 'اعتماد السند' }}</button>
    </div>
  </div>
</template>
