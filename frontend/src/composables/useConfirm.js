import { useConfirmStore } from '@/stores/confirm';

export function useConfirm() {
  const store = useConfirmStore();
  return (options) => store.open(options);
}
