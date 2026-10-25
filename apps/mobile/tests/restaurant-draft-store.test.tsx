import { DraftStore } from '../src/restaurant/draft-store';
import { draftLine } from '../src/restaurant/draft';
import type { MenuItem } from '../src/restaurant/contracts';
const item: MenuItem = {
  id: 'd',
  categoryId: 'c',
  name: 'Кофе',
  priceMinor: '100',
  currency: 'KZT',
  active: true,
  photoUrl: null,
  modifierGroups: [],
};
test('same verified context retains draft across route mounts; different context clears it', () => {
  const store = new DraftStore();
  store.bind('a');
  store.update({ lines: [draftLine(item, [], '')], tableId: 'table', guests: 3 });
  store.bind('a');
  expect(store.snapshot().lines).toHaveLength(1);
  expect(store.snapshot().tableId).toBe('table');
  store.bind('b');
  expect(store.snapshot().lines).toEqual([]);
  expect(store.snapshot().tableId).toBeUndefined();
});
test('menu refresh updates changed prices and flags removed unavailable positions', () => {
  const store = new DraftStore();
  store.bind('a');
  store.update({ lines: [draftLine(item, [], '')] });
  store.reconcile([{ ...item, priceMinor: '200' }]);
  expect(store.snapshot().lines[0]?.unitMinor).toBe('200');
  expect(store.snapshot().notice).not.toBe('');
  store.reconcile([{ ...item, active: false }]);
  expect(store.snapshot().lines).toEqual([]);
  expect(store.snapshot().notice).not.toBe('');
});
