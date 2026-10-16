import type { AppointmentStatus } from './appointments';

/** Оплата записи салона в кассу филиала (DATA_MODEL §49): частями, не больше цены записи */
export function appointmentPayment(status: AppointmentStatus, price: bigint, paid: bigint, amount: bigint): { paidAfter: bigint } {
  if (status === 'CANCELLED') throw new Error('Запись отменена');
  if (status === 'NO_SHOW') throw new Error('Клиент не пришёл');
  if (amount <= 0n) throw new Error('Сумма больше нуля');
  if (paid + amount > price) throw new Error('Сумма больше остатка к оплате');
  return { paidAfter: paid + amount };
}

/** Отмена и незаезд только без действующей оплаты; null: можно */
export function appointmentStatusAllowed(to: AppointmentStatus, paid: bigint): string | null {
  return (to === 'CANCELLED' || to === 'NO_SHOW') && paid > 0n ? 'Сначала аннулируйте оплату записи в кассе' : null;
}

/** Аннулировать оплату можно, пока запись не выполнена (Q-BEAUTY-PAY-1); null: можно */
export function appointmentPaymentVoidable(status: AppointmentStatus): string | null {
  return status === 'DONE' ? 'Запись выполнена: оплату уже не аннулируют, оформите возврат в карточке записи' : null;
}

/** Возврат по выполненной записи (§54): только после «Выполнено», не больше чистой оплаты */
export function appointmentRefund(status: AppointmentStatus, paidNet: bigint, amount: bigint): void {
  if (status !== 'DONE') throw new Error('Возврат оформляют по выполненной записи: до этого аннулируйте оплату в кассе');
  if (amount <= 0n) throw new Error('Сумма больше нуля');
  if (amount > paidNet) throw new Error('Сумма больше оплаченного по записи');
}
