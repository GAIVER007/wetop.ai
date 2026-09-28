import { describe, expect, it } from 'vitest';
import { summarizeInventoryPlan, type InventoryImportPlan } from './index';

const plan: InventoryImportPlan = {
  buildingName: 'Тестовый',
  floorName: '1',
  accommodationTypes: [
    {
      code: 'a',
      name: 'Одиночная',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      capacityChildren: 0,
    },
    {
      code: 'b',
      name: 'Двойная',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 2,
      capacityChildren: 0,
    },
    {
      code: 'd',
      name: 'Dorm',
      kind: 'DORM_BED',
      capacityAdults: 1,
      capacityChildren: 0,
    },
  ],
  units: [
    {
      code: '1',
      kind: 'ROOM',
      accommodationTypeCode: 'a',
      roomNumber: '1',
      roomCapacity: 1,
      isDorm: false,
    },
    {
      code: '2',
      kind: 'ROOM',
      accommodationTypeCode: 'b',
      roomNumber: '2',
      roomCapacity: 2,
      isDorm: false,
    },
    {
      code: '10',
      kind: 'BED',
      accommodationTypeCode: 'd',
      roomNumber: '10',
      roomCapacity: 1,
      isDorm: true,
    },
    {
      code: '11',
      kind: 'BED',
      accommodationTypeCode: 'd',
      roomNumber: '11',
      roomCapacity: 1,
      isDorm: true,
    },
  ],
};

describe('summarizeInventoryPlan', () => {
  it('counts units by kind and category and the max guests', () => {
    const s = summarizeInventoryPlan(plan);
    expect(s).toEqual({
      totalUnits: 4,
      rooms: 2,
      beds: 2,
      maxGuests: 5,
      physicalRooms: 4,
      byCategory: [
        { code: 'a', name: 'Одиночная', units: 1, maxGuests: 1, capacityAdults: 1 },
        { code: 'b', name: 'Двойная', units: 1, maxGuests: 2, capacityAdults: 2 },
        { code: 'd', name: 'Dorm', units: 2, maxGuests: 2, capacityAdults: 1 },
      ],
    });
  });
});
