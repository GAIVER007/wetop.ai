import { expect, it } from 'vitest';
import { completeFoodList, occupiedAt, previousDate } from './food-data';
it('loads every page and rejects repeated/broken cursors', async () => {
  const load = async (cursor?: string) =>
    cursor ? { items: [{ id: 'b' }], nextCursor: null } : { items: [{ id: 'a' }], nextCursor: 'a' };
  expect(await completeFoodList(load)).toEqual([{ id: 'a' }, { id: 'b' }]);
  await expect(
    completeFoodList(async () => ({ items: [{ id: 'a' }], nextCursor: 'a' })),
  ).rejects.toThrow();
  await expect(
    completeFoodList(async () => ({ items: [], nextCursor: undefined })),
  ).rejects.toThrow();
});
it('keeps overnight occupancy, excludes terminals and uses half-open time', () => {
  const r = {
    status: 'SEATED',
    startsAt: '2026-10-05T23:30:00+05:00',
    endsAt: '2026-10-06T01:30:00+05:00',
  };
  expect(occupiedAt(r, '2026-10-06T00:30:00+05:00')).toBe(true);
  expect(occupiedAt(r, r.endsAt)).toBe(false);
  expect(occupiedAt({ ...r, status: 'COMPLETED' }, r.startsAt)).toBe(false);
  expect(previousDate('2026-01-01')).toBe('2025-12-31');
});
it('rejects malformed reservation data rather than displaying a free table', async () => {
  const { validFoodReservation } = await import('./food-data');
  expect(
    validFoodReservation({
      id: 'r',
      status: 'BOOKED',
      startsAt: 'bad',
      endsAt: 'bad',
      table: null,
    }),
  ).toBe(false);
  expect(
    validFoodReservation({
      id: 'r',
      status: 'BOOKED',
      startsAt: '2026-10-12T12:00:00Z',
      endsAt: '2026-10-12T14:00:00Z',
    }),
  ).toBe(false);
});

it('requires complete details and valid next statuses before showing occupancy', async () => {
  const { validFoodReservation } = await import('./food-data');
  const r = {
    id: 'r',
    status: 'BOOKED',
    startsAt: '2026-10-12T12:00:00Z',
    endsAt: '2026-10-12T14:00:00Z',
    updatedAt: '2026-10-12T11:00:00Z',
    table: null,
    customer: { firstName: 'Synthetic' },
    servicePeriod: { id: 'p', name: 'Dinner' },
    partySize: 2,
    nextStatuses: ['CONFIRMED'],
  };
  expect(validFoodReservation(r)).toBe(true);
  expect(validFoodReservation({ ...r, servicePeriod: null })).toBe(false);
  expect(validFoodReservation({ ...r, nextStatuses: ['UNSUPPORTED'] })).toBe(false);
  expect(validFoodReservation({ ...r, updatedAt: 'bad' })).toBe(false);
});
