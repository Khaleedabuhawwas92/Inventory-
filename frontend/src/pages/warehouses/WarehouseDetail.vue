<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import warehouseService from '@/services/warehouseService';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();

const warehouse = ref(null);
const locations = ref([]);
const loading = ref(true);
const adding = ref(false);

const form = reactive({ zone: '', aisle: '', rack: '', shelf: '' });

async function load() {
  loading.value = true;
  try {
    const [whRes, locRes] = await Promise.all([
      warehouseService.get(route.params.id),
      warehouseService.locations(route.params.id),
    ]);
    warehouse.value = whRes.data.data;
    locations.value = locRes.data.data;
  } catch (err) {
    toast.error('تعذر تحميل بيانات المخزن');
  } finally {
    loading.value = false;
  }
}

async function addLocation() {
  if (!form.zone) {
    toast.error('المنطقة (Zone) مطلوبة على الأقل');
    return;
  }
  adding.value = true;
  try {
    await warehouseService.createLocation(route.params.id, { ...form });
    toast.success('تمت إضافة الموقع');
    form.zone = ''; form.aisle = ''; form.rack = ''; form.shelf = '';
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إضافة الموقع');
  } finally {
    adding.value = false;
  }
}

async function removeLocation(loc) {
  const ok = await confirm({ title: 'حذف الموقع', message: `هل تريد حذف الموقع "${loc.code}"؟`, confirmText: 'حذف', danger: true });
  if (!ok) return;
  try {
    await warehouseService.removeLocation(route.params.id, loc._id);
    toast.success('تم حذف الموقع');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حذف الموقع');
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="warehouse">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <router-link to="/warehouses" class="text-sm text-primary-600 hover:underline">← المخازن</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ warehouse.name }} ({{ warehouse.code }})</h1>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="card p-4 lg:col-span-1 space-y-2 text-sm">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">بيانات المخزن</h3>
          <p><span class="text-slate-400">العنوان:</span> {{ warehouse.address || '—' }}</p>
          <p><span class="text-slate-400">الهاتف:</span> {{ warehouse.phone || '—' }}</p>
          <p><span class="text-slate-400">المسؤول:</span> {{ warehouse.manager?.fullName || '—' }}</p>
          <p><span class="text-slate-400">ملاحظات:</span> {{ warehouse.notes || '—' }}</p>
        </div>

        <div class="card p-4 lg:col-span-2">
          <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">مواقع التخزين (Zone / Aisle / Rack / Shelf)</h3>

          <form v-if="auth.can('warehouses.edit')" class="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-4" @submit.prevent="addLocation">
            <input v-model="form.zone" class="input" placeholder="Zone" />
            <input v-model="form.aisle" class="input" placeholder="Aisle" />
            <input v-model="form.rack" class="input" placeholder="Rack" />
            <input v-model="form.shelf" class="input" placeholder="Shelf" />
            <button type="submit" class="btn-primary col-span-4 sm:col-span-1" :disabled="adding">إضافة</button>
          </form>

          <EmptyState v-if="!locations.length" title="لا توجد مواقع بعد" />
          <div v-else class="flex flex-wrap gap-2">
            <span
              v-for="loc in locations"
              :key="loc._id"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-mono"
            >
              {{ loc.code }}
              <button v-if="auth.can('warehouses.edit')" class="text-red-500 hover:text-red-700" @click="removeLocation(loc)">×</button>
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
