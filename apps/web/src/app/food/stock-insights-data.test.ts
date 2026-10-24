import { describe, expect, it } from 'vitest';
import type { MenuItemView, StockProductView } from '../../lib/food-types';
import { buildStockInsights } from './stock-insights-data';

const product = (id: string, name: string, onHand: string, minQty: string, low: boolean, active = true): StockProductView => ({
  id, name, unit: 'г', minQty, active, onHand, valueMinor: '0', low, nearestExpiry: null, kind: 'RAW' as const,
});
const dish = (id: string, name: string, pct: number | null, rows: Array<[string | null, string, string]>, active = true): MenuItemView => ({
  id, categoryId: 'c', name, weightGrams: null, priceMinor: '320000', currency: 'KZT', active, techNotes: null,
  sortOrder: 0, updatedAt: '2026-10-21T00:00:00Z',
  ingredients: rows.map(([productId, n, qty], i) => ({ id: `${id}${i}`, productId, name: n, normQty: qty, unit: 'г', unitCostMinor: '0', costMinor: '0' })),
  totals: { costMinor: '79800', profitMinor: '240200', foodCostPct: pct, marginPct: pct === null ? null : 100 - pct },
});

describe('stock insights', () => {
  const products = [
    product('cream', 'Сливки', '1500', '3000', true),
    product('flour', 'Мука', '12000', '5000', false),
    product('old', 'Архивный', '0', '10', true, false),
  ];
  it('lists only active products below the minimum for restocking', () => {
    expect(buildStockInsights(products, null).restock.map((r) => r.name)).toEqual(['Сливки']);
  });
  it('without a menu there are no dishes at all (hotel and salon kitchens)', () => {
    const out = buildStockInsights(products, null);
    expect(out.dishes).toEqual([]);
    expect(out.expensive).toEqual([]);
  });
  it('counts portions from stock and names the limiting product', () => {
    const out = buildStockInsights(products, [dish('d1', 'Карбонара', 24.9, [['flour', 'Мука', '120'], ['cream', 'Сливки', '50']])]);
    expect(out.dishes[0]).toMatchObject({ name: 'Карбонара', portions: 30, limiting: 'Сливки' });
  });
  it('flags dishes whose products cost more than 30 percent of the price, worst first', () => {
    const out = buildStockInsights(products, [
      dish('a', 'Тирамису', 31.4, [['flour', 'Мука', '10']]),
      dish('b', 'Борщ', 23.3, [['flour', 'Мука', '10']]),
      dish('c', 'Стейк', 45, [['flour', 'Мука', '10']]),
      dish('d', 'Ровно', 30, [['flour', 'Мука', '10']]),
    ]);
    expect(out.expensive.map((d) => d.name)).toEqual(['Стейк', 'Тирамису']);
  });
  it('skips inactive dishes and dishes without a tech card', () => {
    const out = buildStockInsights(products, [dish('x', 'Снят', 20, [['flour', 'Мука', '10']], false), dish('y', 'Без состава', null, [])]);
    expect(out.dishes).toEqual([]);
  });
});
