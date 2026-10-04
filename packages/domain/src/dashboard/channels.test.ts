import { describe, expect, it } from 'vitest';
import { buildChannelEfficiency } from './channels';
import type { DashboardStay } from './metrics';

const stay = (o: Partial<DashboardStay> & { reservationId: string }): DashboardStay => ({
  arrivalDate: '2026-10-02',
  departureDate: '2026-10-04',
  status: 'CONFIRMED',
  reservationStatus: 'CONFIRMED',
  adults: 1,
  children: 0,
  priceMinor: 2_000_000n,
  source: 'OTA',
  channel: 'Booking.com',
  categoryCode: 'ROOM',
  ...o,
});

describe('эффективность каналов: доход, ночи, средняя стоимость ночи по каналу (брони с заездом в периоде)', () => {
  const stays = [
    stay({ reservationId: 'b1' }), // Booking: 2 ночи, 20 000 ₸
    stay({ reservationId: 'b2', arrivalDate: '2026-10-10', departureDate: '2026-10-13', priceMinor: 3_300_000n }), // 3 ночи
    stay({ reservationId: 't1', channel: 'Trip.com', priceMinor: 1_000_000n }), // 2 ночи
    stay({ reservationId: 'd1', source: 'DESK', channel: null, priceMinor: 800_000n, departureDate: '2026-10-03' }), // 1 ночь
    // не входят: отменённая, незаезд, заезд до периода, отменённое место внутри живой брони
    stay({ reservationId: 'x1', reservationStatus: 'CANCELLED' }),
    stay({ reservationId: 'x2', reservationStatus: 'NO_SHOW', channel: 'Agoda' }),
    stay({ reservationId: 'x3', arrivalDate: '2026-09-29', departureDate: '2026-10-02' }),
    stay({ reservationId: 'b1', status: 'CANCELLED', priceMinor: 9_999_900n }),
  ];

  it('строки по каналу: сумма, доля дохода, ночи, доля ночей, средняя стоимость; прямые источники отдельными строками', () => {
    const r = buildChannelEfficiency(stays, '2026-10-01', '2026-10-31');
    expect(r.rows.map((x) => [x.label, x.revenueMinor, x.revenueShare, x.nights, x.nightsShare, x.adrMinor, x.bookings])).toEqual([
      ['Booking.com', '5300000', 74.6, 5, 62.5, '1060000', 2],
      ['Trip.com', '1000000', 14.1, 2, 25, '500000', 1],
      ['DESK', '800000', 11.3, 1, 12.5, '800000', 1],
    ]);
    expect(r.rows[2]).toMatchObject({ source: 'DESK', channel: null });
    expect(r.totals).toEqual({ revenueMinor: '7100000', nights: 8, adrMinor: '887500', bookings: 4 });
  });

  it('каналы без броней: нулевыми строками, только если просили; известные дубликаты не повторяются', () => {
    const r = buildChannelEfficiency(stays, '2026-10-01', '2026-10-31', {
      knownChannels: ['Booking.com', 'Agoda', 'Hostelworld'],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Booking.com', 'Trip.com', 'DESK', 'Agoda', 'Hostelworld']);
    expect(r.rows.at(-1)).toMatchObject({ revenueMinor: '0', nights: 0, adrMinor: null, revenueShare: 0 });
  });

  it('отбор по каналу и порядок: по ночам, по средней стоимости', () => {
    const trip = buildChannelEfficiency(stays, '2026-10-01', '2026-10-31', { channel: 'Trip.com' });
    expect(trip.rows.map((x) => x.label)).toEqual(['Trip.com']);
    // «Итого»: по показанным строкам, доли: от всех каналов периода
    expect(trip.totals).toEqual({ revenueMinor: '1000000', nights: 2, adrMinor: '500000', bookings: 1 });
    expect(trip.rows[0]!.revenueShare).toBe(14.1);
    // список «Канал» на экране: все каналы периода, и при отборе
    expect(trip.channels).toEqual([
      { label: 'Booking.com', source: 'OTA' },
      { label: 'Trip.com', source: 'OTA' },
      { label: 'DESK', source: 'DESK' },
    ]);
    expect(buildChannelEfficiency(stays, '2026-10-01', '2026-10-31', { sort: 'adr' }).rows.map((x) => x.label)).toEqual(['Booking.com', 'DESK', 'Trip.com']);
    expect(buildChannelEfficiency(stays, '2026-10-01', '2026-10-31', { sort: 'nights' }).rows[0]!.label).toBe('Booking.com');
  });

  it('средняя стоимость: целые тиыны, как ADR «Обзора» (остаток отбрасывается); пустой период: без деления', () => {
    const odd = [stay({ reservationId: 'o', priceMinor: 1_000_001n, departureDate: '2026-10-04' })];
    expect(buildChannelEfficiency(odd, '2026-10-01', '2026-10-31').rows[0]!.adrMinor).toBe('500000');
    expect(buildChannelEfficiency([], '2026-10-01', '2026-10-31').totals).toEqual({ revenueMinor: '0', nights: 0, adrMinor: null, bookings: 0 });
  });
});
