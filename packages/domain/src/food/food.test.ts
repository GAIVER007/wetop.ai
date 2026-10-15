import { describe, expect, it } from 'vitest';
import {
  parseFoodCatalog,
  parseFoodCreate,
  foodEnd,
  foodNext,
  foodCapacity,
  foodFingerprint,
  foodInstant,
} from './food';
const id = '11111111-1111-4111-8111-111111111111';
const period = {
  weekday: 1,
  timeFrom: '18:00',
  timeTo: '02:00',
  endsNextDay: true,
  defaultDurationMinutes: 90,
};
describe('Food v1', () => {
  it('validates catalog and refuses scope/invalid fields', () => {
    expect(parseFoodCatalog('table', { areaId: id, name: ' A ', capacity: 4 })).toMatchObject({
      name: 'A',
      capacity: 4,
    });
    expect(() => parseFoodCatalog('table', { areaId: id, name: 'A', capacity: 0 })).toThrow();
    expect(() => parseFoodCatalog('area', { name: 'A', businessId: id })).toThrow();
    expect(() =>
      parseFoodCatalog('period', {
        name: 'A',
        weekday: 7,
        timeFrom: '09:00',
        timeTo: '08:00',
        defaultDurationMinutes: 30,
      }),
    ).toThrow();
  });
  it('normalizes creation and rejects trusted end/scope or ambiguous customer', () => {
    const value = {
      servicePeriodId: id,
      startsAt: '2026-10-12T18:00:00+05:00',
      partySize: 2,
      customerId: id,
    };
    const a = parseFoodCreate(value);
    expect(a.startsAt).toBe('2026-10-12T13:00:00.000Z');
    expect(foodFingerprint(a)).toBe(
      foodFingerprint(parseFoodCreate({ ...value, source: 'DESK', notes: null })),
    );
    expect(() => parseFoodCreate({ ...value, endsAt: '2026-10-12' })).toThrow();
    expect(() => parseFoodCreate({ ...value, customer: { firstName: 'Test' } })).toThrow();
    expect(() => parseFoodCreate({ ...value, source: 'WALK_IN' })).toThrow();
  });
  it('uses local weekday and preceding overnight window', () => {
    expect(foodEnd(period, '2026-10-12T19:30:00Z', 'Asia/Almaty').toISOString()).toBe(
      '2026-10-12T21:00:00.000Z',
    );
    expect(() => foodEnd(period, '2026-10-12T20:00:00Z', 'Asia/Almaty')).toThrow();
    expect(() => foodEnd(period, '2026-10-13T19:30:00Z', 'Asia/Almaty')).toThrow();
    expect(() =>
      foodEnd(
        { ...period, endsNextDay: false, timeTo: '23:00', defaultDurationMinutes: 120 },
        '2026-10-12T17:00:00Z',
        'Asia/Almaty',
      ),
    ).toThrow();
  });
  it('same-day window and adjacent endpoint', () => {
    expect(
      foodEnd(
        { ...period, endsNextDay: false, timeTo: '23:00', defaultDurationMinutes: 120 },
        '2026-10-12T16:00:00Z',
        'Asia/Almaty',
      ).toISOString(),
    ).toBe('2026-10-12T18:00:00.000Z');
  });
  it('rejects nonexistent calendar dates', () => {
    expect(() => foodInstant('2026-02-30T12:00:00Z')).toThrow();
  });
  it('terminal statuses and capacity', () => {
    expect(foodNext('BOOKED')).toEqual(['CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW']);
    for (const s of ['COMPLETED', 'NO_SHOW', 'CANCELLED'] as const) expect(foodNext(s)).toEqual([]);
    expect(foodCapacity(6, 6)).toBe(true);
    expect(foodCapacity(8, 6)).toBe(false);
  });
});
