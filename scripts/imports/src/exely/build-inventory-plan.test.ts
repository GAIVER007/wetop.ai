import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildInventoryImportPlan } from './build-inventory-plan';
import { parseExelyAccommodationTypes } from './parse-accommodation-types';
import { parseExelyInventory } from './parse-inventory';

const inv = parseExelyInventory(
  readFileSync(new URL('./__fixtures__/inventory.md', import.meta.url), 'utf-8'),
);
const types = parseExelyAccommodationTypes(
  readFileSync(new URL('./__fixtures__/spravochniki.md', import.meta.url), 'utf-8'),
);

describe('buildInventoryImportPlan', () => {
  it('joins units to categories by name and builds PhysicalRoom 1:1 (ADR-013)', () => {
    const plan = buildInventoryImportPlan(inv, types);
    expect(plan.buildingName).toBe('Тестовый');
    expect(plan.floorName).toBe('1');
    expect(plan.accommodationTypes.map((t) => t.code)).toEqual([
      'exely-900001',
      'exely-900002',
      'exely-900003',
    ]);
    expect(plan.units).toHaveLength(7);
    const u99 = plan.units.find((u) => u.exelyRoomNumber === '99');
    expect(u99).toEqual({
      code: '99',
      exelyRoomNumber: '99',
      kind: 'ROOM',
      accommodationTypeCode: 'exely-900002',
      roomNumber: '99',
      roomCapacity: 2,
      isDorm: false,
    });
    expect(plan.units.filter((u) => u.isDorm)).toHaveLength(3);
  });
  it('rejects a unit whose category is unknown', () => {
    const broken = {
      ...inv,
      declaredTotal: null,
      units: [
        ...inv.units,
        { exelyRoomNumber: '500', categoryName: 'Нет такой', kind: 'ROOM' as const, capacity: 1 },
      ],
    };
    expect(() => buildInventoryImportPlan(broken, types)).toThrow(/500.*Нет такой/);
  });
  it('rejects a unit whose type contradicts its category (номер в dorm-категории)', () => {
    const broken = {
      ...inv,
      units: inv.units.map((u) =>
        u.exelyRoomNumber === '10' ? { ...u, kind: 'ROOM' as const } : u,
      ),
    };
    expect(() => buildInventoryImportPlan(broken, types)).toThrow(/10.*ROOM.*DORM_BED/);
  });
  it('rejects when declared total differs from parsed rows', () => {
    expect(() => buildInventoryImportPlan({ ...inv, declaredTotal: 8 }, types)).toThrow(/8.*7/);
  });
  it('refuses more than one building or floor: the export has no unit→floor mapping', () => {
    const broken = { ...inv, buildings: [...inv.buildings, { name: 'Второй', floors: ['2'] }] };
    expect(() => buildInventoryImportPlan(broken, types)).toThrow(/одно здание/i);
  });
});
