<script setup>
import { useConfirmStore } from '@/stores/confirm';

const store = useConfirmStore();
</script>

<template>
  <Teleport to="body">
    <div v-if="store.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" @click.self="store.cancel()">
      <div class="card w-full max-w-sm p-6 animate-in">
        <h3 class="font-bold text-slate-800 dark:text-slate-100 mb-2">{{ store.title }}</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ store.message }}</p>
        <div class="flex items-center gap-3">
          <button class="btn-secondary flex-1" @click="store.cancel()">{{ store.cancelText }}</button>
          <button :class="store.danger ? 'btn-danger flex-1' : 'btn-primary flex-1'" @click="store.confirm()">
            {{ store.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
