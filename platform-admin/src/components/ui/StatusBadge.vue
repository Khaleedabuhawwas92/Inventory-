<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, required: true },
});

const MAP = {
  active: { cls: 'badge-approved', label: 'نشط' },
  disabled: { cls: 'badge-cancelled', label: 'معطل' },
  inactive: { cls: 'badge-cancelled', label: 'غير نشط' },
  suspended: { cls: 'badge-cancelled', label: 'معلّقة' },
  trial_expired: { cls: 'badge-pending', label: 'انتهت التجربة' },
  used: { cls: 'badge-approved', label: 'مستخدمة' },
  revoked: { cls: 'badge-cancelled', label: 'ملغاة' },
  expired: { cls: 'badge-draft', label: 'منتهية' },
};

const info = computed(() => MAP[props.status] || { cls: 'badge-draft', label: props.status });
</script>

<template>
  <span :class="info.cls">{{ info.label }}</span>
</template>
