import { describe, expect, it } from 'vitest';
import { barSectionsFor } from './tabs';

describe('bar tabs by vertical', () => {
  it('adds the kitchen stock for a salon and a hotel, the restaurant links its own /stock', () => {
    expect(barSectionsFor('BEAUTY').map((section) => section.href)).toContain('/bar/consumables');
    expect(barSectionsFor('HOSPITALITY').map((section) => section.href)).toContain('/bar/consumables');
    expect(barSectionsFor('FOOD_SERVICE').map((section) => section.href)).not.toContain('/bar/consumables');
    expect(barSectionsFor('FOOD_SERVICE').map((section) => section.href)).toContain('/stock');
    // решение владельца 24.10.2026: «Бар» и «Кухня» на складе у всех направлений
    expect(barSectionsFor('HOSPITALITY').slice(0, 3).map((section) => section.label)).toEqual(['Обзор склада', 'Бар', 'Кухня']);
    expect(barSectionsFor('BEAUTY').slice(0, 3).map((section) => section.label)).toEqual(['Обзор склада', 'Бар', 'Кухня']);
    expect(barSectionsFor('FOOD_SERVICE').slice(0, 3).map((section) => section.label)).toEqual(['Обзор склада', 'Бар', 'Склад кухни']);
  });
});
