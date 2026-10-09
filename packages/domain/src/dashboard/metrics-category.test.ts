import { describe, expect, it } from 'vitest';
import { buildDashboard, type DashboardInput } from './metrics';

const base = (): DashboardInput => ({
  from: '2026-10-05',
  to: '2026-10-06',
  categories: [
    { code: 'ROOM', name: 'Двухместная', units: 2, kind: 'ROOM' },
    { code: 'LUX', name: 'Люкс', units: 1, kind: 'ROOM' },
    { code: 'DORM', name: 'Мужская общая', units: 3, kind: 'BED' },
  ],
  days: ['2026-10-05', '2026-10-06'].map((date) => ({
    date,
    occupied: 3,
    free: 3,
    blocked: 0,
    byCategory: {
      ROOM: { units: 2, occupied: 1, free: 1, blocked: 0 },
      LUX: { units: 1, occupied: 1, free: 0, blocked: 0 },
      DORM: { units: 3, occupied: 1, free: 2, blocked: 0 },
    },
  })),
  unassignedByCategory: { LUX: 1 },
  stays: [
    {
      arrivalDate: '2026-10-05',
      departureDate: '2026-10-07',
      status: 'CONFIRMED',
      reservationId: 'R-1',
      reservationStatus: 'CONFIRMED',
      adults: 2,
      children: 0,
      priceMinor: 900_000n,
      source: 'OTA',
      channel: 'Booking.com',
      categoryCode: 'LUX',
    },
    {
      arrivalDate: '2026-10-05',
      departureDate: '2026-10-06',
      status: 'CONFIRMED',
      reservationId: 'R-2',
      reservationStatus: 'CONFIRMED',
      adults: 1,
      children: 0,
      priceMinor: 100_000n,
      source: 'WALK_IN',
      channel: null,
      categoryCode: 'DORM',
    },
  ],
  charges: [
    {
      kind: 'ACCOMMODATION',
      amountMinor: 900_000n,
      categoryCode: 'LUX',
      serviceDate: '2026-10-05',
    },
    {
      kind: 'ACCOMMODATION',
      amountMinor: 100_000n,
      categoryCode: 'DORM',
      serviceDate: '2026-10-05',
    },
  ],
  payments: [{ method: 'CASH', amountMinor: 50_000n }],
  refundsMinor: 0n,
});

describe('фильтр по категории в сводке периода (RPT2.2c-2)', () => {
  it('остаётся одна категория: фонд, ночи, выручка, брони и дни пересобираются по ней', () => {
    const d = buildDashboard(base(), 'all', { category: 'LUX' });
    expect(d.units).toBe(1);
    expect(d.occupancy).toMatchObject({ unitNights: 2, occupiedNights: 2, percent: 100 });
    expect(d.revenue.accommodationMinor).toBe('900000');
    expect(d.bookings.total).toBe(1);
    expect(d.categories.map((c) => c.code)).toEqual(['LUX']);
    expect(d.daily.every((x) => x.occupied === 1)).toBe(true);
    expect(d.unassigned).toBe(1);
  });

  it('без фильтра и с категорией «все» итог прежний', () => {
    const all = buildDashboard(base(), 'all');
    expect(buildDashboard(base(), 'all', {})).toEqual(all);
    expect(all.units).toBe(6);
  });

  it('категория другого типа фонда при fund=rooms даёт пустой фонд, а не чужие цифры', () => {
    const d = buildDashboard(base(), 'rooms', { category: 'DORM' });
    expect(d.units).toBe(0);
    expect(d.occupancy.unitNights).toBe(0);
    expect(d.revenue.accommodationMinor).toBe('0');
  });

  it('оплаты и возвраты остаются по объекту, как при фильтре по фонду', () => {
    const d = buildDashboard(base(), 'all', { category: 'LUX' });
    expect(d.payments.totalMinor).toBe('50000');
  });
});
