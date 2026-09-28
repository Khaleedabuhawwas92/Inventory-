<script setup>
defineProps({
  organization: { type: Object, required: true },
  company: { type: Object, default: null },
  owner: { type: Object, default: null },
});

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('ar') : '—';
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="card p-4">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">بيانات المؤسسة</h3>
      <dl class="text-sm space-y-2">
        <div class="flex justify-between"><dt class="text-slate-400">الاسم</dt><dd>{{ organization.name }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">المعرّف</dt><dd class="font-mono text-xs">{{ organization._id }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">الحالة</dt><dd>{{ organization.status === 'active' ? 'نشطة' : 'معلّقة' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">تاريخ الإنشاء</dt><dd>{{ fmtDate(organization.createdAt) }}</dd></div>
      </dl>
    </div>

    <div class="card p-4">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">معلومات الشركة</h3>
      <dl class="text-sm space-y-2">
        <div class="flex justify-between"><dt class="text-slate-400">العنوان</dt><dd>{{ company?.address || '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">الهاتف</dt><dd>{{ company?.phone || '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">البريد الإلكتروني</dt><dd>{{ company?.email || '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">الرقم الضريبي</dt><dd>{{ company?.taxNumber || '—' }}</dd></div>
      </dl>
    </div>

    <div class="card p-4 lg:col-span-2">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-3">المالك / المدير</h3>
      <dl class="text-sm space-y-2">
        <div class="flex justify-between"><dt class="text-slate-400">الاسم الكامل</dt><dd>{{ owner?.fullName || '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">اسم المستخدم</dt><dd>{{ owner?.username || '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">البريد الإلكتروني</dt><dd>{{ owner?.email || '—' }}</dd></div>
      </dl>
      <p class="text-xs text-slate-400 mt-3">
        هذه معلومات للعرض فقط ضمن لوحة مدير المنصة. تعديل إعدادات المؤسسة يتم من داخل تطبيق المؤسسة نفسه بواسطة مدير المؤسسة.
      </p>
    </div>
  </div>
</template>
