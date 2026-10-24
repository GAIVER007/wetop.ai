import { money, readOrders, readTables } from '../src/restaurant/data';
test('formats large minor-unit values without floating point rounding', () => {
  expect(money('900719925474099312', 'KZT')).toBe(
    '9\u00a0007\u00a0199\u00a0254\u00a0740\u00a0993,12\u00a0₸',
  );
  expect(money('1200000', 'KZT')).toBe('12\u00a0000\u00a0₸');
});
test('empty table and order responses are valid empty states', () => {
  expect(readTables({ me: null, tables: [] }).tables).toEqual([]);
  expect(readOrders({ items: [], nextCursor: null }).items).toEqual([]);
});
test('invalid response and float money are rejected', () => {
  expect(() => readTables({ tables: [{ id: 'a' }] })).toThrow();
  expect(() => money('12.35', 'KZT')).toThrow();
});
