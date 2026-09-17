<script setup>
import { computed, nextTick, ref } from 'vue';
import { useToast } from 'vue-toastification';
import productService from '@/services/productService';

const props = defineProps({
  modelValue: { type: Array, required: true },
  showCost: { type: Boolean, default: false },
  showAvailable: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const toast = useToast();
const barcodeInput = ref('');
const barcodeField = ref(null);
const searchQuery = ref('');
const searchResults = ref([]);
const searching = ref(false);

const total = computed(() =>
  props.modelValue.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitCost || 0), 0)
);

function updateItems(items) {
  emit('update:modelValue', items);
}

function addOrIncrementProduct(product) {
  const items = [...props.modelValue];
  const existing = items.find((i) => i.product === product._id);
  if (existing) {
    existing.quantity += 1;
  } else {
    items.push({
      product: product._id,
      nameAr: product.nameAr,
      sku: product.sku,
      unitLabel: product.unit?.shortCode || '',
      available: product.available ?? null,
      quantity: 1,
      unitCost: product.purchasePrice || 0,
    });
  }
  updateItems(items);
}

async function handleBarcodeEnter() {
  const code = barcodeInput.value.trim();
  if (!code) return;
  try {
    const { data } = await productService.findByBarcode(code);
    addOrIncrementProduct(data.data);
    toast.success(`تمت إضافة ${data.data.nameAr}`);
  } catch (err) {
    toast.error('لم يتم العثور على صنف بهذا الباركود');
  } finally {
    barcodeInput.value = '';
    await nextTick();
    barcodeField.value?.focus();
  }
}

let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      const { data } = await productService.list({ search: searchQuery.value, limit: 8, active: 'true' });
      searchResults.value = data.data;
    } finally {
      searching.value = false;
    }
  }, 300);
}

function selectSearchResult(product) {
  addOrIncrementProduct(product);
  searchQuery.value = '';
  searchResults.value = [];
}

function removeItem(index) {
  const items = [...props.modelValue];
  items.splice(index, 1);
  updateItems(items);
}

function updateQuantity(index, value) {
  const items = [...props.modelValue];
  items[index].quantity = Number(value) || 0;
  updateItems(items);
}

function updateCost(index, value) {
  const items = [...props.modelValue];
  items[index].unitCost = Number(value) || 0;
  updateItems(items);
}
</script>

<template>
  <div>
    <div class="grid sm:grid-cols-2 gap-3 mb-3">
      <div>
        <label class="label">مسح الباركود</label>
        <input
          ref="barcodeField"
          v-model="barcodeInput"
          class="input"
          placeholder="امسح أو أدخل الباركود ثم Enter"
          autofocus
          @keyup.enter="handleBarcodeEnter"
        />
      </div>
      <div class="relative">
        <label class="label">بحث عن صنف بالاسم أو SKU</label>
        <input v-model="searchQuery" class="input" placeholder="اكتب للبحث..." @input="onSearchInput" />
        <div v-if="searchResults.length" class="absolute z-10 mt-1 w-full card p-1 max-h-56 overflow-y-auto">
          <button
            v-for="p in searchResults"
            :key="p._id"
            type="button"
            class="w-full text-right px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
            @click="selectSearchResult(p)"
          >
            {{ p.nameAr }} <span class="text-xs text-slate-400">({{ p.sku }})</span>
          </button>
        </div>
      </div>
    </div>

    <table class="table-base">
      <thead>
        <tr>
          <th>الصنف</th>
          <th v-if="showAvailable">المتوفر</th>
          <th>الكمية</th>
          <th v-if="showCost">تكلفة الوحدة</th>
          <th v-if="showCost">الإجمالي</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!modelValue.length">
          <td :colspan="showCost ? 5 : (showAvailable ? 3 : 2)" class="text-center text-slate-400 py-6">
            لم تتم إضافة أي أصناف بعد — استخدم الباركود أو البحث أعلاه
          </td>
        </tr>
        <tr v-for="(item, index) in modelValue" :key="item.product">
          <td class="font-medium text-slate-700 dark:text-slate-200">
            {{ item.nameAr }}
            <span class="block text-xs text-slate-400 font-mono">{{ item.sku }}</span>
          </td>
          <td v-if="showAvailable">{{ item.available ?? '—' }}</td>
          <td>
            <input
              type="number" min="0.001" step="0.001" class="input !w-24"
              :value="item.quantity" @input="updateQuantity(index, $event.target.value)"
            />
          </td>
          <td v-if="showCost">
            <input
              type="number" min="0" step="0.01" class="input !w-24"
              :value="item.unitCost" @input="updateCost(index, $event.target.value)"
            />
          </td>
          <td v-if="showCost">{{ ((item.quantity || 0) * (item.unitCost || 0)).toFixed(2) }}</td>
          <td>
            <button type="button" class="text-red-500 hover:text-red-700" @click="removeItem(index)">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="showCost && modelValue.length">
        <tr>
          <td :colspan="3" class="text-left font-bold">الإجمالي</td>
          <td class="font-bold">{{ total.toFixed(2) }}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
