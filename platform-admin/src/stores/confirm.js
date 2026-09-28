import { defineStore } from 'pinia';

// Backs the global <ConfirmDialog/> mounted once in App.vue.
// Usage: const ok = await useConfirmStore().open({ title, message, danger });
export const useConfirmStore = defineStore('confirm', {
  state: () => ({
    visible: false,
    title: '',
    message: '',
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    danger: false,
    _resolve: null,
  }),
  actions: {
    open({ title = 'تأكيد العملية', message = '', confirmText = 'تأكيد', cancelText = 'إلغاء', danger = false } = {}) {
      this.title = title;
      this.message = message;
      this.confirmText = confirmText;
      this.cancelText = cancelText;
      this.danger = danger;
      this.visible = true;
      return new Promise((resolve) => {
        this._resolve = resolve;
      });
    },
    confirm() {
      this.visible = false;
      this._resolve?.(true);
    },
    cancel() {
      this.visible = false;
      this._resolve?.(false);
    },
  },
});
