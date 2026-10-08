import type { FinanceState } from '../../app/reservations/finance-state';
import { statusLabels, type StatusPresentation } from './types';

/** Existing directory filter values, not new payment states or calculation rules. */
type PaymentPresentationKey =
  Exclude<FinanceState['kind'], 'none' | 'refund-due'> | 'partial' | 'refund';
export const payment = {
  paid: { label: 'Оплачено', tone: 'success' },
  partial: { label: 'Оплачено частично', tone: 'warning' },
  unpaid: { label: 'Не оплачено', tone: 'warning' },
  due: { label: 'Есть долг', tone: 'danger' },
  refund: { label: 'К возврату', tone: 'warning' },
  refunded: { label: 'Возвращено', tone: 'neutral' },
} as const satisfies Record<PaymentPresentationKey, StatusPresentation>;
export const paymentLabels = statusLabels(payment);
export const paymentWords = statusLabels(payment, true);
