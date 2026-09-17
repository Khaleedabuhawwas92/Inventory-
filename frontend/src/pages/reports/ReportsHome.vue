<script setup>
const GROUPS = [
  {
    title: 'تقارير المخزون',
    items: [
      { title: 'المخزون الحالي', to: '/reports/current-stock', desc: 'الكميات الحالية حسب الصنف والمخزن' },
      { title: 'تقييم المخزون', to: '/reports/valuation', desc: 'قيمة المخزون بالتكلفة المتوسطة المرجحة' },
      { title: 'المخزون المنخفض والنافد', to: '/reports/low-stock', desc: 'الأصناف التي وصلت للحد الأدنى أو نفدت' },
      { title: 'الأصناف الراكدة', to: '/reports/dead-stock', desc: 'أصناف بدون حركة منذ فترة طويلة' },
      { title: 'الأصناف الأكثر والأقل حركة', to: '/reports/movement-ranking', desc: 'ترتيب الأصناف حسب حجم الحركة' },
    ],
  },
  {
    title: 'تقارير الحركات',
    items: [
      { title: 'سجل جميع الحركات', to: '/stock/movements', desc: 'إدخال، إخراج، تحويل، مرتجعات، تسويات' },
    ],
  },
  {
    title: 'تقارير الجرد',
    items: [
      { title: 'فروقات الجرد (نقص/زيادة)', to: '/reports/inventory-differences', desc: 'الفروقات المعتمدة من جلسات الجرد' },
    ],
  },
  {
    title: 'تقارير الموردين',
    items: [
      { title: 'مشتريات الموردين', to: '/reports/supplier-purchases', desc: 'إجمالي طلبات الشراء لكل مورد' },
    ],
  },
];
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">مركز التقارير</h1>

    <div class="space-y-6">
      <div v-for="group in GROUPS" :key="group.title">
        <h2 class="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3">{{ group.title }}</h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <router-link v-for="item in group.items" :key="item.to" :to="item.to" class="card p-4 hover:border-primary-400 transition-colors">
            <h3 class="font-bold text-slate-800 dark:text-slate-100">{{ item.title }}</h3>
            <p class="text-xs text-slate-400 mt-1">{{ item.desc }}</p>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
