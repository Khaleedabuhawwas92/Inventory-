<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg | xl
});
const emit = defineEmits(['update:modelValue']);

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="close">
      <div class="card w-full flex flex-col max-h-[90vh]" :class="sizeClass[size] || sizeClass.md">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h3 class="font-bold text-slate-800 dark:text-slate-100">{{ title }}</h3>
          <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" @click="close">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-5 overflow-y-auto">
          <slot />
        </div>
        <div v-if="$slots.footer" class="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3 shrink-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
