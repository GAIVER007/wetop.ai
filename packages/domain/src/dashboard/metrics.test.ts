import { describe, expect, it } from 'vitest';
import { buildDashboard, type DashboardInput } from './metrics';

/** Два дня, две категории (2 номера + 3 койки), вымышленные проживания (ADR-010). */
const input = (): DashboardInput => ({
  from: '2026-10-05',
  to: '2026-10-06',
  categories: [
    { code: 'ROOM', name: 'Двухместная', units: 2, kind: 'ROOM' },
    { code: 'DORM', name: 'Мужская общая', units: 3, kind: 'BED' },
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
  unassignedByCategory: { DORM: 1 },
  stays: [
    // заезд в периоде, канал
    {
      arrivalDate: '2026-10-05',
      departureDate: '2026-10-08',
      status: 'CHECKED_IN',
      reservationId: 'R-1',
      reservationStatus: 'CHECKED_IN',
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
      reservationId: 'R-2',
      reservationStatus: 'CONFIRMED',
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
      reservationId: 'R-3',
      reservationStatus: 'CANCELLED',
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
      reservationId: 'R-4',
      reservationStatus: 'NO_SHOW',
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
      reservationId: 'R-5',
      reservationStatus: 'CHECKED_OUT',
      adults: 1,
      children: 0,
      priceMinor: 1_600_000n,
      source: 'DESK',
      channel: null,
      categoryCode: 'ROOM',
    },
  ],
  charges: [
    // проживание датировано днём заезда — одно начисление на проживание
    {
      kind: 'ACCOMMODATION',
      amountMinor: 3_000_000n,
      categoryCode: 'ROOM',
      serviceDate: '2026-10-05',
    },
    {
      kind: 'ACCOMMODATION',
      amountMinor: 500_000n,
      categoryCode: 'DORM',
      serviceDate: '2026-10-06',
    },
    { kind: 'SERVICE', amountMinor: 150_000n, categoryCode: 'ROOM', serviceDate: '2026-10-05' },
    { kind: 'PENALTY', amountMinor: 400_000n, categoryCode: 'DORM', serviceDate: '2026-10-06' },
    { kind: 'ADJUSTMENT', amountMinor: -50_000n, categoryCode: 'ROOM', serviceDate: '2026-10-06' },
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
        kind: 'ROOM',
        units: 2,
        unitNights: 4,
        occupiedNights: 3,
        freeNights: 1,
        blockedNights: 0,
        unassigned: 0,
        percent: 75,
        revenueMinor: '3000000',
        adrMinor: '1000000',
      },
      {
        code: 'DORM',
        name: 'Мужская общая',
        kind: 'BED',
        units: 3,
        unitNights: 6,
        occupiedNights: 4,
        freeNights: 1,
        blockedNights: 1,
        unassigned: 1,
        percent: 66.7,
        revenueMinor: '500000',
        adrMinor: '125000',
      },
    ]);
  });

  it('по дням — занятость, заезды/выезды и начисленное за проживание на каждую дату', () => {
    const d = buildDashboard(input());
    expect(d.daily).toEqual([
      {
        date: '2026-10-05',
        occupied: 3,
        free: 2,
        blocked: 0,
        percent: 60,
        arrivals: 1,
        departures: 1,
        revenueMinor: '3000000',
      },
      {
        date: '2026-10-06',
        occupied: 4,
        free: 0,
        blocked: 1,
        percent: 80,
        arrivals: 1,
        departures: 0,
        revenueMinor: '500000',
      },
    ]);
  });

  it('пустой период: нули, ADR и RevPAR — null, а не деление на ноль', () => {
    const d = buildDashboard({
      from: '2026-10-05',
      to: '2026-10-05',
      categories: [],
      days: [{ date: '2026-10-05', occupied: 0, free: 0, blocked: 0, byCategory: {} }],
      unassignedByCategory: {},
      stays: [],
      charges: [],
      payments: [],
      refundsMinor: 0n,
    });
    expect(d.occupancy.percent).toBe(0);
    expect(d.adrMinor).toBeNull();
    expect(d.revparMinor).toBeNull();
    expect(d.sources).toEqual([]);
    expect(d.bookings.averageMinor).toBeNull();
    expect(d.bookings.cancelledPercent).toBe(0);
  });

  it('число дней должно совпадать с периодом — иначе загрузка врёт', () => {
    const bad = input();
    bad.days = bad.days.slice(0, 1);
    expect(() => buildDashboard(bad)).toThrow(/дней/);
  });
});

/** Аналитика v2, срез AN1 (plans/analytics-v2-an1-2026-09-27.md): брони, выручка по дням, тип фонда. */
describe('buildDashboard: брони и тип фонда', () => {
  it('брони — все проживания с заездом в периоде; отмены и незаезды долей; средний чек — по действующим', () => {
    const d = buildDashboard(input());
    expect(d.bookings).toEqual({
      total: 4,
      active: 2,
      stays: 2,
      cancelled: 1,
      noShow: 1,
      cancelledPercent: 25,
      noShowPercent: 25,
      valueMinor: '3500000',
      averageMinor: '1750000',
    });
  });

  it('состав фонда виден при любом типе: номеров и коек сколько есть', () => {
    expect(buildDashboard(input()).funds).toEqual({ rooms: 2, beds: 3 });
    expect(buildDashboard(input(), 'beds').funds).toEqual({ rooms: 2, beds: 3 });
    expect(buildDashboard(input()).fund).toBe('all');
  });

  it('номера: считаются только категории из номеров — койки в среднюю цену номера не попадают', () => {
    const d = buildDashboard(input(), 'rooms');
    expect(d.fund).toBe('rooms');
    expect(d.units).toBe(2);
    expect(d.occupancy).toEqual({
      unitNights: 4,
      occupiedNights: 3,
      blockedNights: 0,
      freeNights: 1,
      percent: 75,
    });
    expect(d.revenue.accommodationMinor).toBe('3000000');
    // 3 000 000 / 3 проданные ночи номеров; / (2 номера × 2 ночи)
    expect(d.adrMinor).toBe('1000000');
    expect(d.revparMinor).toBe('750000');
    expect(d.bookings).toMatchObject({
      total: 1,
      active: 1,
      cancelled: 0,
      averageMinor: '3000000',
    });
    expect(d.sources).toEqual([
      { source: 'OTA', channel: 'Booking.com', count: 1, amountMinor: '3000000', share: 100 },
    ]);
    expect(d.categories.map((c) => c.code)).toEqual(['ROOM']);
    expect(d.unassigned).toBe(0);
    expect(d.daily.map((p) => [p.occupied, p.free, p.blocked, p.percent, p.revenueMinor])).toEqual([
      [1, 1, 0, 50, '3000000'],
      [2, 0, 0, 100, '0'],
    ]);
  });

  it('койки: своя загрузка с блокировками в знаменателе, своя средняя цена и свои отмены', () => {
    const d = buildDashboard(input(), 'beds');
    expect(d.units).toBe(3);
    expect(d.occupancy).toEqual({
      unitNights: 6,
      occupiedNights: 4,
      blockedNights: 1,
      freeNights: 1,
      percent: 66.7,
    });
    expect(d.adrMinor).toBe('125000');
    // 500 000 / 6 клетко-ночей — целочисленно в тиынах
    expect(d.revparMinor).toBe('83333');
    expect(d.bookings).toEqual({
      total: 3,
      active: 1,
      stays: 1,
      cancelled: 1,
      noShow: 1,
      cancelledPercent: 33.3,
      noShowPercent: 33.3,
      valueMinor: '500000',
      averageMinor: '500000',
    });
    expect(d.unassigned).toBe(1);
  });
});

/**
 * Q-209 (решение владельца 28.09.2026): одна Reservation — одна бронь. Групповая бронь на три койки —
 * «Брони: 1, размещений: 3»; отмены, средний чек и источники считаются бронями, а не койками.
 */
describe('buildDashboard: бронь — это Reservation, а не место внутри неё', () => {
  const group = (status = 'CONFIRMED', itemStatuses = ['CONFIRMED', 'CONFIRMED', 'CONFIRMED']) =>
    itemStatuses.map((itemStatus) => ({
      arrivalDate: '2026-10-06',
      departureDate: '2026-10-08',
      status: itemStatus,
      reservationId: 'G-1',
      reservationStatus: status,
      adults: 1,
      children: 0,
      priceMinor: 200_000n,
      source: 'PHONE',
      channel: null,
      categoryCode: 'DORM',
    }));
  const withGroup = (stays = group()): DashboardInput => {
    const base = input();
    return { ...base, stays: [...base.stays, ...stays] };
  };

  it('групповая бронь на три койки — одна бронь и три размещения; средний чек — на бронь', () => {
    const d = buildDashboard(withGroup());
    // брони: R-1, R-2, отменённая R-3, незаезд R-4 и группа G-1 = 5; к заезду — R-1, R-2, G-1
    expect(d.bookings).toMatchObject({ total: 5, active: 3, stays: 5, cancelled: 1, noShow: 1 });
    expect(d.bookings.cancelledPercent).toBe(20);
    // 3 000 000 + 500 000 + 3 × 200 000 = 4 100 000 на три брони
    expect(d.bookings.valueMinor).toBe('4100000');
    expect(d.bookings.averageMinor).toBe('1366666');
  });

  it('источники считают брони: группа из телефона — одна бронь с суммой за три места', () => {
    const d = buildDashboard(withGroup());
    expect(d.sources.find((x) => x.source === 'PHONE')).toEqual({
      source: 'PHONE',
      channel: null,
      count: 1,
      amountMinor: '600000',
      share: 33.3,
    });
  });

  it('отменённое место в действующей группе: бронь остаётся, стоимость — без отменённого места', () => {
    const d = buildDashboard(
      withGroup(group('CONFIRMED', ['CONFIRMED', 'CONFIRMED', 'CANCELLED'])),
    );
    expect(d.bookings).toMatchObject({ total: 5, active: 3, stays: 4, cancelled: 1 });
    expect(d.bookings.valueMinor).toBe('3900000');
  });

  it('отменённая групповая бронь — одна отмена, а не три', () => {
    const d = buildDashboard(
      withGroup(group('CANCELLED', ['CANCELLED', 'CANCELLED', 'CANCELLED'])),
    );
    expect(d.bookings).toMatchObject({ total: 5, active: 2, cancelled: 2, noShow: 1 });
    expect(d.bookings.cancelledPercent).toBe(40);
  });
});
