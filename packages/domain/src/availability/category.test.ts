import { describe, expect, it } from 'vitest';
import { categoryAvailability } from './category';

describe('categoryAvailability (для каналов)', () => {
  it('available = active units − blocked cells − sold items per night, floored at 0; sold counts unassigned items too', () => {
    const out = categoryAvailability({
      from: '2026-11-20',
      to: '2026-11-23',
      units: [
        { code: 'dorm', active: 36 },
        { code: 'single', active: 1 },
      ],
      blocks: [{ accommodationTypeCode: 'dorm', dateFrom: '2026-11-22', dateTo: '2026-11-24' }],
      items: [
        { accommodationTypeCode: 'dorm', arrivalDate: '2026-11-20', departureDate: '2026-11-22' },
        { accommodationTypeCode: 'dorm', arrivalDate: '2026-11-21', departureDate: '2026-11-23' },
        { accommodationTypeCode: 'single', arrivalDate: '2026-11-20', departureDate: '2026-11-21' },
        { accommodationTypeCode: 'single', arrivalDate: '2026-11-20', departureDate: '2026-11-21' }, // овербук по проживаниям → 0, не −1
      ],
    });
    expect(out.get('dorm')).toEqual(
      new Map([
        ['2026-11-20', 35],
        ['2026-11-21', 34],
        ['2026-11-22', 34],
        ['2026-11-23', 35],
      ]),
    );
    expect(out.get('single')).toEqual(
      new Map([
        ['2026-11-20', 0],
        ['2026-11-21', 1],
        ['2026-11-22', 1],
        ['2026-11-23', 1],
      ]),
    );
  });
});
