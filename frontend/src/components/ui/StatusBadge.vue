<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, required: true },
});

const MAP = {
  DRAFT: { cls: 'badge-draft', label: 'مسودة' },
  PENDING: { cls: 'badge-pending', label: 'قيد الانتظار' },
  APPROVED: { cls: 'badge-approved', label: 'معتمد' },
  CANCELLED: { cls: 'badge-cancelled', label: 'ملغى' },
  IN_TRANSIT: { cls: 'badge-transit', label: 'قيد النقل' },
  RECEIVED: { cls: 'badge-approved', label: 'مستلم' },
  COUNTING: { cls: 'badge-pending', label: 'قيد العد' },
  REVIEW: { cls: 'badge-transit', label: 'قيد المراجعة' },
  active: { cls: 'badge-approved', label: 'نشط' },
  disabled: { cls: 'badge-cancelled', label: 'معطل' },
  inactive: { cls: 'badge-cancelled', label: 'غير نشط' },
};

const info = computed(() => MAP[props.status] || { cls: 'badge-draft', label: props.status });
</script>

<template>
  <span :class="info.cls">{{ info.label }}</span>
</template>
