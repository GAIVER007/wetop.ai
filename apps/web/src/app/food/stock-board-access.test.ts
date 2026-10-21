import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StockProductView } from '../../lib/food-types';
import { StockBoard, stockMoneyInputToMinor } from './stock-board';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../../components/use-confirm', () => ({
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));
vi.mock('./stock-actions', () => ({ mutateStock: vi.fn(), loadLots: vi.fn() }));

const product: StockProductView = {
  id: 'synthetic-product',
  name: 'Synthetic consumable',
  unit: 'шт',
  minQty: '2',
  active: true,
  onHand: '10',
  valueMinor: '1234',
  low: false,
  nearestExpiry: null,
};

describe('shared stock controls', () => {
  it('parses the configured currency into minor units and names it in validation errors', () => {
    expect(stockMoneyInputToMinor('12,34', 'Цена', 'USD')).toBe(1234);
    expect(() => stockMoneyInputToMinor('12.345', 'Цена', 'USD')).toThrow(
      'Цена: укажите сумму в USD',
    );
    expect(() => stockMoneyInputToMinor('90071992547409.92', 'Цена', 'USD')).toThrow(
      'Цена: сумма слишком большая',
    );
  });

  it('uses exact create and update grants without broad legacy flags', () => {
    const createOnly = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: {
        scopeKey: 'synthetic-business:synthetic-location',
        currency: 'USD',
        canCreate: true,
        canUpdate: false,
        canDelete: false,
      },
      products: [product],
      movements: [],
    }));
    expect(createOnly).toContain('+ Ингредиент');
    expect(createOnly).toContain('+ Приход товара');
    expect(createOnly).not.toContain('aria-label="Списать: Synthetic consumable"');
    expect(createOnly).not.toContain('aria-label="Изменить: Synthetic consumable"');

    const updateOnly = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: {
        scopeKey: 'synthetic-business:synthetic-location',
        currency: 'USD',
        canCreate: false,
        canUpdate: true,
        canDelete: false,
      },
      products: [product],
      movements: [],
    }));
    expect(updateOnly).not.toContain('+ Ингредиент');
    expect(updateOnly).not.toContain('+ Приход товара');
    expect(updateOnly).toContain('aria-label="Списать: Synthetic consumable"');
    expect(updateOnly).toContain('aria-label="Изменить: Synthetic consumable"');
  });

  it('uses salon material names without changing restaurant ingredient names', () => {
    const salon = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: {
        scopeKey: 'synthetic-business:synthetic-location',
        currency: 'USD',
        vertical: 'BEAUTY',
        canCreate: true,
        canUpdate: false,
        canDelete: false,
      },
      products: [],
      movements: [],
    }));
    expect(salon).toContain('Добавьте первый расходник');
    expect(salon).toContain('+ Расходник');
    expect(salon).not.toContain('ингредиент');

    const restaurant = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: {
        scopeKey: 'synthetic-business:synthetic-location',
        currency: 'USD',
        canProperty: true,
        canDesk: true,
      },
      products: [],
      movements: [],
    }));
    expect(restaurant).toContain('Добавьте первый ингредиент');
    expect(restaurant).toContain('+ Ингредиент');
  });

  it('shows exact minor units for salon stock values', () => {
    const html = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: {
        scopeKey: 'synthetic-business:synthetic-location',
        currency: 'USD',
        vertical: 'BEAUTY',
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
      products: [product],
      movements: [{
        id: 'synthetic-movement', productId: product.id, productName: product.name,
        unit: 'шт', lotId: null, kind: 'RECEIPT', qty: '1', costMinor: '1234',
        reason: null, createdAt: '2026-10-18T10:00:00.000Z',
      }],
    }));
    expect(html).toContain('12,34 USD');
    expect(html).not.toContain('12 USD');
  });

  it('аудит 21.10.2026 п.8, п.40, п.41: итог строкой под таблицей, кнопки в строке поиска, без заливки ячеек', () => {
    const html = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: { scopeKey: 's', currency: 'USD', vertical: 'BEAUTY', canCreate: true, canUpdate: true, canDelete: false },
      products: [{ ...product, onHand: '0', low: true }],
      movements: [],
    }));
    expect(html).not.toContain('class="stat');
    expect(html).toContain('data-testid="stock-totals"');
    expect(html).toContain('data-testid="stock-value"');
    expect(html).not.toContain('data-low');
    expect(html).toContain('Нет на складе');
    const tools = html.slice(html.indexOf('rest-card__tools'), html.indexOf('<table'));
    expect(tools).toContain('+ Расходник');
    expect(tools).toContain('+ Приход товара');
  });
});
