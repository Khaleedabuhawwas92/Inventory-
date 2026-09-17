<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import stockService from '@/services/stockService';
import warehouseService from '@/services/warehouseService';
import ProductLineItems from '@/components/stock/ProductLineItems.vue';

const router = useRouter();
const toast = useToast();

const warehouses = ref([]);
const saving = ref(false);
const items = ref([]);
const form = reactive({ fromWarehouse: '', toWarehouse: '', notes: '' });

async function loadLookups() {
  const { data } = await warehouseService.list();
  warehouses.value = data.data;
  if (warehouses.value.length >= 2) {
    form.fromWarehouse = warehouses.value[0]._id;
    form.toWarehouse = warehouses.value[1]._id;
  } else if (warehouses.value.length === 1) {
    form.fromWarehouse = warehouses.value[0]._id;
  }
}

async function submit(shouldShip) {
  if (!form.fromWarehouse || !form.toWarehouse) return toast.error('الرجاء اختيار المخزن المصدر والوجهة');
  if (form.fromWarehouse === form.toWarehouse) return toast.error('لا يمكن أن يكون المخزن المصدر والوجهة نفس المخزن');
  if (!items.value.length) return toast.error('الرجاء إضافة صنف واحد على الأقل');

  saving.value = true;
  try {
    const { data } = await stockService.createTransfer({
      fromWarehouse: form.fromWarehouse,
      toWarehouse: form.toWarehouse,
      notes: form.notes,
      items: items.value.map((i) => ({ product: i.product, quantity: i.quantity })),
    });
    if (shouldShip) {
      await stockService.shipTransfer(data.data._id);
      toast.success('تم شحن التحويل، البضاعة الآن قيد النقل');
    } else {
      toast.success('تم حفظ سند التحويل كمسودة');
    }
    router.push(`/stock/transfers/${data.data._id}`);
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
    <router-link to="/stock/transfers" class="text-sm text-primary-600 hover:underline">← سندات التحويل</router-link>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">تحويل مخزون جديد</h1>

    <div class="card p-6 mb-4">
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="label">من مخزن *</label>
          <select v-model="form.fromWarehouse" class="input">
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">إلى مخزن *</label>
          <select v-model="form.toWarehouse" class="input">
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div>
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
      <button class="btn-primary" :disabled="saving" @click="submit(true)">{{ saving ? 'جاري الحفظ...' : 'شحن التحويل الآن' }}</button>
    </div>
  </div>
</template>
