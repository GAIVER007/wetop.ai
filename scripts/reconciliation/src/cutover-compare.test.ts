import { describe, expect, it } from 'vitest';
import {
  CHANNELS,
  channelByAlias,
  compareNumbers,
  isChannelName,
  nightsBetween,
  renderCutoverReport,
  selectExelyFuture,
  summarizeStays,
  type CutoverStay,
} from './cutover-compare';

const stay = (over: Partial<CutoverStay> = {}): CutoverStay => ({
  number: '20260901-0001-1',
  arrival: '2026-09-20',
  departure: '2026-09-22',
  category: 'exely-1',
  unit: '12',
  unitCovered: true,
  hasExternalId: false,
  hasPrepayment: false,
  priceMinor: 1_200_000n,
  dueMinor: 1_200_000n,
  ...over,
});

describe('compareNumbers', () => {
  it('keeps bookings born outside Exely (Channex/desk numbers) out of the comparison', () => {
    const r = compareNumbers(
      ['20260912-513903-1263463664', 'BDC-SHOW-22C80', '20260911-000001'],
      ['20260912-513903-1263463664'],
    );
    expect(r.bornOutsideExely).toEqual(['20260911-000001', 'BDC-SHOW-22C80']);
    expect(r.onlyPms).toEqual([]);
    expect(r.common).toEqual(['20260912-513903-1263463664']);
    expect(r.countMatches).toBe(true);
    expect(r.setsMatch).toBe(true);
  });

  it('reports a full match when PMS and Exely hold the same numbers', () => {
    const r = compareNumbers(['A', 'B', 'C'], ['C', 'B', 'A']);
    expect(r.common).toEqual(['A', 'B', 'C']);
    expect(r.onlyExely).toEqual([]);
    expect(r.onlyPms).toEqual([]);
    expect(r.countMatches).toBe(true);
    expect(r.setsMatch).toBe(true);
  });
  it('lists numbers present only in Exely', () => {
    const r = compareNumbers(['A', 'B'], ['A', 'B', 'X']);
    expect(r.onlyExely).toEqual(['X']);
    expect(r.onlyPms).toEqual([]);
    expect(r.countMatches).toBe(false);
    expect(r.setsMatch).toBe(false);
  });
  it('lists numbers present only in PMS', () => {
    const r = compareNumbers(['A', 'B', 'Y'], ['A', 'B']);
    expect(r.onlyPms).toEqual(['Y']);
    expect(r.onlyExely).toEqual([]);
    expect(r.countMatches).toBe(false);
  });
  it('same count but different composition is not a match', () => {
    const r = compareNumbers(['A', 'Y'], ['A', 'X']);
    expect(r.countMatches).toBe(true);
    expect(r.setsMatch).toBe(false);
    expect(r.onlyPms).toEqual(['Y']);
    expect(r.onlyExely).toEqual(['X']);
  });
  it('ignores duplicates within one side', () => {
    const r = compareNumbers(['A', 'A'], ['A']);
    expect(r.setsMatch).toBe(true);
    expect(r.countMatches).toBe(true);
  });
});

describe('channel aliases', () => {
  it('knows the six aliases with Exely and Channex names', () => {
    expect(CHANNELS.map((c) => c.alias)).toEqual([
      'booking',
      'trip',
      'expedia',
      'agoda',
      'hostelworld',
      'ostrovok',
    ]);
    expect(channelByAlias('trip')).toMatchObject({
      exelyName: 'Trip.com Group',
      channexOtaName: 'Ctrip',
      pullsHistory: true,
    });
    expect(channelByAlias('agoda')?.pullsHistory).toBe(false);
    expect(channelByAlias('unknown')).toBeUndefined();
  });
  it('matches channel names case-insensitively and trimmed, for Exely and Channex spellings', () => {
    const booking = channelByAlias('booking')!;
    expect(isChannelName('booking.com', booking)).toBe(true);
    expect(isChannelName('BOOKING.COM', booking)).toBe(true);
    expect(isChannelName('  Booking.com ', booking)).toBe(true);
    expect(isChannelName('Agoda', booking)).toBe(false);
    expect(isChannelName(null, booking)).toBe(false);
    const trip = channelByAlias('trip')!;
    expect(isChannelName('trip.com group', trip)).toBe(true);
    expect(isChannelName('CTRIP', trip)).toBe(true);
    const hw = channelByAlias('hostelworld')!;
    expect(isChannelName('hostelworld group', hw)).toBe(true);
    expect(isChannelName('Hostelworld', hw)).toBe(true);
  });
});

describe('selectExelyFuture', () => {
  const today = '2026-09-11';
  const records = [
    {
      confirmationNumber: 'N1',
      channel: 'BOOKING.COM',
      items: [
        {
          arrivalDate: '2026-09-10',
          departureDate: '2026-09-13',
          status: 'CHECKED_IN',
          priceMinor: 300n,
        },
      ],
    },
    {
      confirmationNumber: 'N2',
      channel: 'booking.com',
      items: [
        {
          arrivalDate: '2026-09-05',
          departureDate: '2026-09-11',
          status: 'CONFIRMED',
          priceMinor: 600n,
        },
      ],
    },
    {
      confirmationNumber: 'N3',
      channel: 'booking.com',
      items: [
        {
          arrivalDate: '2026-10-01',
          departureDate: '2026-10-03',
          status: 'CANCELLED',
          priceMinor: 200n,
        },
        {
          arrivalDate: '2026-10-01',
          departureDate: '2026-10-02',
          status: 'CONFIRMED',
          priceMinor: 100n,
        },
      ],
    },
    {
      confirmationNumber: 'N4',
      channel: 'Agoda',
      items: [
        {
          arrivalDate: '2026-10-01',
          departureDate: '2026-10-03',
          status: 'CONFIRMED',
          priceMinor: 200n,
        },
      ],
    },
    {
      confirmationNumber: 'N5',
      channel: null,
      items: [
        {
          arrivalDate: '2026-10-01',
          departureDate: '2026-10-03',
          status: 'CONFIRMED',
          priceMinor: 200n,
        },
      ],
    },
  ];
  it('keeps live future stays of the channel regardless of name case', () => {
    const r = selectExelyFuture(records, channelByAlias('booking')!, today);
    expect(r.numbers).toEqual(['N1', 'N3']);
    expect(r.stays).toBe(2);
    expect(r.nights).toBe(4);
    expect(r.amountMinor).toBe(400n);
  });
});

describe('summarizeStays', () => {
  it('counts reservations, stays, nights, money and the three flags', () => {
    const t = summarizeStays([
      stay(),
      stay({
        number: '20260901-0001-1',
        arrival: '2026-09-22',
        departure: '2026-09-23',
        unit: null,
        unitCovered: false,
      }),
      stay({
        number: 'BDC-1',
        hasExternalId: true,
        hasPrepayment: true,
        dueMinor: 0n,
        priceMinor: 550n,
      }),
    ]);
    expect(t.reservations).toBe(2);
    expect(t.stays).toBe(3);
    expect(t.nights).toBe(5);
    expect(t.amountMinor).toBe(2_400_550n);
    expect(t.withUnit).toBe(2);
    expect(t.withoutUnit).toBe(1);
    expect(t.withExternalId).toBe(1);
    expect(t.withoutExternalId).toBe(1);
    expect(t.withPrepayment).toBe(1);
    expect(t.withoutPrepayment).toBe(2);
  });
  it('a stay whose allocations do not cover every night counts as without unit', () => {
    const t = summarizeStays([stay({ unit: '12', unitCovered: false })]);
    expect(t.withUnit).toBe(0);
    expect(t.withoutUnit).toBe(1);
  });
});

describe('nightsBetween', () => {
  it('counts nights between two YYYY-MM-DD dates', () => {
    expect(nightsBetween('2026-09-11', '2026-09-12')).toBe(1);
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3);
  });
});

describe('renderCutoverReport', () => {
  it('renders header, totals, stays, differences and readiness with a verdict', () => {
    const stays = [stay(), stay({ number: 'B2', unit: null, unitCovered: false })];
    const md = renderCutoverReport({
      channel: channelByAlias('booking')!,
      today: '2026-09-11',
      takenAt: '2026-09-11 10:00 UTC',
      stays,
      exely: {
        numbers: ['20260901-0001-1', 'B2', 'X9'],
        stays: 3,
        nights: 5,
        amountMinor: 3_000_000n,
      },
      unparsedExely: [],
    });
    expect(md).toMatch(/^# Переезд канала: booking/);
    expect(md).toMatch(/Подтяжка старых броней Channex: да/);
    expect(md).toMatch(/\| Броней \| 2 \| 3 \| -1 \|/);
    expect(md).toMatch(
      /\| B2 \| 2026-09-20 \| 2026-09-22 \| exely-1 \| — \| нет \| нет \| 12 000 \|/,
    );
    expect(md).toMatch(/Только в Exely: \*\*1\*\*/);
    expect(md).toMatch(/- X9/);
    expect(md).toMatch(/число сходится: \*\*нет\*\*/);
    expect(md).toMatch(/все с ячейкой: \*\*нет\*\*/);
    expect(md).toMatch(/предоплата проставлена у 0 из 2/);
    expect(md).toMatch(/RESULT: FAIL/);
  });
  it('is OK when numbers match and every stay has a unit', () => {
    const md = renderCutoverReport({
      channel: channelByAlias('agoda')!,
      today: '2026-09-11',
      takenAt: '2026-09-11 10:00 UTC',
      stays: [stay({ hasPrepayment: true, dueMinor: 0n })],
      exely: { numbers: ['20260901-0001-1'], stays: 1, nights: 2, amountMinor: 1_200_000n },
      unparsedExely: [],
    });
    expect(md).toMatch(/Подтяжка старых броней Channex: нет/);
    expect(md).toMatch(/число сходится: \*\*да\*\*/);
    expect(md).toMatch(/все с ячейкой: \*\*да\*\*/);
    expect(md).toMatch(/предоплата проставлена у 1 из 1/);
    expect(md).toMatch(/RESULT: OK/);
  });
});
