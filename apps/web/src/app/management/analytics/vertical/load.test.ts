import { describe, expect, it, vi, beforeEach } from 'vitest';
const read = vi.hoisted(() => vi.fn());
const period = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/api', () => ({ branchReportDay: read, branchFoodPeriod: period }));
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
beforeEach(() => {
  read.mockReset();
  period.mockReset();
  period.mockResolvedValue({ ordersCount: 0 });
});
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

it('салон до 24:00 (27.10.2026): запись через полночь считается один раз, по дню начала, как в «Отчётах»', async () => {
  // Алматы: 23:00–00:30 по местному, начало 6-го, хвост виден в дне 7-го
  const almaty = { ...branch, timezone: 'Asia/Almaty' };
  const late = { ...row, id: 'late', startsAt: '2026-10-06T18:00:00Z', endsAt: '2026-10-06T19:30:00Z', priceMinor: '500' };
  read.mockImplementation(async (_b: unknown, date: string) => ({
    date,
    location: { id: 'l', timezone: almaty.timezone },
    columns: [],
    appointments: [late],
  }));
  const r = await loadBranchPeriod(almaty, ['2026-10-06', '2026-10-07']);
  expect(r.counts).toMatchObject({ DONE: 1 });
  expect(r.revenue).toEqual({ KZT: '500' });
  // дни для графика и мастеров: хвост в 7-м не повторяется
  expect(r.days.map((d) => d.appointments.length)).toEqual([1, 0]);
  // запись совсем другого дня (не хвост) по-прежнему ошибка данных
  read.mockImplementation(async (_b: unknown, date: string) => ({
    date,
    location: { id: 'l', timezone: almaty.timezone },
    columns: [],
    appointments: [{ ...late, startsAt: '2026-10-04T18:00:00Z', endsAt: '2026-10-04T19:30:00Z' }],
  }));
  await expect(loadBranchPeriod(almaty, ['2026-10-07'])).rejects.toThrow();
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
    food: { ordersCount: 0 },
  });
  // деньги ресторана берутся за весь период одним запросом по филиалу
  expect(period).toHaveBeenCalledWith(food, '2026-10-07', '2026-10-07');
  read.mockResolvedValue({
    items: [{ ...reservation, startsAt: '2026-10-05T11:00:00Z' }],
    nextCursor: null,
  });
  expect(await loadBranchPeriod(food, ['2026-10-07'])).toMatchObject({ counts: { BOOKED: 0 } });
  read.mockResolvedValue({ items: [{ ...reservation, locationId: 'foreign' }], nextCursor: null });
  await expect(loadBranchPeriod(food, ['2026-10-07'])).rejects.toThrow();
});
