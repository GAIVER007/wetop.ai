import { describe, expect, it } from 'vitest';
import type { MenuItemView } from './food-types';
import { addCartLine, cartLinePrice, cartLineKey, choiceProblem, lineModifiersText, orderLinesToCart, toggleChoice } from './food-modifiers';

const coffee = {
  id: 'c',
  priceMinor: '100000',
  modifierGroups: [
    { id: 'g1', name: 'Размер', minSelect: 1, maxSelect: 1, required: true, modifiers: [{ id: 's', name: 'Маленький', priceDeltaMinor: '-20000' }, { id: 'l', name: 'Большой', priceDeltaMinor: '30000' }] },
    { id: 'g2', name: 'Добавки', minSelect: 0, maxSelect: 2, required: false, modifiers: [{ id: 'y', name: 'Сироп', priceDeltaMinor: '15000' }, { id: 'o', name: 'Овсяное', priceDeltaMinor: '25000' }, { id: 'k', name: 'Корица', priceDeltaMinor: '5000' }] },
  ],
} as unknown as MenuItemView;

/** §33.7: корзина стойки и официанта с добавками */
describe('корзина с добавками', () => {
  it('цена строки: блюдо плюс выбранные добавки', () => {
    expect(cartLinePrice(coffee, ['l', 'o'])).toBe(155000n);
    expect(cartLinePrice(coffee, [])).toBe(100000n);
    expect(cartLinePrice(undefined, ['l'])).toBe(0n);
  });
  it('одинаковый выбор в любом порядке складывается, другой выбор или комментарий отдельной строкой', () => {
    let cart = addCartLine([], { menuItemId: 'c', qty: 1, modifierIds: ['l', 'o'], notes: null });
    cart = addCartLine(cart, { menuItemId: 'c', qty: 1, modifierIds: ['o', 'l'], notes: null });
    cart = addCartLine(cart, { menuItemId: 'c', qty: 1, modifierIds: ['l'], notes: null });
    cart = addCartLine(cart, { menuItemId: 'c', qty: 1, modifierIds: ['l'], notes: 'без сахара' });
    expect(cart.map((i) => [i.qty, i.modifierIds, i.notes])).toEqual([
      [2, ['l', 'o'], null],
      [1, ['l'], null],
      [1, ['l'], 'без сахара'],
    ]);
    expect(cartLineKey({ menuItemId: 'c' })).toBe(cartLineKey({ menuItemId: 'c', modifierIds: [], notes: '' }));
  });
  it('выбор: радио заменяет, галочки до максимума', () => {
    const [size, extras] = coffee.modifierGroups!;
    expect(toggleChoice(['s'], size!, 'l')).toEqual(['l']);
    expect(toggleChoice(['y', 'o'], extras!, 'k')).toEqual(['y', 'o']);
    expect(toggleChoice(['y', 'o'], extras!, 'y')).toEqual(['o']);
  });
  it('что не так с выбором: обязательная группа', () => {
    expect(choiceProblem(coffee.modifierGroups!, [])).toBe('Выберите: Размер');
    expect(choiceProblem(coffee.modifierGroups!, ['s'])).toBeNull();
  });
  it('подпись строки и заказ обратно в корзину с выбором и комментарием', () => {
    expect(lineModifiersText([{ name: 'Большой' }, { name: 'Овсяное' }], 'без сахара')).toBe('Большой, Овсяное. без сахара');
    expect(lineModifiersText([], null)).toBe('');
    expect(
      orderLinesToCart([
        { menuItemId: 'c', qty: 2, notes: 'горячий', modifiers: [{ modifierId: 'l', groupName: 'Размер', name: 'Большой', priceDeltaMinor: '30000' }] },
        { menuItemId: null, qty: 1, notes: null },
      ]),
    ).toEqual([{ menuItemId: 'c', qty: 2, notes: 'горячий', modifierIds: ['l'] }]);
  });
});
