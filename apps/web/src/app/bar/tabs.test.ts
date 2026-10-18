import { describe, expect, it } from 'vitest';
import { barSectionsFor } from './tabs';

describe('bar tabs by vertical', () => {
  it('adds consumables only for a salon', () => {
    expect(barSectionsFor('BEAUTY').map((section) => section.href)).toContain('/bar/consumables');
    expect(barSectionsFor('HOSPITALITY').map((section) => section.href)).not.toContain('/bar/consumables');
    expect(barSectionsFor('FOOD_SERVICE').map((section) => section.href)).not.toContain('/bar/consumables');
  });
});
