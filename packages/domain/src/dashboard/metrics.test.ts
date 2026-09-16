import { describe, expect, it } from 'vitest';
import { buildDashboard, type DashboardInput } from './metrics';

/** Два дня, две категории (2 номера + 3 койки), вымышленные проживания (ADR-010). */
const input = (): DashboardInput => ({
  from: '2026-10-05',
  to: '2026-10-06',
  categories: [
    { code: 'ROOM', name: 'Двухместная', units: 2 },
    { code: 'DORM', name: 'Мужская общая', units: 3 },
  ],
  days: [
    {
      date: '2026-10-05',
      occupied: 3,
      free: 2,
      blocked: 0,
      byCategory: {
        ROOM: { units: 2, occupied: 1, free: 1, blocked: 0 },
        DORM: { units: 3, occupied: 2, free: 1, blocked: 0 },
      },
    },
    {
      date: '2026-10-06',
      occupied: 4,
      free: 0,
      blocked: 1,
      byCategory: {
        ROOM: { units: 2, occupied: 2, free: 0, blocked: 0 },
        DORM: { units: 3, occupied: 2, free: 0, blocked: 1 },
      },
    },
  ],
  unassigned: 1,
  stays: [
    // заезд в периоде, канал
    {
      arrivalDate: '2026-10-05',
      departureDate: '2026-10-08',
      status: 'CHECKED_IN',
      adults: 2,
      children: 0,
      priceMinor: 3_000_000n,
      source: 'OTA',
      channel: 'Booking.com',
      categoryCode: 'ROOM',
    },
    // заезд в периоде, стойка
    {
      arrivalDate: '2026-10-06',
      departureDate: '2026-10-07',
      status: 'CONFIRMED',
      adults: 1,
      children: 1,
      priceMinor: 500_000n,
      source: 'WALK_IN',
      channel: null,
      categoryCode: 'DORM',
    },
    // отменённый заезд — в заезды не входит, считается отдельно
    {
      arrivalDate: '2026-10-05',
      departureDate: '2026-10-06',
      status: 'CANCELLED',
      adults: 1,
      children: 0,
      priceMinor: 400_000n,
      source: 'OTA',
      channel: 'Booking.com',
      categoryCode: 'DORM',
    },
    // незаезд
    {
      arrivalDate: '2026-10-06',
      departureDate: '2026-10-07',
      status: 'NO_SHOW',
      adults: 1,
      children: 0,
      priceMinor: 400_000n,
      source: 'WEBSITE',
      channel: null,
      categoryCode: 'DORM',
    },
    // выезд в периоде (заезд раньше)
    {
      arrivalDate: '2026-10-01',
      departureDate: '2026-10-05',
      status: 'CHECKED_OUT',
      adults: 1,
      children: 0,
      priceMinor: 1_600_000n,
      source: 'DESK',
      channel: null,
      categoryCode: 'ROOM',
    },
  ],
  charges: [
    { kind: 'ACCOMMODATION', amountMinor: 3_000_000n, categoryCode: 'ROOM' },
    { kind: 'ACCOMMODATION', amountMinor: 500_000n, categoryCode: 'DORM' },
    { kind: 'SERVICE', amountMinor: 150_000n, categoryCode: 'ROOM' },
    { kind: 'PENALTY', amountMinor: 400_000n, categoryCode: 'DORM' },
    { kind: 'ADJUSTMENT', amountMinor: -50_000n, categoryCode: 'ROOM' },
  ],
  payments: [
    { method: 'CASH', amountMinor: 1_000_000n },
    { method: 'KASPI', amountMinor: 2_000_000n },
    { method: 'CASH', amountMinor: 200_000n },
  ],
  refundsMinor: 100_000n,
});

describe('buildDashboard', () => {
  it('загрузка — клетко-ночи шахматки: занято / (единиц × ночей)', () => {
    const d = buildDashboard(input());
    expect(d.nights).toBe(2);
    expect(d.units).toBe(5);
    expect(d.occupancy).toEqual({
      unitNights: 10,
      occupiedNights: 7,
      blockedNights: 1,
      freeNights: 2,
      percent: 70,
    });
    expect(d.unassigned).toBe(1);
  });

  it('деньги — начислено по видам, оплачено по способам, ADR и RevPAR целочисленно в тиынах', () => {
    const d = buildDashboard(input());
    expect(d.revenue).toEqual({
      accommodationMinor: '3500000',
      servicesMinor: '150000',
      penaltiesMinor: '400000',
      adjustmentsMinor: '-50000',
      totalMinor: '4000000',
    });
    expect(d.payments).toEqual({
      totalMinor: '3200000',
      count: 3,
      byMethod: [
        { method: 'KASPI', count: 1, amountMinor: '2000000' },
        { method: 'CASH', count: 2, amountMinor: '1200000' },
      ],
    });
    expect(d.refundsMinor).toBe('100000');
    // 3 500 000 / 7 ночей = 500 000; / 10 клетко-ночей = 350 000
    expect(d.adrMinor).toBe('500000');
    expect(d.revparMinor).toBe('350000');
  });

  it('заезды и выезды по датам периода; отмены и незаезды отдельно; гости — взрослые и дети заехавших', () => {
    const d = buildDashboard(input());
    expect(d.arrivals).toEqual({ count: 2, guests: 4, cancelled: 1, noShow: 1 });
    expect(d.departures).toEqual({ count: 1 });
  });

  it('источники — по заездам без отмен, доля от заездов, канал важнее источника', () => {
    const d = buildDashboard(input());
    expect(d.sources).toEqual([
      { source: 'OTA', channel: 'Booking.com', count: 1, amountMinor: '3000000', share: 50 },
      { source: 'WALK_IN', channel: null, count: 1, amountMinor: '500000', share: 50 },
    ]);
  });

  it('категории — свои клетко-ночи, загрузка, выручка за проживание и ADR', () => {
    const d = buildDashboard(input());
    expect(d.categories).toEqual([
      {
        code: 'ROOM',
        name: 'Двухместная',
        units: 2,
        unitNights: 4,
        occupiedNights: 3,
        percent: 75,
        revenueMinor: '3000000',
        adrMinor: '1000000',
      },
      {
        code: 'DORM',
        name: 'Мужская общая',
        units: 3,
        unitNights: 6,
        occupiedNights: 4,
        percent: 66.7,
        revenueMinor: '500000',
        adrMinor: '125000',
      },
    ]);
  });

  it('по дням — занятость и заезды/выезды на каждую дату', () => {
    const d = buildDashboard(input());
    expect(d.daily).toEqual([
      { date: '2026-10-05', occupied: 3, free: 2, blocked: 0, percent: 60, arrivals: 1, departures: 1 },
      { date: '2026-10-06', occupied: 4, free: 0, blocked: 1, percent: 80, arrivals: 1, departures: 0 },
    ]);
  });

  it('пустой период: нули, ADR и RevPAR — null, а не деление на ноль', () => {
    const d = buildDashboard({
      from: '2026-10-05',
      to: '2026-10-05',
      categories: [],
      days: [{ date: '2026-10-05', occupied: 0, free: 0, blocked: 0, byCategory: {} }],
      unassigned: 0,
      stays: [],
      charges: [],
      payments: [],
      refundsMinor: 0n,
    });
    expect(d.occupancy.percent).toBe(0);
    expect(d.adrMinor).toBeNull();
    expect(d.revparMinor).toBeNull();
    expect(d.sources).toEqual([]);
  });

  it('число дней должно совпадать с периодом — иначе загрузка врёт', () => {
    const bad = input();
    bad.days = bad.days.slice(0, 1);
    expect(() => buildDashboard(bad)).toThrow(/дней/);
  });
});
