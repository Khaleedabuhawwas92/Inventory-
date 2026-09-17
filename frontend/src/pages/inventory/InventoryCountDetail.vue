<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import inventoryCountService from '@/services/inventoryCountService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { safePrint } from '@/utils/print';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();

const doc = ref(null);
const loading = ref(true);
const busy = ref(false);
const localCounts = ref({}); // productId -> physicalQty (draft edits before saving)

const countedCount = computed(() => doc.value?.items.filter((i) => i.physicalQty !== null).length || 0);
const totalDifferenceValue = computed(() =>
  doc.value?.items.reduce((sum, i) => sum + (i.differenceValue || 0), 0) || 0
);

async function load() {
  loading.value = true;
  try {
    const { data } = await inventoryCountService.get(route.params.id);
    doc.value = data.data;
    localCounts.value = {};
    doc.value.items.forEach((i) => {
      localCounts.value[i.product._id] = i.physicalQty ?? i.systemQty;
    });
  } catch (err) {
    toast.error('تعذر تحميل جلسة الجرد');
  } finally {
    loading.value = false;
  }
}

async function saveProgress() {
  busy.value = true;
  try {
    const items = Object.entries(localCounts.value).map(([product, physicalQty]) => ({ product, physicalQty }));
    await inventoryCountService.recordCounts(doc.value._id, items);
    toast.success('تم حفظ الكميات المعدودة');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر حفظ الكميات');
  } finally {
    busy.value = false;
  }
}

async function submitForReview() {
  await saveProgress();
  busy.value = true;
  try {
    await inventoryCountService.submit(doc.value._id);
    toast.success('تم إرسال الجلسة للمراجعة');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إرسال الجلسة للمراجعة');
  } finally {
    busy.value = false;
  }
}

async function approveDoc() {
  const ok = await confirm({
    title: 'اعتماد الجرد',
    message: 'سيتم إنشاء تسويات مخزون تلقائية بناءً على الفروقات وتحديث المخزون فوراً. هل أنت متأكد؟',
    confirmText: 'اعتماد',
  });
  if (!ok) return;
  busy.value = true;
  try {
    await inventoryCountService.approve(doc.value._id);
    toast.success('تم اعتماد الجرد وتحديث المخزون');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر اعتماد الجرد');
  } finally {
    busy.value = false;
  }
}

async function cancelDoc() {
  const ok = await confirm({ title: 'إلغاء الجرد', message: 'هل أنت متأكد من إلغاء جلسة الجرد؟', confirmText: 'إلغاء', danger: true });
  if (!ok) return;
  busy.value = true;
  try {
    await inventoryCountService.cancel(doc.value._id);
    toast.success('تم إلغاء جلسة الجرد');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إلغاء الجلسة');
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="doc">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6 print:hidden">
        <div>
          <router-link to="/inventory" class="text-sm text-primary-600 hover:underline">← الجرد</router-link>
          <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">جلسة جرد {{ doc.docNo }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-outline" @click="safePrint()">طباعة</button>
          <template v-if="doc.status === 'COUNTING' && auth.can('inventory.create')">
            <button class="btn-secondary" :disabled="busy" @click="saveProgress">حفظ التقدم</button>
            <button class="btn-primary" :disabled="busy" @click="submitForReview">إرسال للمراجعة</button>
          </template>
          <template v-if="doc.status === 'REVIEW'">
            <button v-if="auth.can('inventory.approve')" class="btn-primary" :disabled="busy" @click="approveDoc">اعتماد الجرد</button>
          </template>
          <button v-if="!['APPROVED', 'CANCELLED'].includes(doc.status) && auth.can('inventory.create')" class="btn-danger" :disabled="busy" @click="cancelDoc">إلغاء</button>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <StatusBadge :status="doc.status" />
          <span class="text-sm text-slate-400">{{ new Date(doc.date).toLocaleDateString('ar') }}</span>
        </div>
        <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-6">
          <div><dt class="text-slate-400">المخزن</dt><dd class="font-medium">{{ doc.warehouse?.name }}</dd></div>
          <div><dt class="text-slate-400">التصنيف</dt><dd class="font-medium">{{ doc.categoryFilter?.nameAr || 'كل التصنيفات' }}</dd></div>
          <div v-if="doc.status === 'COUNTING'"><dt class="text-slate-400">تقدم العد</dt><dd class="font-medium">{{ countedCount }} / {{ doc.items.length }}</dd></div>
          <div v-if="['REVIEW', 'APPROVED'].includes(doc.status)"><dt class="text-slate-400">إجمالي فرق القيمة</dt>
            <dd class="font-medium" :class="totalDifferenceValue < 0 ? 'text-red-600' : totalDifferenceValue > 0 ? 'text-green-600' : ''">
              {{ totalDifferenceValue.toFixed(2) }}
            </dd>
          </div>
        </dl>

        <table class="table-base">
          <thead>
            <tr>
              <th>الصنف</th><th>SKU</th><th>الكمية بالنظام</th>
              <th>{{ doc.status === 'COUNTING' ? 'الكمية الفعلية' : 'الكمية المعدودة' }}</th>
              <th v-if="doc.status !== 'COUNTING'">الفرق</th>
              <th v-if="['REVIEW', 'APPROVED'].includes(doc.status)">فرق القيمة</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in doc.items" :key="item.product._id">
              <td class="font-medium">{{ item.product?.nameAr }}</td>
              <td class="font-mono text-xs">{{ item.product?.sku }}</td>
              <td>{{ item.systemQty }}</td>
              <td>
                <input
                  v-if="doc.status === 'COUNTING'"
                  v-model.number="localCounts[item.product._id]"
                  type="number" min="0" class="input !w-24"
                />
                <span v-else>{{ item.physicalQty }}</span>
              </td>
              <td v-if="doc.status !== 'COUNTING'" :class="item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : ''">
                {{ item.difference > 0 ? '+' : '' }}{{ item.difference }}
              </td>
              <td v-if="['REVIEW', 'APPROVED'].includes(doc.status)" :class="item.differenceValue > 0 ? 'text-green-600' : item.differenceValue < 0 ? 'text-red-600' : ''">
                {{ item.differenceValue?.toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="doc.notes" class="text-sm text-slate-500 dark:text-slate-400 mt-4">ملاحظات: {{ doc.notes }}</p>
      </div>
    </template>
  </div>
</template>
