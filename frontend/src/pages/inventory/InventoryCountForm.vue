<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import inventoryCountService from '@/services/inventoryCountService';
import warehouseService from '@/services/warehouseService';
import categoryService from '@/services/categoryService';

const router = useRouter();
const toast = useToast();

const warehouses = ref([]);
const categories = ref([]);
const saving = ref(false);
const form = reactive({ warehouse: '', categoryFilter: '', notes: '' });

async function loadLookups() {
  const [whRes, catRes] = await Promise.all([warehouseService.list(), categoryService.list()]);
  warehouses.value = whRes.data.data;
  categories.value = catRes.data.data;
  if (warehouses.value.length) form.warehouse = warehouses.value[0]._id;
}

async function submit() {
  if (!form.warehouse) return toast.error('الرجاء اختيار المخزن');
  saving.value = true;
  try {
    const { data } = await inventoryCountService.create({
      warehouse: form.warehouse,
      categoryFilter: form.categoryFilter || undefined,
      notes: form.notes,
    });
    toast.success('تم بدء جلسة الجرد');
    router.push(`/inventory/${data.data._id}`);
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر بدء جلسة الجرد');
  } finally {
    saving.value = false;
  }
}

onMounted(loadLookups);
</script>

<template>
  <div>
    <router-link to="/inventory" class="text-sm text-primary-600 hover:underline">← الجرد</router-link>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">جلسة جرد جديدة</h1>

    <div class="card p-6 max-w-xl">
      <div class="space-y-4">
        <div>
          <label class="label">المخزن *</label>
          <select v-model="form.warehouse" class="input">
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">تصنيف محدد (اختياري)</label>
          <select v-model="form.categoryFilter" class="input">
            <option value="">كل التصنيفات</option>
            <option v-for="c in categories" :key="c._id" :value="c._id">{{ c.nameAr }}</option>
          </select>
          <p class="text-xs text-slate-400 mt-1">اترك هذا الحقل فارغاً لجرد كل الأصناف النشطة في المخزن المحدد.</p>
        </div>
        <div>
          <label class="label">ملاحظات</label>
          <input v-model="form.notes" class="input" />
        </div>
        <button class="btn-primary w-full" :disabled="saving" @click="submit">{{ saving ? 'جاري البدء...' : 'بدء الجرد' }}</button>
      </div>
    </div>
  </div>
</template>
