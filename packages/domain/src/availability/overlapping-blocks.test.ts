import { describe, expect, it } from 'vitest';
import { categoryAvailability } from './category';
import { sellableStay } from './nearest';

const cases = [
  {
    name: 'identical blocks on one unit',
    rows: [
      ['u1', '01', '04'],
      ['u1', '01', '04'],
    ],
    free: [2, 2, 2, 3],
  },
  {
    name: 'partially overlapping blocks on one unit',
    rows: [
      ['u1', '01', '03'],
      ['u1', '02', '04'],
    ],
    free: [2, 2, 2, 3],
  },
  {
    name: 'overlapping blocks on different units',
    rows: [
      ['u1', '01', '03'],
      ['u2', '02', '04'],
    ],
    free: [2, 1, 2, 3],
  },
  {
    name: 'independent blocks on one unit',
    rows: [
      ['u1', '01', '02'],
      ['u1', '03', '04'],
    ],
    free: [2, 3, 2, 3],
  },
  {
    name: 'touching blocks on one unit',
    rows: [
      ['u1', '01', '02'],
      ['u1', '02', '03'],
    ],
    free: [2, 2, 3, 3],
  },
];
const day = (d: string) => `2030-01-${d}`;
const units = ['u1', 'u2', 'u3'].map((id) => ({
  id,
  code: id,
  kind: 'ROOM' as const,
  accommodationTypeCode: 'room',
  accommodationTypeName: 'Room',
}));

describe('availability counts distinct blocked units per night', () => {
  for (const c of cases) {
    const blocks = c.rows.map(([unitId, from, to]) => ({
      unitId: unitId!,
      accommodationTypeCode: 'room',
      dateFrom: day(from!),
      dateTo: day(to!),
      type: 'MAINTENANCE' as const,
    }));
    it(`channel category: ${c.name}`, () => {
      const out = categoryAvailability({
        from: day('01'),
        to: day('04'),
        units: [{ code: 'room', active: 3 }],
        blocks,
        items: [],
      });
      expect([...out.get('room')!.values()]).toEqual(c.free);
    });
    it(`sellableStay: ${c.name}`, () => {
      const actual = ['01', '02', '03', '04'].map(
        (d, i) =>
          sellableStay({
            arrivalDate: day(d),
            departureDate: day(String(i + 2).padStart(2, '0')),
            units,
            blocks,
            allocations: [],
            sold: [],
          }).byCategory.room!.available,
      );
      expect(actual).toEqual(c.free);
    });
  }
  it('legacy anonymous blocks remain independent instead of collapsing into one undefined identity', () => {
    const out = categoryAvailability({
      from: day('01'),
      to: day('01'),
      units: [{ code: 'room', active: 3 }],
      items: [],
      blocks: [
        { accommodationTypeCode: 'room', dateFrom: day('01'), dateTo: day('02') },
        { accommodationTypeCode: 'room', dateFrom: day('01'), dateTo: day('02') },
      ],
    });
    expect(out.get('room')!.get(day('01'))).toBe(1);
  });
});
