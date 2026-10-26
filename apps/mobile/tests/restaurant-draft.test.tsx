import { draftLine, draftTotal } from '../src/restaurant/draft';
import type { MenuItem } from '../src/restaurant/contracts';
const item: MenuItem = {
  id: 'dish',
  categoryId: 'cat',
  name: 'Кофе',
  priceMinor: '120000',
  currency: 'KZT',
  active: true,
  photoUrl: null,
  modifierGroups: [
    {
      id: 'milk',
      name: 'Молоко',
      minSelect: 1,
      maxSelect: 1,
      required: true,
      modifiers: [
        { id: 'oat', name: 'Овсяное', priceDeltaMinor: '25000' },
        { id: 'none', name: 'Без молока', priceDeltaMinor: '-10000' },
      ],
    },
  ],
};
test('requires valid exact modifier selection and active item', () => {
  expect(() => draftLine(item, [], '')).toThrow();
  expect(() => draftLine(item, ['foreign'], '')).toThrow();
  expect(() => draftLine(item, ['none', 'oat'], '')).toThrow();
  expect(() => draftLine({ ...item, active: false }, ['oat'], '')).toThrow();
});
test('draft retains note and calculates exact total without floating point', () => {
  const line = draftLine(item, ['oat'], '  Без сахара  ');
  expect(line.unitMinor).toBe('145000');
  expect(line.notes).toBe('Без сахара');
  expect(draftTotal([{ ...line, qty: 3 }])).toBe('435000');
  const large = draftLine({ ...item, priceMinor: '900719925474099312' }, ['none'], '');
  expect(draftTotal([large])).toBe('900719925474089312');
});
test('rejects negative total price and duplicate modifiers', () => {
  expect(() => draftLine({ ...item, priceMinor: '1' }, ['none'], '')).toThrow();
  expect(() => draftLine(item, ['oat', 'oat'], '')).toThrow();
});
