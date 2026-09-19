import { describe, expect, it } from 'vitest';
import { stayFacts } from './stay-facts';

/**
 * Срез 7.1: полоса брони на шахматке показывает канал и остаток к оплате. Остаток — та же арифметика,
 * что у счёта (`folioBalance`, ADR-008): начислено − оплачено + возвращено; сторно не считается.
 */
const folio = {
  charges: [
    { amount: 1_600_000n, voidedAt: null },
    { amount: 500_000n, voidedAt: new Date('2026-09-14T10:00:00Z') },
  ],
  allocations: [{ amount: 600_000n }],
  refunds: [{ amount: 100_000n }],
};

describe('stayFacts', () => {
  it('переносит источник и канал брони и считает остаток счёта в тиынах строкой', () => {
    expect(stayFacts({ reservation: { source: 'OTA', channel: 'Booking.com' }, folio })).toEqual({
      source: 'OTA',
      channel: 'Booking.com',
      balanceMinor: '1100000',
    });
  });
  it('без счёта остатка нет — поле не выдумывается', () => {
    expect(stayFacts({ reservation: { source: 'DESK', channel: null }, folio: null })).toEqual({
      source: 'DESK',
      channel: null,
    });
  });
});
