import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MenuItemView } from '../../lib/food-types';
import { barSectionsFor } from './tabs';
import { MenuSaleForm } from './menu-sale-form';

vi.mock('./actions', () => ({ sellBarMenuAction: vi.fn() }));
vi.mock('./use-bar-action', () => ({ useBarAction: () => [{ error: null, ok: 0 }, vi.fn(), false] }));

const coffee = {
  id: 'm1',
  categoryId: 'c',
  name: 'Американо',
  priceMinor: '80000',
  currency: 'KZT',
  active: true,
  modifierGroups: [{ id: 'g', name: 'Добавки', minSelect: 0, maxSelect: 2, required: false, modifiers: [{ id: 'mod', name: 'Молоко', priceDeltaMinor: '20000' }] }],
} as unknown as MenuItemView;

/** «Меню бара» (DATA_MODEL §62.3): вкладка у гостиницы и салона, форма продажи с кассой и счётом гостя */
describe('меню бара', () => {
  it('вкладка «Меню бара» у гостиницы и салона после «Кухни», у ресторана её нет (меню в «Услугах»)', () => {
    for (const v of ['HOSPITALITY', 'BEAUTY'] as const) {
      const tabs = barSectionsFor(v).map((t) => [t.href, t.label]);
      expect(tabs.findIndex(([h]) => h === '/bar/menu')).toBe(tabs.findIndex(([h]) => h === '/bar/consumables') + 1);
      expect(tabs).toContainEqual(['/bar/menu', 'Меню бара']);
    }
    expect(barSectionsFor('FOOD_SERVICE').some((t) => t.href === '/bar/menu')).toBe(false);
  });

  it('форма: активные позиции с ценой, способы кассы и «В счёт гостя» только при открытых счетах', () => {
    const ctx = { propertyId: 'p', currency: 'KZT' };
    const hotel = renderToStaticMarkup(
      createElement(MenuSaleForm, {
        items: [coffee, { ...coffee, id: 'off', name: 'Снято', active: false } as MenuItemView],
        context: ctx,
        methods: ['CASH', 'CARD'],
        folios: [{ id: 'f', confirmationNumber: 'A1', guestName: 'Гость Тестовый', unitCode: '101' }],
      }),
    );
    expect(hotel).toContain('Американо, 800');
    expect(hotel).not.toContain('Снято');
    expect(hotel).toContain('В счёт гостя');
    expect(hotel).toContain('name="method"');
    const salon = renderToStaticMarkup(createElement(MenuSaleForm, { items: [coffee], context: ctx, methods: ['CASH'], folios: [] }));
    expect(salon).not.toContain('В счёт гостя');
    const empty = renderToStaticMarkup(createElement(MenuSaleForm, { items: [], context: ctx, methods: ['CASH'], folios: [] }));
    expect(empty).toContain('Меню пустое');
  });
});
