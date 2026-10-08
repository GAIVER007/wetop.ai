import type { StatusRegistry } from './types';

/**
 * Состояние оплаты брони (решение владельца №3). В модели такого статуса нет: это представление счетов
 * (`app/reservations/finance-state.ts`), ключи совпадают с отбором `payment` списка броней.
 */
export type PaymentState = 'paid' | 'partial' | 'unpaid' | 'due' | 'refund' | 'refunded';

export const paymentStatus: StatusRegistry<PaymentState> = {
  paid: { label: 'Оплачено', tone: 'success' },
  partial: { label: 'Оплачено частично', tone: 'warning' },
  unpaid: { label: 'Не оплачено', tone: 'warning' },
  due: { label: 'Есть долг', tone: 'danger' },
  refund: { label: 'К возврату', tone: 'info' },
  refunded: { label: 'Возвращено', tone: 'neutral' },
};
