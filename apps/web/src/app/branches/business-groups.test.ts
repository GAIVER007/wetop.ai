import { describe, expect, it } from 'vitest';
import { groupBusinessBranches } from './business-groups';
import type { BranchItem } from '../../lib/api';
const branch = (
  id: string,
  businessId: string,
  vertical: BranchItem['vertical'] = 'HOSPITALITY',
): BranchItem => ({
  id,
  name: id,
  address: null,
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  vertical,
  locationId: id,
  location: { businessId },
  _count: { inventoryUnits: 0, accommodationTypes: 0 },
});
describe('business cards in one organization', () => {
  it('groups the branches of a business without merging other businesses of the same vertical', () => {
    const groups = groupBusinessBranches([
      branch('a', 'hotel-a'),
      branch('b', 'hotel-a'),
      branch('c', 'hotel-b'),
      branch('d', 'beauty', 'BEAUTY'),
    ]);
    expect(groups.map((g) => [g.id, g.branches.map((b) => b.id)])).toEqual([
      ['hotel-a', ['a', 'b']],
      ['hotel-b', ['c']],
      ['beauty', ['d']],
    ]);
  });
  it('keeps a business without objects visible', () => {
    expect(groupBusinessBranches([], [{ id: 'empty', vertical: 'BEAUTY' }])).toEqual([
      { id: 'empty', vertical: 'BEAUTY', branches: [] },
    ]);
  });
  it('does not fabricate businesses in an empty organization', () =>
    expect(groupBusinessBranches([])).toEqual([]));
});
