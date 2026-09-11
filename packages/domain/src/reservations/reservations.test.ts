import { describe, expect, it } from 'vitest';
import {
  ReservationRuleError,
  RestrictionViolationError,
  assertCanAssign,
  assertRestrictionsAllow,
  assertCanCheckIn,
  assertCanCheckOut,
  assertCanNoShow,
  assertCanCancel,
  assertCanChangeDates,
  assertCanExtend,
  confirmationNumber,
  deriveReservationStatus,
  priceStay,
  type StayRestriction,
} from './reservations';

describe('priceStay', () => {
  const rates = [
    { date: '2026-09-15', occupancy: 1, priceMinor: 1_100_000n },
    { date: '2026-09-16', occupancy: 1, priceMinor: 1_100_000n },
    { date: '2026-09-16', occupancy: 2, priceMinor: 1_500_000n },
    { date: '2026-09-17', occupancy: 1, priceMinor: 1_200_000n },
  ];
  it('sums one DailyRate per night for the requested occupancy, departure night excluded', () => {
    const p = priceStay({
      arrivalDate: '2026-09-15',
      departureDate: '2026-09-18',
      occupancy: 1,
      rates,
    });
    expect(p.nights.map((n) => [n.date, n.priceMinor])).toEqual([
      ['2026-09-15', 1_100_000n],
      ['2026-09-16', 1_100_000n],
      ['2026-09-17', 1_200_000n],
    ]);
    expect(p.totalMinor).toBe(3_400_000n);
  });
  it('fails naming the first night without a price — no guessing', () => {
    expect(() =>
      priceStay({ arrivalDate: '2026-09-15', departureDate: '2026-09-18', occupancy: 2, rates }),
    ).toThrow(/2026-09-15.*occupancy 2/);
  });
  it('rejects a stay without nights', () => {
    expect(() =>
      priceStay({ arrivalDate: '2026-09-15', departureDate: '2026-09-15', occupancy: 1, rates }),
    ).toThrow(/хотя бы одну ночь/);
  });
});

describe('deriveReservationStatus', () => {
  it('all cancelled → CANCELLED; otherwise CHECKED_IN > CONFIRMED > TENTATIVE > CHECKED_OUT > NO_SHOW', () => {
    expect(deriveReservationStatus(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
    expect(deriveReservationStatus(['CANCELLED', 'CONFIRMED'])).toBe('CONFIRMED');
    expect(deriveReservationStatus(['CHECKED_OUT', 'CHECKED_IN'])).toBe('CHECKED_IN');
    expect(deriveReservationStatus(['TENTATIVE', 'CONFIRMED'])).toBe('CONFIRMED');
    expect(deriveReservationStatus(['NO_SHOW', 'CHECKED_OUT'])).toBe('CHECKED_OUT');
    expect(deriveReservationStatus(['NO_SHOW'])).toBe('NO_SHOW');
    expect(() => deriveReservationStatus([])).toThrow(/без проживаний/);
  });
});

describe('status guards', () => {
  it('cancel and date change only for TENTATIVE / CONFIRMED', () => {
    expect(() => assertCanCancel('CONFIRMED')).not.toThrow();
    expect(() => assertCanCancel('TENTATIVE')).not.toThrow();
    expect(() => assertCanCancel('CHECKED_IN')).toThrow(/заселён/);
    expect(() => assertCanCancel('CANCELLED')).toThrow(/уже отменен/);
    expect(() => assertCanChangeDates('CHECKED_OUT')).toThrow(/CHECKED_OUT/);
  });
  it('assign (переселение) is allowed while the guest is expected or in house', () => {
    expect(() => assertCanAssign('CHECKED_IN')).not.toThrow();
    expect(() => assertCanAssign('CONFIRMED')).not.toThrow();
    expect(() => assertCanAssign('CANCELLED')).toThrow(/CANCELLED/);
  });
});

describe('confirmationNumber', () => {
  it('is YYYYMMDD-XXXXXX built from the Almaty date and a 6-char suffix', () => {
    const n = confirmationNumber(new Date('2026-09-09T20:30:00Z'), () => 0.123456);
    expect(n).toMatch(/^20260910-[A-Z0-9]{6}$/); // 20:30 UTC = 01:30 следующего дня в Алматы (UTC+5)
    expect(confirmationNumber(new Date('2026-09-09T20:30:00Z'))).not.toBe(
      confirmationNumber(new Date('2026-09-09T20:30:00Z')),
    );
  });
});

describe('check-in / check-out / no-show guards', () => {
  it('check-in needs an expected guest AND an assigned unit', () => {
    expect(() => assertCanCheckIn('CONFIRMED', true)).not.toThrow();
    expect(() => assertCanCheckIn('CONFIRMED', false)).toThrow(/назначьте ячейку/);
    expect(() => assertCanCheckIn('CHECKED_IN', true)).toThrow(/уже заселён/);
    expect(() => assertCanCheckIn('CANCELLED', true)).toThrow(/CANCELLED/);
  });
  it('check-out only from CHECKED_IN; no-show only for expected guests', () => {
    expect(() => assertCanCheckOut('CHECKED_IN')).not.toThrow();
    expect(() => assertCanCheckOut('CONFIRMED')).toThrow(/не заселён/);
    expect(() => assertCanNoShow('CONFIRMED')).not.toThrow();
    expect(() => assertCanNoShow('CHECKED_IN')).toThrow(/CHECKED_IN/);
  });
});

describe('assertCanExtend (T2: продление на ночь)', () => {
  it('продлить можно подтверждённое и заселённого гостя, но не выселенного, отменённого и незаезд', () => {
    expect(() => assertCanExtend('CONFIRMED')).not.toThrow();
    expect(() => assertCanExtend('TENTATIVE')).not.toThrow();
    expect(() => assertCanExtend('CHECKED_IN')).not.toThrow(); // гость у стойки просит ещё ночь
    expect(() => assertCanExtend('CHECKED_OUT')).toThrow(/CHECKED_OUT/);
    expect(() => assertCanExtend('CANCELLED')).toThrow(/CANCELLED/);
    expect(() => assertCanExtend('NO_SHOW')).toThrow(/NO_SHOW/);
  });
});

describe('assertRestrictionsAllow (ADR-020: ограничения продаж действуют и на стойке)', () => {
  const base = {
    arrivalDate: '2026-11-14',
    departureDate: '2026-11-16',
    categoryName: 'Общая мужская комната',
  };
  const r = (date: string, over: Partial<StayRestriction> = {}): StayRestriction => ({
    date,
    minStay: null,
    maxStay: null,
    stopSell: false,
    closedToArrival: false,
    closedToDeparture: false,
    ...over,
  });
  it('без ограничений и с пустыми строками — проходит', () => {
    expect(() => assertRestrictionsAllow({ ...base, restrictions: [] })).not.toThrow();
    expect(() =>
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-14'), r('2026-11-15')] }),
    ).not.toThrow();
  });
  it('стоп-продажа на любую ночь проживания — отказ с датой и категорией; ночь выезда не продаётся и не мешает', () => {
    expect(() =>
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-15', { stopSell: true })] }),
    ).toThrow('Стоп-продажа на 2026-11-15, Общая мужская комната');
    expect(() =>
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-16', { stopSell: true })] }),
    ).not.toThrow();
  });
  it('закрыт заезд — только на дату заезда; закрыт выезд — только на дату выезда', () => {
    expect(() =>
      assertRestrictionsAllow({
        ...base,
        restrictions: [r('2026-11-14', { closedToArrival: true })],
      }),
    ).toThrow('Закрыт заезд на 2026-11-14, Общая мужская комната');
    expect(() =>
      assertRestrictionsAllow({
        ...base,
        restrictions: [r('2026-11-15', { closedToArrival: true })],
      }),
    ).not.toThrow();
    expect(() =>
      assertRestrictionsAllow({
        ...base,
        restrictions: [r('2026-11-16', { closedToDeparture: true })],
      }),
    ).toThrow('Закрыт выезд на 2026-11-16, Общая мужская комната');
    expect(() =>
      assertRestrictionsAllow({
        ...base,
        restrictions: [r('2026-11-15', { closedToDeparture: true })],
      }),
    ).not.toThrow();
  });
  it('минимальный и максимальный срок смотрят на дату заезда и длину проживания', () => {
    expect(() =>
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-14', { minStay: 3 })] }),
    ).toThrow('Минимальный срок 3 ноч. на 2026-11-14, Общая мужская комната: запрошено 2 ноч.');
    expect(() =>
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-14', { minStay: 2 })] }),
    ).not.toThrow();
    expect(() =>
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-14', { maxStay: 1 })] }),
    ).toThrow('Максимальный срок 1 ноч. на 2026-11-14, Общая мужская комната: запрошено 2 ноч.');
    // ограничение на другую ночь на срок не влияет
    expect(() =>
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-15', { minStay: 5 })] }),
    ).not.toThrow();
  });
  it('продление: уже проданные ночи не перепроверяются, добавленные — да; закрытый выезд и максимум срока — тоже', () => {
    const ext = { ...base, departureDate: '2026-11-18', soldUntil: '2026-11-16' };
    // стоп-продажа и закрытый заезд на уже проданные ночи — не повод отказать в продлении
    expect(() =>
      assertRestrictionsAllow({
        ...ext,
        restrictions: [r('2026-11-14', { stopSell: true, closedToArrival: true, minStay: 9 })],
      }),
    ).not.toThrow();
    expect(() =>
      assertRestrictionsAllow({ ...ext, restrictions: [r('2026-11-17', { stopSell: true })] }),
    ).toThrow('Стоп-продажа на 2026-11-17, Общая мужская комната');
    expect(() =>
      assertRestrictionsAllow({
        ...ext,
        restrictions: [r('2026-11-18', { closedToDeparture: true })],
      }),
    ).toThrow('Закрыт выезд на 2026-11-18');
    expect(() =>
      assertRestrictionsAllow({ ...ext, restrictions: [r('2026-11-14', { maxStay: 3 })] }),
    ).toThrow('Максимальный срок 3 ноч. на 2026-11-14, Общая мужская комната: запрошено 4 ноч.');
  });
  it('нарушение — RestrictionViolationError, подкласс ReservationRuleError (в API — 409)', () => {
    let caught: unknown;
    try {
      assertRestrictionsAllow({ ...base, restrictions: [r('2026-11-14', { stopSell: true })] });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RestrictionViolationError);
    expect(caught).toBeInstanceOf(ReservationRuleError);
  });
});
