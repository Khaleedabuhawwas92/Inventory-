<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import invitationService from '@/services/invitationService';
import roleService from '@/services/roleService';
import warehouseService from '@/services/warehouseService';
import Modal from '@/components/ui/Modal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

const toast = useToast();
const confirm = useConfirm();

const items = ref([]);
const roles = ref([]);
const warehouses = ref([]);
const loading = ref(true);
const meta = ref({ page: 1, totalPages: 1, total: 0 });

const modalOpen = ref(false);
const createdLink = ref('');
const saving = ref(false);
const form = reactive({ role: '', warehouse: '', email: '', expiresInDays: 7 });

async function loadLookups() {
  const [rolesRes, warehousesRes] = await Promise.all([roleService.list(), warehouseService.list()]);
  roles.value = rolesRes.data.data;
  warehouses.value = warehousesRes.data.data;
}

async function loadInvitations(page = 1) {
  loading.value = true;
  try {
    const { data } = await invitationService.list({ page });
    items.value = data.data;
    meta.value = data.meta;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل الدعوات');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.role = roles.value[0]?._id || '';
  form.warehouse = '';
  form.email = '';
  form.expiresInDays = 7;
  createdLink.value = '';
  modalOpen.value = true;
}

async function submitForm() {
  saving.value = true;
  try {
    const { data } = await invitationService.create({
      role: form.role,
      warehouse: form.warehouse || null,
      email: form.email || undefined,
      expiresInDays: form.expiresInDays,
    });
    createdLink.value = `${window.location.origin}/join/${data.data.code}`;
    toast.success('تم إنشاء رابط الدعوة');
    loadInvitations(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ أثناء الإنشاء');
  } finally {
    saving.value = false;
  }
}

async function copyLink(inv) {
  const link = `${window.location.origin}/join/${inv.code}`;
  try {
    await navigator.clipboard.writeText(link);
    toast.success('تم نسخ رابط الدعوة');
  } catch (err) {
    toast.error('تعذر نسخ الرابط');
  }
}

async function revokeInvitation(inv) {
  const ok = await confirm({
    title: 'إلغاء الدعوة',
    message: 'هل أنت متأكد من إلغاء رابط هذه الدعوة؟ لن يعود صالحاً للاستخدام.',
    confirmText: 'إلغاء الدعوة',
    danger: true,
  });
  if (!ok) return;
  try {
    await invitationService.revoke(inv._id);
    toast.success('تم إلغاء الدعوة');
    loadInvitations(meta.value.page);
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر إلغاء الدعوة');
  }
}

function statusLabel(inv) {
  if (inv.usedAt) return 'مستخدمة';
  if (inv.revokedAt || !inv.active) return 'ملغاة';
  if (new Date(inv.expiresAt) < new Date()) return 'منتهية';
  return 'فعّالة';
}

onMounted(async () => {
  await loadLookups();
  await loadInvitations();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">دعوات الانضمام</h1>
      <button class="btn-primary" @click="openCreate">+ دعوة جديدة</button>
    </div>

    <div class="card overflow-x-auto">
      <LoadingSpinner v-if="loading" />
      <EmptyState v-else-if="!items.length" title="لا توجد دعوات" />
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>الدور</th>
            <th>المخزن</th>
            <th>البريد المخصص</th>
            <th>الحالة</th>
            <th>تنتهي في</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in items" :key="inv._id">
            <td>{{ inv.role?.nameAr }}</td>
            <td>{{ inv.warehouse?.name || '—' }}</td>
            <td class="text-xs text-slate-400">{{ inv.email || '—' }}</td>
            <td>{{ statusLabel(inv) }}</td>
            <td class="text-xs text-slate-400">{{ new Date(inv.expiresAt).toLocaleDateString('ar') }}</td>
            <td>
              <div class="flex items-center gap-2 justify-end">
                <button class="btn-outline !px-2 !py-1 text-xs" @click="copyLink(inv)">نسخ الرابط</button>
                <button
                  v-if="statusLabel(inv) === 'فعّالة'"
                  class="btn-outline !px-2 !py-1 text-xs text-red-600"
                  @click="revokeInvitation(inv)"
                >
                  إلغاء
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-if="items.length" :page="meta.page" :total-pages="meta.totalPages" :total="meta.total" @update:page="loadInvitations" />
    </div>

    <Modal v-model="modalOpen" title="دعوة جديدة">
      <form v-if="!createdLink" class="space-y-3" @submit.prevent="submitForm">
        <div>
          <label class="label">الدور</label>
          <select v-model="form.role" class="input" required>
            <option v-for="r in roles" :key="r._id" :value="r._id">{{ r.nameAr }}</option>
          </select>
        </div>
        <div>
          <label class="label">المخزن المخصص</label>
          <select v-model="form.warehouse" class="input">
            <option value="">بدون تخصيص</option>
            <option v-for="w in warehouses" :key="w._id" :value="w._id">{{ w.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">البريد الإلكتروني (اختياري — لتقييد الدعوة بشخص واحد)</label>
          <input v-model="form.email" type="email" class="input" />
        </div>
        <div>
          <label class="label">مدة الصلاحية (أيام)</label>
          <input v-model.number="form.expiresInDays" type="number" min="1" max="90" class="input" />
        </div>
      </form>
      <div v-else class="space-y-3">
        <p class="text-sm text-slate-500 dark:text-slate-400">تم إنشاء رابط الدعوة:</p>
        <div class="flex items-center gap-2">
          <input :value="createdLink" class="input flex-1" readonly />
          <button type="button" class="btn-outline !px-3" @click="navigator.clipboard.writeText(createdLink); toast.success('تم النسخ')">نسخ</button>
        </div>
      </div>
      <template #footer>
        <button v-if="!createdLink" class="btn-secondary" @click="modalOpen = false">إلغاء</button>
        <button v-if="!createdLink" class="btn-primary" :disabled="saving" @click="submitForm">{{ saving ? 'جاري الإنشاء...' : 'إنشاء' }}</button>
        <button v-else class="btn-primary" @click="modalOpen = false">تم</button>
      </template>
    </Modal>
  </div>
</template>
