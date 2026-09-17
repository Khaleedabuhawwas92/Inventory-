<script setup>
import { onMounted, ref, watch } from 'vue';
import JsBarcode from 'jsbarcode';

const props = defineProps({
  value: { type: String, required: true },
  height: { type: Number, default: 50 },
  width: { type: Number, default: 1.6 },
  fontSize: { type: Number, default: 12 },
  displayValue: { type: Boolean, default: true },
});

const svgRef = ref(null);

function render() {
  if (!svgRef.value || !props.value) return;
  try {
    JsBarcode(svgRef.value, props.value, {
      format: 'CODE128',
      height: props.height,
      width: props.width,
      fontSize: props.fontSize,
      displayValue: props.displayValue,
      margin: 4,
      background: 'transparent',
      lineColor: '#0f172a',
    });
  } catch (err) {
    // Invalid barcode value for the chosen symbology — render nothing rather than crash.
  }
}

onMounted(render);
watch(() => [props.value, props.height, props.width], render);
</script>

<template>
  <svg ref="svgRef" class="max-w-full" />
</template>
