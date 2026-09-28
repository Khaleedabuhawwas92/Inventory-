<script setup>
import { onMounted } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const ui = useUiStore();
const auth = useAuthStore();

onMounted(() => {
  ui.initTheme();
  auth.initSession();
});
</script>

<template>
  <router-view />
  <ConfirmDialog />
</template>
