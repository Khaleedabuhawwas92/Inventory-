<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useConfirm } from '@/composables/useConfirm';
import platformService from '@/services/platformService';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';

import OverviewTab from '@/components/organization/OverviewTab.vue';
import WarehousesTab from '@/components/organization/WarehousesTab.vue';
import UsersTab from '@/components/organization/UsersTab.vue';
import ProductsTab from '@/components/organization/ProductsTab.vue';
import MovementsTab from '@/components/organization/MovementsTab.vue';
import InvitationsTab from '@/components/organization/InvitationsTab.vue';
import AuditTab from '@/components/organization/AuditTab.vue';
import SettingsTab from '@/components/organization/SettingsTab.vue';
import ManagementTab from '@/components/organization/ManagementTab.vue';
import SubscriptionTab from '@/components/organization/SubscriptionTab.vue';
import FeaturesTab from '@/components/organization/FeaturesTab.vue';
import SecurityTab from '@/components/organization/SecurityTab.vue';
import NotesTab from '@/components/organization/NotesTab.vue';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();
const organizationId = route.params.id;

const loading = ref(true);
const data = ref(null);

const TABS = [
  { key: 'overview', title: 'نظرة عامة', component: OverviewTab },
  { key: 'warehouses', title: 'المخازن', component: WarehousesTab },
  { key: 'users', title: 'المستخدمون', component: UsersTab },
  { key: 'products', title: 'الأصناف', component: ProductsTab },
  { key: 'movements', title: 'حركة المخزون', component: MovementsTab },
  { key: 'invitations', title: 'الدعوات', component: InvitationsTab },
  { key: 'audit', title: 'النشاط والسجل', component: AuditTab },
  { key: 'settings', title: 'إعدادات المؤسسة', component: SettingsTab },
  { key: 'management', title: 'إدارة المؤسسة', component: ManagementTab },
  { key: 'subscription', title: 'الاشتراك والحدود', component: SubscriptionTab },
  { key: 'features', title: 'الميزات', component: FeaturesTab },
  { key: 'security', title: 'الأمان والجلسات', component: SecurityTab },
  { key: 'notes', title: 'ملاحظات الإدارة', component: NotesTab },
];
const activeTab = ref('overview');
const activeComponent = computed(() => TABS.find((t) => t.key === activeTab.value)?.component);

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}

async function load() {
  loading.value = true;
  try {
    const { data: res } = await platformService.organization(organizationId);
    data.value = res.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'تعذر تحميل بيانات المؤسسة');
  } finally {
    loading.value = false;
  }
}

async function toggleStatus() {
  const org = data.value.organization;
  const disabling = org.status === 'active';
  const ok = await confirm({
    title: disabling ? 'تعليق المؤسسة' : 'تفعيل المؤسسة',
    message: disabling
      ? 'لن يتمكن أي مستخدم في هذه المؤسسة من تسجيل الدخول. بيانات المؤسسة تبقى محفوظة بالكامل ولا يتم حذف أي شيء.'
      : 'سيتمكن مستخدمو هذه المؤسسة من تسجيل الدخول مجدداً.',
    confirmText: disabling ? 'تعليق' : 'تفعيل',
    danger: disabling,
  });
  if (!ok) return;
  try {
    await platformService.setOrganizationStatus(org._id, disabling ? 'suspended' : 'active');
    toast.success(disabling ? 'تم تعليق المؤسسة' : 'تم تفعيل المؤسسة');
    load();
  } catch (err) {
    toast.error(err.response?.data?.message || 'حدث خطأ ما');
  }
}

onMounted(load);
</script>

<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="data">
      <!-- Header -->
      <div class="card p-5 mb-6">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div class="flex items-center gap-3">
            <img
              v-if="data.company?.logo"
              :src="resolveAssetUrl(data.company.logo)"
              class="w-14 h-14 rounded-xl object-cover"
            />
            <div v-else class="w-14 h-14 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xl">
              {{ (data.organization.name || 'م')[0] }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">{{ data.organization.name }}</h1>
                <StatusBadge :status="data.organization.status" />
              </div>
              <p class="text-xs text-slate-400 mt-0.5">{{ data.organization._id }}</p>
              <p class="text-xs text-slate-400">
                أُنشئت {{ fmtDate(data.organization.createdAt) }} · آخر نشاط {{ fmtDate(data.lastActivity) }}
              </p>
            </div>
          </div>

          <!-- إدارة المؤسسة: clearly separated administrative controls -->
          <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <p class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">إدارة المؤسسة</p>
            <button
              class="btn-outline !px-3 !py-1.5 text-xs"
              :class="data.organization.status === 'active' ? 'text-red-600' : 'text-green-600'"
              @click="toggleStatus"
            >
              {{ data.organization.status === 'active' ? 'تعطيل المؤسسة' : 'تفعيل المؤسسة' }}
            </button>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-sm">
          <div><span class="text-slate-400">المالك: </span>{{ data.owner?.fullName || '—' }} ({{ data.owner?.username || '—' }})</div>
          <div><span class="text-slate-400">الهاتف: </span>{{ data.company?.phone || '—' }}</div>
          <div><span class="text-slate-400">البريد: </span>{{ data.company?.email || '—' }}</div>
          <div><span class="text-slate-400">العنوان: </span>{{ data.company?.address || '—' }}</div>
          <div v-if="data.company?.taxNumber"><span class="text-slate-400">الرقم الضريبي: </span>{{ data.company.taxNumber }}</div>
          <div><span class="text-slate-400">دعوات مفتوحة: </span>{{ data.invitationsCount }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 mb-4">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="activeTab === tab.key
            ? 'border-slate-800 dark:border-slate-300 text-slate-800 dark:text-slate-100'
            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'"
          @click="activeTab = tab.key"
        >
          {{ tab.title }}
        </button>
      </div>

      <KeepAlive>
        <component
          :is="activeComponent"
          :organization-id="organizationId"
          :organization="data.organization"
          :company="data.company"
          :owner="data.owner"
          @refresh="load"
        />
      </KeepAlive>
    </template>
  </div>
</template>
