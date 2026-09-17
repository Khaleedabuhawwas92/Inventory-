export const MOVEMENT_TYPE_LABELS = {
  OPENING: 'رصيد افتتاحي',
  IN: 'إدخال',
  OUT: 'إخراج',
  TRANSFER_OUT: 'تحويل صادر',
  TRANSFER_IN: 'تحويل وارد',
  RETURN_IN: 'مرتجع وارد',
  RETURN_OUT: 'مرتجع صادر',
  ADJUSTMENT_IN: 'تسوية إضافة',
  ADJUSTMENT_OUT: 'تسوية خصم',
  INVENTORY_ADJUSTMENT: 'تسوية جرد',
  REVERSAL: 'إلغاء/عكس عملية',
};

// Whether a movement increased the balance. INVENTORY_ADJUSTMENT and REVERSAL
// can go either direction depending on the specific document, so direction is
// derived from the actual before/after quantities rather than a fixed
// per-type list (which would misclassify those two types).
export function isIncomingMovement(movement) {
  return movement.afterQty >= movement.beforeQty;
}
