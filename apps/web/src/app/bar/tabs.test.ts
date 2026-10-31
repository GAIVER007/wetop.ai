import { describe, expect, it } from 'vitest';
import { barSectionsFor, stockGroupsFor } from './tabs';

describe('склад: пять разделов, внутри вкладки (вариант C владельца 31.10.2026)', () => {
  it('сверху Обзор, Бар, Кухня, Закупки, Движение у всех направлений', () => {
    for (const v of ['BEAUTY', 'HOSPITALITY', 'FOOD_SERVICE'] as const)
      expect(stockGroupsFor(v).map((g) => g.label), v).toEqual(['Обзор', 'Бар', 'Кухня', 'Закупки', 'Движение']);
  });

  it('«Бар» и «Меню бара» в одном разделе, приходы и поставщики в «Закупках»', () => {
    const hotel = stockGroupsFor('HOSPITALITY');
    expect(hotel[1]!.tabs.map((t) => t.label)).toEqual(['Товары', 'Меню бара', 'Номенклатура']);
    expect(hotel[3]!.tabs.map((t) => t.href)).toEqual(['/bar/receipts', '/bar/suppliers']);
    // у ресторана меню в «Услугах», кухня склада на /stock
    const food = stockGroupsFor('FOOD_SERVICE');
    expect(food[1]!.tabs.map((t) => t.href)).toEqual(['/bar', '/bar/products']);
    expect(food[2]!.tabs[0]!.href).toBe('/stock');
  });

  it('все прежние адреса склада остаются доступны вкладками', () => {
    expect(barSectionsFor('BEAUTY').map((s) => s.href)).toEqual([
      '/warehouse', '/bar', '/bar/menu', '/bar/products', '/bar/consumables', '/bar/receipts', '/bar/suppliers', '/bar/operations',
    ]);
    expect(barSectionsFor('FOOD_SERVICE').map((s) => s.href)).toContain('/stock');
    expect(barSectionsFor('FOOD_SERVICE').map((s) => s.href)).not.toContain('/bar/consumables');
  });
});
