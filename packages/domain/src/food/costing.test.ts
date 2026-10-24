import { describe, expect, it } from 'vitest';
import { menuCosting, stockUnitPrice } from './costing';

/**
 * Себестоимость и маржа позиции меню (DATA_MODEL §62.4, срез K4): продукт со склада по средней цене остатка, заготовка
 * по цене её партий, без склада цена из техкарты; добавки своей себестоимостью и прибылью. Всё в minor units.
 */
describe('menuCosting', () => {
  // зерно 10 000 ₸/кг, молоко 600 ₸/л, сироп заготовка 2 000 ₸/л
  const prices = new Map([
    ['beans', { unit: 'г', unitCost: 1_000_000n }],
    ['milk', { unit: 'мл', unitCost: 60_000n }],
    ['syrup', { unit: 'мл', unitCost: 200_000n }],
  ]);

  it('кофе 800 ₸: 18 г зерна = 180 ₸ со склада; доля продуктов 23%, наценка 344%, прибыль 620 ₸', () => {
    const r = menuCosting(
      { price: 80_000n, ingredients: [{ productId: 'beans', name: 'Кофе', normQty: '18', unit: 'г', unitCost: 0n }], modifiers: [] },
      prices,
    );
    expect(r).toMatchObject({ costMinor: 18_000n, profitMinor: 62_000n, foodCostPct: 23, marginPct: 344, missing: [] });
    expect(r.lines[0]).toMatchObject({ name: 'Кофе', costMinor: 18_000n, source: 'STOCK' });
  });

  it('без продукта склада или без остатка цена из техкарты; нет и её: строка без цены названа в missing', () => {
    const r = menuCosting(
      {
        price: 100_000n,
        ingredients: [
          { productId: null, name: 'Сахар', normQty: '10', unit: 'г', unitCost: 50_000n },
          { productId: 'gone', name: 'Корица', normQty: '1', unit: 'г', unitCost: 300_000n },
          { productId: 'gone2', name: 'Мята', normQty: '2', unit: 'г', unitCost: 0n },
        ],
        modifiers: [],
      },
      prices,
    );
    expect(r.lines.map((l) => [l.name, l.costMinor, l.source])).toEqual([
      ['Сахар', 500n, 'CARD'],
      ['Корица', 300n, 'CARD'],
      ['Мята', 0n, 'NONE'],
    ]);
    expect(r.costMinor).toBe(800n);
    expect(r.missing).toEqual(['Мята']);
  });

  it('добавка: своя себестоимость и прибыль; заготовка считается по цене её партий', () => {
    const r = menuCosting(
      {
        price: 80_000n,
        ingredients: [{ productId: 'beans', name: 'Кофе', normQty: '18', unit: 'г', unitCost: 0n }],
        modifiers: [
          { id: 'm', name: 'Молоко', priceDelta: 20_000n, ingredients: [{ productId: 'milk', name: 'Молоко', normQty: '50' }] },
          { id: 's', name: 'Сироп', priceDelta: 15_000n, ingredients: [{ productId: 'syrup', name: 'Сироп', normQty: '20' }] },
          { id: 'x', name: 'Без сахара', priceDelta: 0n, ingredients: [] },
          { id: 'y', name: 'Лёд', priceDelta: 0n, ingredients: [{ productId: 'nope', name: 'Лёд', normQty: '30' }] },
        ],
      },
      prices,
    );
    expect(r.modifiers.map((m) => [m.name, m.costMinor, m.profitMinor])).toEqual([
      ['Молоко', 3_000n, 17_000n],
      ['Сироп', 4_000n, 11_000n],
      ['Без сахара', 0n, 0n],
      ['Лёд', 0n, 0n],
    ]);
    expect(r.missing).toEqual(['Лёд']);
  });

  it('позиция без цены продажи и без продуктов: проценты не считаются', () => {
    const r = menuCosting({ price: 0n, ingredients: [], modifiers: [] }, prices);
    expect(r).toMatchObject({ costMinor: 0n, foodCostPct: null, marginPct: null });
  });
});

describe('stockUnitPrice', () => {
  it('средняя по остатку партий; остатка нет: цена последней партии; партий нет: null', () => {
    expect(stockUnitPrice([{ remaining: 600n, unitCost: 1000n, receivedOn: '2026-10-01' }, { remaining: 400n, unitCost: 1500n, receivedOn: '2026-10-02' }])).toBe(1200n);
    expect(stockUnitPrice([{ remaining: 0n, unitCost: 900n, receivedOn: '2026-10-01' }, { remaining: 0n, unitCost: 1100n, receivedOn: '2026-10-03' }])).toBe(1100n);
    expect(stockUnitPrice([])).toBeNull();
  });
});
