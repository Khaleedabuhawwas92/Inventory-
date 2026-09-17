<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import productService from '@/services/productService';
import settingsService from '@/services/settingsService';
import BarcodeImage from '@/components/ui/BarcodeImage.vue';
import { safePrint } from '@/utils/print';

const route = useRoute();
const toast = useToast();

const companyName = ref('');
const searchQuery = ref('');
const searchResults = ref([]);
const selectedProduct = ref(null);

const LABEL_SIZES = [
  { key: 'small', label: 'صغير (40×25 مم)', width: 40, height: 25 },
  { key: 'medium', label: 'متوسط (50×30 مم)', width: 50, height: 30 },
  { key: 'large', label: 'كبير (60×40 مم)', width: 60, height: 40 },
];

const form = reactive({ quantity: 10, sizeKey: 'medium', showPrice: true });

const size = computed(() => LABEL_SIZES.find((s) => s.key === form.sizeKey));
const labels = computed(() => (selectedProduct.value ? Array.from({ length: form.quantity }) : []));

let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  if (!searchQuery.value.trim()) { searchResults.value = []; return; }
  searchTimer = setTimeout(async () => {
    const { data } = await productService.list({ search: searchQuery.value, limit: 8, active: 'true' });
    searchResults.value = data.data;
  }, 300);
}

function selectProduct(p) {
  if (!p.barcode) {
    toast.error('هذا الصنف لا يملك باركوداً بعد');
    return;
  }
  selectedProduct.value = p;
  searchQuery.value = '';
  searchResults.value = [];
}

async function loadProductById(id) {
  try {
    const { data } = await productService.get(id);
    if (!data.data.barcode) {
      toast.error('هذا الصنف لا يملك باركوداً بعد');
      return;
    }
    selectedProduct.value = data.data;
  } catch (err) {
    toast.error('تعذر تحميل بيانات الصنف');
  }
}

onMounted(async () => {
  try {
    const { data } = await settingsService.publicInfo();
    companyName.value = data.data.company.name;
  } catch (err) {
    // Optional branding — label still works without it.
  }
  if (route.query.productId) await loadProductById(route.query.productId);
});
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 print:hidden">طباعة ملصقات الباركود</h1>

    <div class="card p-6 mb-4 print:hidden">
      <div class="grid sm:grid-cols-2 gap-4 mb-4">
        <div class="relative">
          <label class="label">اختر الصنف</label>
          <input v-model="searchQuery" class="input" placeholder="ابحث بالاسم أو SKU..." @input="onSearchInput" />
          <div v-if="searchResults.length" class="absolute z-10 mt-1 w-full card p-1 max-h-56 overflow-y-auto">
            <button
              v-for="p in searchResults" :key="p._id" type="button"
              class="w-full text-right px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
              @click="selectProduct(p)"
            >{{ p.nameAr }} <span class="text-xs text-slate-400">({{ p.sku }})</span></button>
          </div>
          <p v-if="selectedProduct" class="text-sm text-slate-500 dark:text-slate-400 mt-2">الصنف المحدد: <strong>{{ selectedProduct.nameAr }}</strong></p>
        </div>
        <div>
          <label class="label">عدد الملصقات</label>
          <input v-model.number="form.quantity" type="number" min="1" max="200" class="input" />
        </div>
        <div>
          <label class="label">حجم الملصق</label>
          <select v-model="form.sizeKey" class="input">
            <option v-for="s in LABEL_SIZES" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2 mt-6">
          <input id="showPrice" v-model="form.showPrice" type="checkbox" class="rounded border-slate-300 text-primary-600" />
          <label for="showPrice" class="text-sm text-slate-600 dark:text-slate-300">إظهار السعر</label>
        </div>
      </div>
      <button class="btn-primary" :disabled="!selectedProduct" @click="safePrint()">طباعة</button>
    </div>

    <!-- ✅ الحاوية الوحيدة التي تظهر عند الطباعة — كل شيء آخر في هذه الصفحة
         (العنوان + بطاقة التحكم) مخفي فعلاً عبر print:hidden أعلاه، والقائمة
         الجانبية/الشريط العلوي مخفيان الآن من MainLayout.vue مركزياً -->
    <div v-if="selectedProduct" id="barcode-print-area" class="label-sheet">
      <div
        v-for="(_, i) in labels" :key="i" class="label-card"
        :style="{ width: size.width + 'mm', height: size.height + 'mm' }"
      >
        <p class="label-company">{{ companyName }}</p>
        <p class="label-name">{{ selectedProduct.nameAr }}</p>
        <p class="label-sku">{{ selectedProduct.sku }}</p>
        <BarcodeImage :value="selectedProduct.barcode" :height="28" :width="1.2" :font-size="9" />
        <p v-if="form.showPrice" class="label-price">{{ selectedProduct.salePrice?.toFixed(2) }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.label-sheet {
  display: flex;
  flex-wrap: wrap;
  gap: 4mm;
}
.label-card {
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
  padding: 2mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: white;
  color: #0f172a;
  overflow: hidden;
  break-inside: avoid;
}
.label-company { font-size: 7px; color: #64748b; margin: 0; }
.label-name { font-size: 9px; font-weight: 700; margin: 0; line-height: 1.1; }
.label-sku { font-size: 7px; color: #64748b; margin: 0; font-family: monospace; }
.label-price { font-size: 9px; font-weight: 700; margin: 0; }

/* ✅ لا يؤثر على العرض العادي للشاشة إطلاقاً — داخل @media print فقط */
@media print {
  #barcode-print-area {
    background: #fff;
    margin: 0;
    padding: 0;
    gap: 3mm;
  }
  .label-card {
    border: 1px solid #000;
    background: #fff;
    box-shadow: none;
  }
}
</style>
