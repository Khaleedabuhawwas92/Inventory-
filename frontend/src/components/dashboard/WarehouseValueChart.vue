<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, required: true }, // [{ warehouse: { name }, value }]
});

const maxValue = computed(() => Math.max(1, ...props.data.map((d) => d.value)));
</script>

<template>
  <div class="space-y-3">
    <div v-for="row in data" :key="row.warehouse?.name" class="flex items-center gap-3">
      <span class="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400 truncate">{{ row.warehouse?.name }}</span>
      <div class="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div
          class="h-full rounded-full bg-primary-600 transition-all duration-500"
          :style="{ width: `${(row.value / maxValue) * 100}%` }"
        />
      </div>
      <span class="w-20 shrink-0 text-xs font-medium text-slate-700 dark:text-slate-200 text-left">{{ row.value.toFixed(0) }}</span>
    </div>
  </div>
</template>
