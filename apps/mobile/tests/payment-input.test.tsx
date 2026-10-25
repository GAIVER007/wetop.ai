import { paymentAmount, readPaymentMethods } from '../src/restaurant/payment-input';
test('parses payment input exactly and caps at remaining balance', () => {
  expect(paymentAmount('12,34', '2000')).toBe(1234);
  expect(paymentAmount(' 12.3 ', '1230')).toBe(1230);
  expect(paymentAmount('90071992547409.91', '9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  for (const value of ['0', '-1', '1e3', '1.005', '1,2.3', 'Infinity', '90071992547409.92'])
    expect(() => paymentAmount(value, '999999999999999999')).toThrow();
  expect(() => paymentAmount('20.01', '2000')).toThrow();
});
test('offers only enabled server methods in configured order with no fallback', () => {
  expect(
    readPaymentMethods({
      methods: [
        { method: 'CASH', enabled: false, sortOrder: 0 },
        { method: 'KASPI', enabled: true, sortOrder: 2 },
        { method: 'CARD_TERMINAL', enabled: true, sortOrder: 1 },
      ],
    }),
  ).toEqual(['CARD_TERMINAL', 'KASPI']);
  expect(readPaymentMethods({ methods: [] })).toEqual([]);
  expect(() =>
    readPaymentMethods({ methods: [{ method: 'AGGREGATOR', enabled: true, sortOrder: 0 }] }),
  ).toThrow();
});
