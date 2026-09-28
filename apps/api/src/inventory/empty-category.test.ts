import { expect, it } from 'vitest';
import { summarizeInventoryPlan } from '@pms/domain';
it('keeps category capacity before the first unit is created', () => {
  expect(
    summarizeInventoryPlan({
      buildingName: '',
      floorName: '',
      units: [],
      accommodationTypes: [
        {
          code: 'test',
          name: 'Test',
          kind: 'PRIVATE_ROOM',
          capacityAdults: 2,
          capacityChildren: 0,
        },
      ],
    }).byCategory[0]?.capacityAdults,
  ).toBe(2);
});
