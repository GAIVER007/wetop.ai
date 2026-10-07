import { describe, expect, it, vi, beforeEach } from 'vitest';
const read = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/api', () => ({ branchReportDay: read }));
import { loadBranchPeriod } from './load';
const branch = {
  id: 'l',
  locationId: 'l',
  vertical: 'BEAUTY' as const,
  name: 'Salon',
  timezone: 'Pacific/Kiritimati',
  location: { businessId: 'b' },
};
const row = {
  id: 'a',
  startsAt: '2026-10-06T11:00:00Z',
  status: 'DONE',
  priceMinor: '101',
  currency: 'KZT',
};
beforeEach(() => read.mockReset());
describe('MV9 scoped report adapters', () => {
  it('checks day and location identity before counting actual snapshots', async () => {
    read.mockResolvedValue({
      date: '2026-10-07',
      location: { id: 'l', timezone: branch.timezone },
      appointments: [row],
    });
    expect(await loadBranchPeriod(branch, ['2026-10-07'])).toMatchObject({
      counts: { DONE: 1 },
      revenue: { KZT: '101' },
    });
    read.mockResolvedValue({
      date: '2026-10-07',
      location: { id: 'foreign', timezone: branch.timezone },
      appointments: [row],
    });
    await expect(loadBranchPeriod(branch, ['2026-10-07'])).rejects.toThrow();
  });
  it('does not mislabel another date or count appointments outside the local date', async () => {
    read.mockResolvedValue({
      date: '2026-10-06',
      location: { id: 'l', timezone: branch.timezone },
      appointments: [row],
    });
    await expect(loadBranchPeriod(branch, ['2026-10-07'])).rejects.toThrow();
    read.mockResolvedValue({
      date: '2026-10-07',
      location: { id: 'l', timezone: branch.timezone },
      appointments: [{ ...row, startsAt: '2026-10-05T11:00:00Z' }],
    });
    await expect(loadBranchPeriod(branch, ['2026-10-07'])).rejects.toThrow();
  });
});

it('Food period excludes previous-day overlap and rejects a foreign Location response', async () => {
  const food = { ...branch, vertical: 'FOOD_SERVICE' as const };
  const reservation = {
    id: 'r',
    locationId: 'l',
    status: 'BOOKED',
    startsAt: '2026-10-06T11:00:00Z',
    endsAt: '2026-10-07T11:00:00Z',
    updatedAt: '2026-10-06T11:00:00Z',
    partySize: 2,
    customer: { firstName: 'Synthetic' },
    servicePeriod: { id: 'p', name: 'Synthetic' },
    nextStatuses: [],
    table: null,
  };
  read.mockResolvedValue({ items: [reservation], nextCursor: null });
  expect(await loadBranchPeriod(food, ['2026-10-07'])).toMatchObject({
    counts: { BOOKED: 1 },
    revenue: null,
  });
  read.mockResolvedValue({
    items: [{ ...reservation, startsAt: '2026-10-05T11:00:00Z' }],
    nextCursor: null,
  });
  expect(await loadBranchPeriod(food, ['2026-10-07'])).toMatchObject({ counts: { BOOKED: 0 } });
  read.mockResolvedValue({ items: [{ ...reservation, locationId: 'foreign' }], nextCursor: null });
  await expect(loadBranchPeriod(food, ['2026-10-07'])).rejects.toThrow();
});
