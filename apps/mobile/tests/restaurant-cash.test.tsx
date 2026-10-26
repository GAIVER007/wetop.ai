import { readCash } from '../src/restaurant/cash';
test('cash keeps exact balances and only named recent payment fields', () => {
  const cash = readCash({
    currency: 'KZT',
    balances: [{ method: 'CASH', balanceMinor: '900719925474099312' }],
    payments: [
      {
        id: 'p',
        orderNumber: 42,
        method: 'CARD_TERMINAL',
        amountMinor: '780000',
        status: 'COMPLETED',
        paidAt: '2026-10-24T12:00:00Z',
        secret: 'drop',
      },
    ],
    operations: [{ secret: 'drop' }],
  });
  expect(cash.balances[0]?.balanceMinor).toBe('900719925474099312');
  expect(cash.payments[0]).toEqual({
    id: 'p',
    orderNumber: 42,
    method: 'CARD_TERMINAL',
    amountMinor: '780000',
    status: 'COMPLETED',
    paidAt: '2026-10-24T12:00:00Z',
  });
  expect(JSON.stringify(cash)).not.toContain('secret');
});
test('cash rejects floating-point minor units', () =>
  expect(() =>
    readCash({ currency: 'KZT', balances: [{ method: 'CASH', balanceMinor: 0.5 }], payments: [] }),
  ).toThrow());
