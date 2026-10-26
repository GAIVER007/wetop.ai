import { money, readOrders, readTables, readCategories, readMenu } from '../src/restaurant/data';
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

test('menu preserves category station and exact modifier delta', () => {
  expect(
    readCategories({
      items: [{ id: 'c', name: 'Напитки', sortOrder: 0, active: true, station: 'BAR' }],
      nextCursor: null,
    }).items[0]?.station,
  ).toBe('BAR');
  expect(
    readMenu({
      items: [
        {
          id: 'd',
          categoryId: 'c',
          name: 'Кофе',
          priceMinor: '120000',
          currency: 'KZT',
          active: true,
          photoUrl: null,
          modifierGroups: [
            {
              id: 'g',
              name: 'Молоко',
              minSelect: 0,
              maxSelect: 1,
              required: false,
              modifiers: [{ id: 'm', name: 'Без молока', priceDeltaMinor: '-10000' }],
            },
          ],
        },
      ],
      nextCursor: null,
    }).items[0]?.modifierGroups[0]?.modifiers[0]?.priceDeltaMinor,
  ).toBe('-10000');
});
