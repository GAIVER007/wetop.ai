import type { InventorySummary } from '@pms/domain';
import { describe, expect, it } from 'vitest';
import { compareInventory, renderInventoryReport } from './inventory-compare';

const exely: InventorySummary = {
  totalUnits: 7,
  rooms: 4,
  beds: 3,
  maxGuests: 9,
  physicalRooms: 7,
  byCategory: [
    { code: 'exely-900001', name: 'Тестовая одиночная', units: 2, maxGuests: 2, capacityAdults: 1 },
    { code: 'exely-900002', name: 'Тестовая двойная', units: 2, maxGuests: 4, capacityAdults: 2 },
    { code: 'exely-900003', name: 'Тестовый dorm', units: 3, maxGuests: 3, capacityAdults: 1 },
  ],
};

describe('compareInventory', () => {
  it('reports zero diff when PMS equals Exely', () => {
    const r = compareInventory({ pms: exely, exely, blocksInPms: 0, blocksInExely: 0 });
    expect(r.ok).toBe(true);
    expect(r.rows.every((row) => row.diff === 0)).toBe(true);
    expect(r.rows.map((row) => row.label)).toContain('Тестовый dorm');
  });
  it('flags a missing bed and an extra category as non-zero diffs', () => {
    const pms: InventorySummary = {
      ...exely,
      totalUnits: 6,
      beds: 2,
      maxGuests: 8,
      byCategory: [
        ...exely.byCategory.map((c) =>
          c.code === 'exely-900003' ? { ...c, units: 2, maxGuests: 2 } : c,
        ),
        { code: 'exely-999', name: 'Лишняя', units: 1, maxGuests: 1, capacityAdults: 1 },
      ],
    };
    const r = compareInventory({ pms, exely, blocksInPms: 0, blocksInExely: 0 });
    expect(r.ok).toBe(false);
    const byLabel = Object.fromEntries(r.rows.map((row) => [row.label, row.diff]));
    expect(byLabel['units total']).toBe(-1);
    expect(byLabel['beds']).toBe(-1);
    expect(byLabel['Тестовый dorm']).toBe(-1);
    expect(byLabel['Лишняя']).toBe(1);
  });
  it('renders a markdown report with PMS / EXELY / DIFF columns and a verdict', () => {
    const md = renderInventoryReport(
      compareInventory({ pms: exely, exely, blocksInPms: 0, blocksInExely: 0 }),
      '2000-01-01',
    );
    expect(md).toMatch(/CONTROL DATE: 2000-01-01/);
    expect(md).toMatch(/\| units total \| 7 \| 7 \| 0 \|/);
    expect(md).toMatch(/RESULT: OK/);
  });
});
