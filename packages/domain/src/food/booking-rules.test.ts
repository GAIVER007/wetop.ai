import { describe, expect, it } from 'vitest';
import { bookingRuleViolation, DEFAULT_BOOKING_RULES, parseBookingRules, parseClosedDay } from './booking-rules';

describe('правила брони столов (§43)', () => {
  const at = (day: string, partySize = 2, rules = DEFAULT_BOOKING_RULES, closed = false) =>
    bookingRuleViolation({ day, today: '2026-10-13', partySize, rules, closed });

  it('по умолчанию ничего не меняется: ни горизонта, ни предела гостей', () => {
    expect(at('2028-01-01', 400)).toBeNull();
  });
  it('горизонт: не дальше N дней от сегодня в поясе филиала', () => {
    const rules = { ...DEFAULT_BOOKING_RULES, horizonDays: 30 };
    expect(at('2026-11-12', 2, rules)).toBeNull();
    expect(at('2026-11-13', 2, rules)).toBe('Бронь принимается не дальше чем на 30 дней вперёд');
  });
  it('гостей в одной брони не больше предела', () => {
    const rules = { ...DEFAULT_BOOKING_RULES, maxPartySize: 8 };
    expect(at('2026-10-14', 8, rules)).toBeNull();
    expect(at('2026-10-14', 9, rules)).toBe('В одной брони не больше 8 гостей');
    expect(at('2026-10-14', 2, { ...rules, maxPartySize: 1 })).toBe('В одной брони не больше 1 гостя');
    expect(at('2026-10-16', 2, { ...DEFAULT_BOOKING_RULES, horizonDays: 2 })).toBe(
      'Бронь принимается не дальше чем на 2 дня вперёд',
    );
    expect(at('2026-10-15', 2, { ...DEFAULT_BOOKING_RULES, horizonDays: 1 })).toBe(
      'Бронь принимается не дальше чем на 1 день вперёд',
    );
  });
  it('закрытый день', () => {
    expect(at('2026-10-14', 2, DEFAULT_BOOKING_RULES, true)).toBe('В этот день заведение не принимает брони');
  });
  it('разбор настроек и закрытого дня', () => {
    expect(parseBookingRules({ bufferMinutes: 15, horizonDays: null, maxPartySize: 12 })).toEqual({
      bufferMinutes: 15,
      horizonDays: null,
      maxPartySize: 12,
    });
    for (const bad of [
      { bufferMinutes: 241, horizonDays: null, maxPartySize: null },
      { bufferMinutes: -1, horizonDays: null, maxPartySize: null },
      { bufferMinutes: 0, horizonDays: 0, maxPartySize: null },
      { bufferMinutes: 0, horizonDays: 731, maxPartySize: null },
      { bufferMinutes: 0, horizonDays: null, maxPartySize: 501 },
      { bufferMinutes: 0, horizonDays: null, maxPartySize: null, extra: 1 },
    ])
      expect(() => parseBookingRules(bad)).toThrow();
    expect(parseClosedDay({ day: '2026-12-31', reason: '  Новый год ' })).toEqual({ day: '2026-12-31', reason: 'Новый год' });
    expect(parseClosedDay({ day: '2026-12-31', reason: '' })).toEqual({ day: '2026-12-31', reason: null });
    expect(() => parseClosedDay({ day: '2026-02-30' })).toThrow();
  });
});
