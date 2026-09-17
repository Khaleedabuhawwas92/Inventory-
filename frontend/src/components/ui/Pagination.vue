<script setup>
import { computed } from 'vue';

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  total: { type: Number, default: 0 },
});
const emit = defineEmits(['update:page']);

const pages = computed(() => {
  const range = [];
  const start = Math.max(1, props.page - 2);
  const end = Math.min(props.totalPages, start + 4);
  for (let i = start; i <= end; i += 1) range.push(i);
  return range;
});

function go(p) {
  if (p < 1 || p > props.totalPages || p === props.page) return;
  emit('update:page', p);
}
</script>

<template>
  <div class="flex items-center justify-between flex-wrap gap-3 px-1 py-3 text-sm text-slate-500 dark:text-slate-400">
    <span>إجمالي النتائج: {{ total }}</span>
    <div class="flex items-center gap-1">
      <button class="btn-outline !px-2 !py-1" :disabled="page <= 1" @click="go(page - 1)">السابق</button>
      <button
        v-for="p in pages"
        :key="p"
        class="w-8 h-8 rounded-lg text-sm font-medium"
        :class="p === page ? 'bg-primary-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'"
        @click="go(p)"
      >
        {{ p }}
      </button>
      <button class="btn-outline !px-2 !py-1" :disabled="page >= totalPages" @click="go(page + 1)">التالي</button>
    </div>
  </div>
</template>
