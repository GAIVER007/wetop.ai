import { describe, expect, it } from 'vitest';
import { checkShift, parseShiftTable } from './shift-check';
import {
  gatherShift,
  localStamp,
  plusDays,
  type ApiGet,
  type ChannexSource,
} from './shift-check-sources';

/**
 * Сбор данных сверки смены на подставных ответах API WETOP и Channex: от ответов до строк журнала. Проверяется,
 * что берутся нужные адреса и только GET, что окно смены режется по часам объекта, что чужие строки журнала
 * (служебный ключ видит все организации) выкидываются, а номер брони в канале из таблицы находит бронь WETOP.
 */

const DATE = '2026-10-06';
const A = '20261006-AAAAAA';
const BDC = 'BDC-1556013801';

function fakeApi(over: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    '/audit': [
      {
        at: '2026-10-06T04:20:00Z',
        entityType: 'Reservation',
        action: 'reservation.checkIn',
        subject: A,
      },
      {
        at: '2026-10-06T04:10:00Z',
        entityType: 'Reservation',
        action: 'reservation.create',
        subject: A,
      },
      {
        at: '2026-10-06T04:11:00Z',
        entityType: 'Reservation',
        action: 'reservation.update',
        subject: A,
      },
      {
        at: '2026-10-06T03:00:00Z',
        entityType: 'Reservation',
        action: 'reservation.create',
        subject: 'CHUZHOI-1',
      },
      {
        at: '2026-10-05T10:00:00Z',
        entityType: 'Reservation',
        action: 'reservation.cancel',
        subject: A,
      },
    ],
    created: {
      total: 1,
      rows: [
        {
          confirmationNumber: A,
          status: 'CHECKED_IN',
          source: 'DESK',
          channel: null,
          arrivalDate: DATE,
          departureDate: '2026-10-08',
        },
      ],
    },
    ota: {
      total: 1,
      rows: [
        {
          confirmationNumber: BDC,
          status: 'CHECKED_IN',
          source: 'OTA',
          channel: 'Booking.com',
          arrivalDate: DATE,
          departureDate: '2026-10-07',
        },
      ],
    },
    [`/reservations/${A}`]: {
      confirmationNumber: A,
      status: 'CHECKED_IN',
      source: 'DESK',
      channel: null,
      externalId: null,
      arrivalDate: DATE,
      departureDate: '2026-10-08',
    },
    'q=1556013801': {
      total: 1,
      rows: [
        {
          confirmationNumber: BDC,
          status: 'CHECKED_IN',
          source: 'OTA',
          channel: 'Booking.com',
          arrivalDate: DATE,
          departureDate: '2026-10-07',
        },
      ],
    },
    '/finance/operations': {
      truncated: false,
      rows: [
        {
          kind: 'PAYMENT',
          status: 'COMPLETED',
          method: 'KASPI',
          amountMinor: '1200000',
          confirmationNumber: A,
          localAt: '2026-10-06 09:12',
        },
        {
          kind: 'PAYMENT',
          status: 'COMPLETED',
          method: 'EXTERNAL',
          amountMinor: '900000',
          confirmationNumber: BDC,
          localAt: '2026-10-06 08:00',
        },
        {
          kind: 'PAYMENT',
          status: 'COMPLETED',
          method: 'CASH',
          amountMinor: '5000',
          confirmationNumber: A,
          localAt: '2026-10-06 23:50',
        },
      ],
    },
    '/finance/cash': {
      reconciliations: [
        {
          method: 'CASH',
          localAt: '2026-10-06 13:00',
          expectedMinor: '5000000',
          countedMinor: '5000000',
        },
      ],
    },
    '/chessboard': {
      byCategory: {
        [DATE]: { DORM6: { units: 6, occupied: 4, blocked: 0 } },
        [plusDays(DATE, 1)]: { DORM6: { units: 6, occupied: 3, blocked: 1 } },
      },
      unassigned: [],
    },
    '/channels/channex/outbox': { pending: 0, failed: 0, oldestPendingAt: null, ariStopped: false },
    '/channels/channex/mapping': [
      {
        localAccommodationTypeCode: 'DORM6',
        providerPropertyId: 'prop-1',
        providerRoomTypeId: 'rt-1',
      },
      {
        localAccommodationTypeCode: null,
        providerPropertyId: 'prop-1',
        providerRoomTypeId: 'rt-x',
      },
    ],
    '/availability': { byCategory: { DORM6: { available: 2 } } },
    ...over,
  };
  const get: ApiGet = async <T>(path: string) => {
    calls.push(path);
    const key =
      path.startsWith('/hotel/reservations') && path.includes('date=created')
        ? 'created'
        : path.startsWith('/hotel/reservations') && path.includes('source=OTA')
          ? 'ota'
          : path.startsWith('/hotel/reservations') && path.includes('q=')
            ? `q=${new URLSearchParams(path.split('?')[1]).get('q')}`
            : path.split('?')[0]!;
    return (routes[key] ?? null) as T | null;
  };
  return { get, calls };
}

const channex = (over: Partial<ChannexSource> = {}): ChannexSource => ({
  availability: async () => ({ 'rt-1': { [DATE]: 2, [plusDays(DATE, 1)]: 2 } }),
  bookings: async () => [
    {
      uniqueId: BDC,
      otaCode: '1556013801',
      otaName: 'Booking.com',
      status: 'new',
      arrival: DATE,
      departure: '2026-10-07',
    },
  ],
  ...over,
});

const TABLE = parseShiftTable(
  [
    'время\tсобытие\tбронь\tзаезд\tвыезд\tсумма\tспособ',
    `09:10\tновая бронь\t${A}\t06.10.2026\t08.10.2026\t\t`,
    `09:12\tоплата\t${A}\t\t\t12 000\tKaspi`,
    `09:20\tзаезд\t${A}\t\t\t\t`,
    '12:00\tзаезд\t1556013801\t\t\t\t',
  ].join('\n'),
  2026,
);
const params = {
  date: DATE,
  from: '00:00',
  to: '14:05',
  now: new Date('2026-10-06T09:05:00Z'),
  nights: 2,
  timeZone: 'Asia/Almaty',
};

describe('сбор данных сверки смены', () => {
  it('часы объекта: Алматы UTC+5', () => {
    expect(localStamp(new Date('2026-10-05T20:00:00Z'), 'Asia/Almaty')).toBe('2026-10-06 01:00');
    expect(localStamp(new Date('2026-10-06T09:05:00Z'), 'Asia/Almaty')).toBe('2026-10-06 14:05');
  });

  it('в ноль на согласованных данных: окно режется по часам объекта, чужие события выкинуты, номер канала найден', async () => {
    const api = fakeApi();
    const snap = await gatherShift(TABLE.rows, params, api.get, channex());
    expect(snap.at).toBe('2026-10-06 14:05');
    // reservation.update не событие смены; отмена 05.10 вне окна; CHUZHOI-1 это бронь другой организации (404)
    expect(snap.events.map((e) => [e.number, e.event, e.at])).toEqual([
      [A, 'checkIn', '2026-10-06 09:20'],
      [A, 'new', '2026-10-06 09:10'],
    ]);
    expect(snap.aliases.get('1556013801')).toBe(BDC);
    // оплата 23:50 позже окна 14:05 в сверку не идёт
    expect(snap.operations.map((o) => o.localAt)).toEqual(['2026-10-06 09:12', '2026-10-06 08:00']);
    expect(snap.cash).toEqual({
      localAt: '2026-10-06 13:00',
      expectedMinor: 5_000_000n,
      countedMinor: 5_000_000n,
    });
    expect('cells' in snap.nights && snap.nights.cells).toEqual([
      { category: 'DORM6', date: DATE, wetop: 2, channex: 2 },
      { category: 'DORM6', date: plusDays(DATE, 1), wetop: 2, channex: 2 },
    ]);
    expect('pairs' in snap.channex && snap.channex.pairs[0]!.wetop?.number).toBe(BDC);

    const result = checkShift({ table: TABLE, snapshot: snap, logText: '', now: params.now });
    expect(result.summary).toContain('ИТОГ: в ноль по всем трём спискам');
    expect(result.exitCode).toBe(0);
    expect(result.csv).toBe('');
    // только чтение и только известные адреса
    expect(
      api.calls.every((c) =>
        /^\/(audit|hotel\/reservations|reservations\/|finance\/|chessboard|channels\/channex\/|availability)/.test(
          c,
        ),
      ),
    ).toBe(true);
  });

  it('Channex недоступен: брони канала и остатки «не сверено», двойные продажи по шахматке всё равно сверены', async () => {
    const api = fakeApi({
      '/chessboard': {
        byCategory: { [DATE]: { DORM6: { units: 6, occupied: 6, blocked: 0 } } },
        unassigned: [
          {
            categoryCode: 'DORM6',
            arrivalDate: DATE,
            departureDate: '2026-10-07',
            status: 'CONFIRMED',
          },
        ],
      },
    });
    const snap = await gatherShift(TABLE.rows, params, api.get, {
      unavailable: 'нет CHANNEX_API_KEY в окружении API',
    });
    const result = checkShift({ table: TABLE, snapshot: snap, logText: '', now: params.now });
    expect(result.exitCode).toBe(1);
    expect(result.summary).toContain('Channex не сверен: нет CHANNEX_API_KEY в окружении API');
    expect(result.csv).toContain('двойная продажа');
    expect(api.calls.some((c) => c.startsWith('/availability'))).toBe(false);
  });

  it('Channex ответил ошибкой на брони: только этот список «не сверено», остатки сверены', async () => {
    const snap = await gatherShift(
      TABLE.rows,
      params,
      fakeApi().get,
      channex({
        bookings: async () => {
          throw new Error('Channex GET /bookings: HTTP 500');
        },
      }),
    );
    expect(snap.channex).toEqual({
      skipped: 'брони Channex не прочитаны: Channex GET /bookings: HTTP 500',
    });
    expect('cells' in snap.nights && snap.nights.cells).toHaveLength(2);
    expect(
      checkShift({ table: TABLE, snapshot: snap, logText: '', now: params.now }).exitCode,
    ).toBe(3);
  });

  it('журнал WETOP отдал предел строк, а начало окна в них не попало: события «не сверено»', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      at: new Date(Date.parse('2026-10-06T09:00:00Z') - i * 1000).toISOString(),
      entityType: 'Reservation',
      action: 'reservation.update',
      subject: A,
    }));
    const snap = await gatherShift(TABLE.rows, params, fakeApi({ '/audit': rows }).get, channex());
    expect(snap.eventsTruncated).toBe(true);
    const result = checkShift({ table: TABLE, snapshot: snap, logText: '', now: params.now });
    expect(result.summary).toContain('журнал WETOP отдал не всё окно');
  });
});
