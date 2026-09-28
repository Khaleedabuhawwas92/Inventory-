<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const props = defineProps({
  organizationId: { type: String, required: true },
});

const toast = useToast();
const loading = ref(true);
const stats = ref(null);

const CARDS = [
  { key: 'warehousesCount', label: 'المخازن' },
  { key: 'usersCount', label: 'المستخدمون' },
  { key: 'activeUsersCount', label: 'المستخدمون النشطون' },
  { key: 'productsCount', label: 'الأصناف' },
  { key: 'totalStockQuantity', label: 'إجمالي الكمية' },
  { key: 'totalStockValue', label: 'قيمة المخزون', money: true },
  { key: 'lowStockCount', label: 'أصناف منخفضة المخزون', warn: true },
  { key: 'outOfStockCount', label: 'أصناف نافدة', danger: true },
  { key: 'movementsCount', label: 'حركات المخزون' },
  { key: 'invitationsCount', label: 'دعوات مفتوحة' },
];

async function load() {
  loading.value = true;
  try {
    const { data } = await platformService.organizationStats(props.organizationId);
    stats.value = data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل إحصائيات المؤسسة');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <div v-else-if="stats" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div v-for="card in CARDS" :key="card.key" class="card p-4">
        <p class="text-xs text-slate-400 mb-1">{{ card.label }}</p>
        <p
          class="text-2xl font-bold"
          :class="card.danger && stats[card.key] > 0 ? 'text-red-600' : card.warn && stats[card.key] > 0 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'"
        >
          {{ card.money ? Number(stats[card.key]).toLocaleString('ar') : stats[card.key] }}
        </p>
      </div>
    </div>
  </div>
</template>
