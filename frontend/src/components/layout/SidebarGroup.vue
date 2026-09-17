<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import SidebarLink from './SidebarLink.vue';

const props = defineProps({
  item: { type: Object, required: true },
});

const route = useRoute();
const containsActive = computed(() =>
  props.item.children?.some((c) => route.path.startsWith(c.to))
);
const open = ref(containsActive.value);
</script>

<template>
  <div>
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
      :class="containsActive
        ? 'text-primary-700 dark:text-primary-400'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'"
      @click="open = !open"
    >
      <span class="flex items-center gap-3">
        <span class="w-2 h-2 rounded-full shrink-0" :class="containsActive ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'" />
        {{ item.title }}
      </span>
      <svg
        class="w-4 h-4 shrink-0 transition-transform"
        :class="{ '-rotate-90': !open }"
        fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </button>
    <div v-show="open" class="mt-1 mr-5 flex flex-col gap-1 border-r border-slate-200 dark:border-slate-700 pr-3">
      <SidebarLink v-for="child in item.children" :key="child.to" :item="child" />
    </div>
  </div>
</template>
