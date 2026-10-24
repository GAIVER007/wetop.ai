import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ModifierGroupView } from '../../lib/food-types';
import { ModifierGroupsTable } from './modifier-parts';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('./restaurant-actions', () => ({ mutateMenu: vi.fn(), mutateOrder: vi.fn() }));
vi.mock('../branch-payment-methods/use-branch-methods', () => ({ useBranchPaymentMethods: () => [] }));

const group: ModifierGroupView = {
  id: 'g',
  name: 'Добавки',
  minSelect: 0,
  maxSelect: 3,
  required: false,
  sortOrder: 0,
  active: true,
  updatedAt: '2026-10-24T00:00:00.000Z',
  modifiers: [
    {
      id: 'm1',
      name: 'Молоко',
      priceDeltaMinor: '20000',
      sortOrder: 0,
      active: true,
      ingredients: [{ productId: 'p', productName: 'Молоко 3,2%', unit: 'мл', normQty: '50' }],
    },
    { id: 'm2', name: 'Сироп', priceDeltaMinor: '15000', sortOrder: 1, active: true },
  ],
};

/** §62.2: в таблице групп видно, какие продукты склада списывает добавка */
describe('добавки со склада в таблице групп', () => {
  it('у добавки с продуктами в скобках продукт и норма, у старой без поля только цена', () => {
    const html = renderToStaticMarkup(
      createElement(ModifierGroupsTable, {
        ctx: { scopeKey: 's', write: true, currencyHint: '₸' },
        groups: [group],
        items: [],
        adding: false,
        setAdding: () => {},
        stock: [{ id: 'p', name: 'Молоко 3,2%', unit: 'мл' }],
      }),
    );
    expect(html).toContain('Молоко +200 ₸ (Молоко 3,2% 50 мл)');
    expect(html).toMatch(/Сироп \+150 ₸(,|<)/);
  });
});
