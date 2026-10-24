import { describe, expect, it } from 'vitest';
import { parseBusinessVertical, verticalDefinition, hasVerticalCapability } from './registry';

describe('canonical business verticals', () => {
  it.each(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)('recognises %s', (id) => {
    expect(parseBusinessVertical(id)).toBe(id);
  });
  it.each(['HOTEL', 'SALON', 'RESTAURANT', '', null, {}, 'beauty'])(
    'rejects invalid input %s',
    (id) => {
      expect(parseBusinessVertical(id)).toBeNull();
    },
  );
  it('keeps public availability separate from the canonical enum', () => {
    expect(verticalDefinition('HOSPITALITY').availability).toBe('AVAILABLE');
    expect(verticalDefinition('BEAUTY').availability).toBe('PILOT');
    expect(verticalDefinition('FOOD_SERVICE').availability).toBe('PILOT');
  });
  it('gives the shared branch stock to every vertical', () => {
    for (const id of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) expect(hasVerticalCapability(id, 'branch.stock')).toBe(true);
  });
  it('gives payroll to every vertical, branch cash only to salon and restaurant (hotel staff cabinet 22.10.2026)', () => {
    for (const id of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) expect(hasVerticalCapability(id, 'branch.payroll')).toBe(true);
    expect(hasVerticalCapability('HOSPITALITY', 'branch.cash')).toBe(false);
  });
  it('never grants hospitality capabilities to another vertical', () => {
    expect(hasVerticalCapability('HOSPITALITY', 'hospitality.reservations')).toBe(true);
    expect(hasVerticalCapability('BEAUTY', 'hospitality.reservations')).toBe(false);
    expect(hasVerticalCapability('FOOD_SERVICE', 'hospitality.reservations')).toBe(false);
  });
});
