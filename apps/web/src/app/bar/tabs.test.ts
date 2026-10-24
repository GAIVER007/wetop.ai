import { describe, expect, it } from 'vitest';
import { barSectionsFor } from './tabs';

describe('bar tabs by vertical', () => {
  it('adds the kitchen stock for a salon and a hotel, the restaurant links its own /stock', () => {
    expect(barSectionsFor('BEAUTY').map((section) => section.href)).toContain('/bar/consumables');
    expect(barSectionsFor('HOSPITALITY').map((section) => section.href)).toContain('/bar/consumables');
    expect(barSectionsFor('FOOD_SERVICE').map((section) => section.href)).not.toContain('/bar/consumables');
    expect(barSectionsFor('FOOD_SERVICE').map((section) => section.href)).toContain('/stock');
    expect(barSectionsFor('HOSPITALITY').slice(0, 3).map((section) => section.label)).toEqual(['Обзор склада', 'Бар', 'Расходники']);
    expect(barSectionsFor('BEAUTY').find((s) => s.id === 'consumables')?.label).toBe('Расходники');
    expect(barSectionsFor('HOSPITALITY').find((s) => s.id === 'consumables')?.label).toBe('Расходники');
    expect(barSectionsFor('BEAUTY').find((s) => s.id === 'bar')?.label).toBe('Товары');
  });
});
