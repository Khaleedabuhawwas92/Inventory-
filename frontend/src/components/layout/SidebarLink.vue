<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps({
  item: { type: Object, required: true },
});

const route = useRoute();
const isActive = computed(() => props.item.to && route.path.startsWith(props.item.to));
</script>

<template>
  <router-link
    :to="item.to"
    class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
    :class="isActive
      ? 'bg-primary-600 text-white shadow-sm'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'"
  >
    <span class="w-2 h-2 rounded-full shrink-0" :class="isActive ? 'bg-white' : 'bg-slate-300 dark:bg-slate-600'" />
    <span class="truncate">{{ item.title }}</span>
  </router-link>
</template>
