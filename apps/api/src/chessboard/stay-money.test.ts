import { describe, expect, it } from 'vitest';
import { stayMoney } from './stay-facts';

/** «Быстрый отчёт» гостиницы как у салона (владелец 31.10.2026): сумма брони, оплаты наличными и безналом по счёту */
describe('stayMoney', () => {
  it('сумма начислений без отменённых, оплаты делятся на наличные и безнал, долг', () => {
    expect(
      stayMoney({
        charges: [{ amount: 3000n, voidedAt: null }, { amount: 500n, voidedAt: new Date() }],
        allocations: [
          { amount: 1000n, payment: { method: 'CASH' } },
          { amount: 1500n, payment: { method: 'KASPI' } },
        ],
        refunds: [{ amount: 200n }],
      }),
    ).toEqual({ totalMinor: '3000', paidCashMinor: '1000', paidNonCashMinor: '1500', refundedMinor: '200', balanceMinor: '700' });
  });
  it('без счёта: пусто', () => {
    expect(stayMoney(null)).toBeNull();
  });
});
