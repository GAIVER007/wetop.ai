import { describe, expect, it } from 'vitest';
import { barSectionsFor } from './tabs';

describe('bar tabs by vertical', () => {
  it('adds the kitchen stock for a salon and a hotel, the restaurant keeps it at /stock', () => {
    expect(barSectionsFor('BEAUTY').map((section) => section.href)).toContain('/bar/consumables');
    expect(barSectionsFor('HOSPITALITY').map((section) => section.href)).toContain('/bar/consumables');
    expect(barSectionsFor('FOOD_SERVICE').map((section) => section.href)).not.toContain('/bar/consumables');
    expect(barSectionsFor('BEAUTY').find((s) => s.id === 'consumables')?.label).toBe('Расходники');
    expect(barSectionsFor('HOSPITALITY').find((s) => s.id === 'consumables')?.label).toBe('Кухня');
  });
});
