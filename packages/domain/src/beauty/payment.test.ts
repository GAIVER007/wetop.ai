import { describe, expect, it } from 'vitest';
import { appointmentPayment, appointmentPaymentVoidable, appointmentRefund, appointmentStatusAllowed } from './payment';

describe('оплата записи салона (§49)', () => {
  it('частями до цены, не больше остатка', () => {
    expect(appointmentPayment('BOOKED', 800000n, 0n, 300000n)).toEqual({ paidAfter: 300000n });
    expect(appointmentPayment('DONE', 800000n, 300000n, 500000n)).toEqual({ paidAfter: 800000n });
    expect(() => appointmentPayment('CONFIRMED', 800000n, 300000n, 500001n)).toThrow('Сумма больше остатка к оплате');
    expect(() => appointmentPayment('BOOKED', 800000n, 0n, 0n)).toThrow('Сумма больше нуля');
  });
  it('отменённую и незаезд не оплачивают', () => {
    expect(() => appointmentPayment('CANCELLED', 800000n, 0n, 1n)).toThrow('Запись отменена');
    expect(() => appointmentPayment('NO_SHOW', 800000n, 0n, 1n)).toThrow('Клиент не пришёл');
  });
  it('отмена и незаезд только без действующей оплаты; перенос не ниже оплаченного', () => {
    expect(appointmentStatusAllowed('CANCELLED', 1n)).toBe('Сначала аннулируйте оплату записи в кассе');
    expect(appointmentStatusAllowed('NO_SHOW', 1n)).toBe('Сначала аннулируйте оплату записи в кассе');
    expect(appointmentStatusAllowed('CANCELLED', 0n)).toBeNull();
    expect(appointmentStatusAllowed('DONE', 5n)).toBeNull();
  });
  it('аннулировать оплату можно, пока запись не выполнена', () => {
    expect(appointmentPaymentVoidable('CONFIRMED')).toBeNull();
    expect(appointmentPaymentVoidable('DONE')).toBe('Запись выполнена: оплату уже не аннулируют, оформите возврат в карточке записи');
  });
  it('возврат (§54): только после «Выполнено», больше нуля и не больше чистой оплаты', () => {
    expect(() => appointmentRefund('CONFIRMED', 500000n, 1n)).toThrow('Возврат оформляют по выполненной записи');
    expect(() => appointmentRefund('DONE', 500000n, 0n)).toThrow('Сумма больше нуля');
    expect(() => appointmentRefund('DONE', 500000n, 500001n)).toThrow('Сумма больше оплаченного по записи');
    expect(() => appointmentRefund('DONE', 500000n, 500000n)).not.toThrow();
  });
});
