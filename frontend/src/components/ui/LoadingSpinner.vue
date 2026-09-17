<script setup>
defineProps({ label: { type: String, default: 'جاري التحميل...' } });
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
    <svg class="w-8 h-8 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
    <p class="text-sm">{{ label }}</p>
  </div>
</template>
