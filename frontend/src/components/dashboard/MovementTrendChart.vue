<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, required: true }, // [{ date, in, out }]
});

const WIDTH = 560;
const HEIGHT = 200;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_SIDE = 8;

const maxValue = computed(() => Math.max(1, ...props.data.flatMap((d) => [d.in, d.out])));

const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
const groupWidth = computed(() => (WIDTH - PAD_SIDE * 2) / props.data.length);
const barWidth = computed(() => Math.min(18, groupWidth.value / 3));

function barHeight(value) {
  return maxValue.value ? (value / maxValue.value) * chartHeight : 0;
}

function formatDay(dateStr) {
  // dateStr is a "YYYY-MM-DD" UTC calendar day from the backend; force the
  // weekday computation into UTC too, otherwise a negative timezone offset
  // rolls the displayed weekday back by one day from what the date actually is.
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar', { weekday: 'short', timeZone: 'UTC' });
}
</script>

<template>
  <div>
    <div class="flex items-center gap-4 mb-2 text-xs text-slate-500 dark:text-slate-400">
      <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-green-500" /> إدخال</span>
      <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-500" /> إخراج</span>
    </div>
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="w-full h-auto" role="img" aria-label="حركة المخزون آخر 7 أيام">
      <line :x1="PAD_SIDE" :y1="HEIGHT - PAD_BOTTOM" :x2="WIDTH - PAD_SIDE" :y2="HEIGHT - PAD_BOTTOM" class="stroke-slate-200 dark:stroke-slate-700" stroke-width="1" />
      <g v-for="(d, i) in data" :key="d.date">
        <rect
          :x="PAD_SIDE + i * groupWidth + groupWidth / 2 - barWidth - 2"
          :y="HEIGHT - PAD_BOTTOM - barHeight(d.in)"
          :width="barWidth" :height="barHeight(d.in)" rx="3"
          class="fill-green-500"
        />
        <rect
          :x="PAD_SIDE + i * groupWidth + groupWidth / 2 + 2"
          :y="HEIGHT - PAD_BOTTOM - barHeight(d.out)"
          :width="barWidth" :height="barHeight(d.out)" rx="3"
          class="fill-red-500"
        />
        <text
          :x="PAD_SIDE + i * groupWidth + groupWidth / 2"
          :y="HEIGHT - 8"
          text-anchor="middle"
          class="fill-slate-400 dark:fill-slate-500"
          font-size="10"
        >{{ formatDay(d.date) }}</text>
      </g>
    </svg>
  </div>
</template>
