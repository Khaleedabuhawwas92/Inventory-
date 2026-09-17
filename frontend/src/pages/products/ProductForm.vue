<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import productService from '@/services/productService';
import categoryService from '@/services/categoryService';
import unitService from '@/services/unitService';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.id);
const categories = ref([]);
const units = ref([]);
const saving = ref(false);
const loading = ref(isEdit.value);
const imageFile = ref(null);
const imagePreview = ref(null);
const productId = ref(null);

const form = reactive({
  barcode: '', nameAr: '', nameEn: '', category: '', unit: '', brand: '', description: '',
  purchasePrice: 0, salePrice: 0, minStock: 0, maxStock: 0, active: true,
});

async function loadLookups() {
  const [catRes, unitRes] = await Promise.all([categoryService.list(), unitService.list()]);
  categories.value = catRes.data.data;
  units.value = unitRes.data.data;
}

async function loadProduct() {
  const { data } = await productService.get(route.params.id);
  const p = data.data;
  productId.value = p._id;
  form.barcode = p.barcode || '';
  form.nameAr = p.nameAr;
  form.nameEn = p.nameEn || '';
  form.category = p.category?._id || '';
  form.unit = p.unit?._id || '';
  form.brand = p.brand || '';
  form.description = p.description || '';
  form.purchasePrice = p.purchasePrice;
  form.salePrice = p.salePrice;
  form.minStock = p.minStock;
  form.maxStock = p.maxStock;
  form.active = p.active;
  imagePreview.value = p.image;
}

function onImageSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  imageFile.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

async function submit() {
  if (!form.nameAr || !form.category || !form.unit) {
    toast.error('الاسم والتصنيف والوحدة حقول مطلوبة');
    return;
  }
  saving.value = true;
  try {
    let id = productId.value;
    if (isEdit.value) {
      await productService.update(id, form);
      toast.success('تم تحديث الصنف بنجاح');
    } else {
      const { data } = await productService.create(form);
      id = data.data._id;
      toast.success('تم إنشاء الصنف بنجاح');
    }
    if (imageFile.value) {
      await productService.uploadImage(id, imageFile.value);
    }
    router.push(`/products/${id}`);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadLookups();
  if (isEdit.value) {
    await loadProduct();
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <router-link to="/products" class="text-sm text-primary-600 hover:underline">← الأصناف</router-link>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 mb-6">{{ isEdit ? 'تعديل صنف' : 'صنف جديد' }}</h1>

    <div v-if="!loading" class="card p-6 max-w-3xl">
      <form class="space-y-4" @submit.prevent="submit">
        <div class="flex items-center gap-4">
          <img v-if="imagePreview" :src="imagePreview" class="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-600" />
          <div v-else class="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 text-xs">لا صورة</div>
          <div>
            <label class="btn-outline cursor-pointer">
              اختيار صورة
              <input type="file" accept="image/*" class="hidden" @change="onImageSelected" />
            </label>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="label">الاسم بالعربية *</label>
            <input v-model="form.nameAr" class="input" required />
          </div>
          <div>
            <label class="label">الاسم بالإنجليزية</label>
            <input v-model="form.nameEn" class="input" />
          </div>
        </div>

        <div class="grid sm:grid-cols-3 gap-4">
          <div>
            <label class="label">التصنيف *</label>
            <select v-model="form.category" class="input" required>
              <option value="" disabled>اختر التصنيف</option>
              <option v-for="c in categories" :key="c._id" :value="c._id">{{ c.nameAr }}</option>
            </select>
          </div>
          <div>
            <label class="label">الوحدة *</label>
            <select v-model="form.unit" class="input" required>
              <option value="" disabled>اختر الوحدة</option>
              <option v-for="u in units" :key="u._id" :value="u._id">{{ u.nameAr }} ({{ u.shortCode }})</option>
            </select>
          </div>
          <div>
            <label class="label">العلامة التجارية</label>
            <input v-model="form.brand" class="input" />
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="label">الباركود</label>
            <input v-model="form.barcode" class="input" placeholder="اتركه فارغاً إذا لم يتوفر" />
          </div>
          <div v-if="isEdit">
            <label class="label">الحالة</label>
            <select v-model="form.active" class="input">
              <option :value="true">نشط</option>
              <option :value="false">غير نشط</option>
            </select>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="label">سعر الشراء</label>
            <input v-model.number="form.purchasePrice" type="number" min="0" step="0.01" class="input" />
          </div>
          <div>
            <label class="label">سعر البيع</label>
            <input v-model.number="form.salePrice" type="number" min="0" step="0.01" class="input" />
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="label">الحد الأدنى للمخزون</label>
            <input v-model.number="form.minStock" type="number" min="0" class="input" />
          </div>
          <div>
            <label class="label">الحد الأقصى للمخزون</label>
            <input v-model.number="form.maxStock" type="number" min="0" class="input" />
          </div>
        </div>

        <div>
          <label class="label">الوصف</label>
          <textarea v-model="form.description" class="input" rows="3" />
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button type="button" class="btn-secondary" @click="router.back()">إلغاء</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'جاري الحفظ...' : 'حفظ' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
