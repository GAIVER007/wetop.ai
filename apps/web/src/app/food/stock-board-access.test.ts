import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StockProductView } from '../../lib/food-types';
import { StockBoard, stockMoneyInputToMinor } from './stock-board';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../../components/use-confirm', () => ({
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));
vi.mock('./stock-actions', () => ({ mutateStock: vi.fn(), loadLots: vi.fn(), loadPrepRecipe: vi.fn() }));

const product: StockProductView = {
  id: 'synthetic-product',
  name: 'Synthetic consumable',
  unit: 'шт',
  minQty: '2',
  active: true,
  onHand: '10',
  valueMinor: '1234',
  low: false,
  nearestExpiry: null, kind: 'RAW' as const,
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

  it('§62 заготовки: метка «Заготовка», «Приготовили» и «Техкарта» у заготовки; у сырья их нет; приход только сырья', () => {
    const prep: StockProductView = { ...product, id: 'synthetic-prep', name: 'Колбаса домашняя', unit: 'г', kind: 'PREP' };
    const html = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: { scopeKey: 's', currency: 'KZT', vertical: 'HOSPITALITY', canProperty: true, canDesk: true },
      products: [product, prep],
      movements: [{
        id: 'm', productId: prep.id, productName: prep.name, unit: 'г', lotId: 'l', kind: 'PRODUCTION_IN',
        qty: '2500', costMinor: '500500', reason: 'Приготовлено', createdAt: '2026-10-24T10:00:00.000Z',
      }],
    }));
    expect(html.match(/>Заготовка</g)).toHaveLength(1);
    expect(html).toContain('aria-label="Приготовили: Колбаса домашняя"');
    expect(html).toContain('aria-label="Техкарта: Колбаса домашняя"');
    expect(html).not.toContain('aria-label="Приготовили: Synthetic consumable"');
    expect(html).not.toContain('aria-label="Техкарта: Synthetic consumable"');
    expect(html).toContain('+ Приход товара');
    // только заготовки: покупать нечего, кнопки прихода нет
    const onlyPrep = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: { scopeKey: 's', currency: 'KZT', canProperty: true, canDesk: true },
      products: [prep],
      movements: [],
    }));
    expect(onlyPrep).not.toContain('+ Приход товара');
  });
  it('владелец 25.10.2026: неиспользуемые скрыты, переключатель «Показать неиспользуемые», кнопки строк компактные', () => {
    const idle: StockProductView = { ...product, id: 'synthetic-idle', name: 'Старый расходник', active: false };
    const html = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: { scopeKey: 's', currency: 'USD', vertical: 'BEAUTY', canCreate: true, canUpdate: true, canDelete: false },
      products: [product, idle],
      movements: [],
    }));
    expect(html).toContain('Synthetic consumable');
    expect(html).not.toContain('Старый расходник');
    expect(html).not.toContain('>Не используется<');
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Показать неиспользуемые/);
    expect(html).toContain('aria-label="Партии: Synthetic consumable"');
    const row = html.slice(html.indexOf('aria-label="Партии: Synthetic consumable"') - 80);
    expect(row).toMatch(/class="btn btn--secondary btn--xs"[^>]*aria-label="Партии: Synthetic consumable"/);
    // одни только неиспользуемые: переключатель есть, пусто одной строкой
    const onlyIdle = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: { scopeKey: 's', currency: 'USD', vertical: 'BEAUTY', canCreate: true, canUpdate: true, canDelete: false },
      products: [idle],
      movements: [],
    }));
    expect(onlyIdle).not.toContain('Старый расходник');
    expect(onlyIdle).toContain('Показать неиспользуемые');
    // без неиспользуемых переключателя нет
    const none = renderToStaticMarkup(createElement(StockBoard as never, {
      ctx: { scopeKey: 's', currency: 'USD', vertical: 'BEAUTY', canCreate: true, canUpdate: true, canDelete: false },
      products: [product],
      movements: [],
    }));
    expect(none).not.toContain('Показать неиспользуемые');
  });
});
