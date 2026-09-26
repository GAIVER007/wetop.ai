import { describe, expect, it } from 'vitest';
import { PLATFORM_TIMEZONE } from '@pms/domain';
import { FALLBACK_TIMEZONE, propertyClock } from './property-time';

/**
 * Часы объекта на стойке (С-13, ТЗ аудита 25.09.2026). Даты событий хранятся в UTC, а день и время для
 * стойки — по часам объекта (AGENTS.md §13, DESIGN.md §14). Раньше пояс был зашит: сдвиг на пять часов
 * руками или `Intl` с 'Asia/Almaty'; объект в другом поясе получил бы чужое «сегодня» и чужие даты.
 * Строки форматов ниже — те же, что выдавали прежние `lib/almaty.ts` и `channels/format.ts`.
 */
const almaty = propertyClock('Asia/Almaty');
const tokyo = propertyClock('Asia/Tokyo'); // UTC+9
const newYork = propertyClock('America/New_York'); // с летним временем

describe('часы объекта: даты стойки — по поясу объекта, а не по UTC+5', () => {
  it('день события — по часам объекта, а не срезом UTC-строки (прежние проверки almatyDate)', () => {
    expect(almaty.date('2026-09-13T20:30:00.000Z')).toBe('2026-09-14');
    expect(almaty.date('2026-09-14T18:59:59.000Z')).toBe('2026-09-14');
    expect(almaty.date('2026-09-14T19:00:00.000Z')).toBe('2026-09-15');
  });

  it('тот же момент в другом поясе — другой день: пояс не зашит', () => {
    // 16:30 UTC: в Алматы 21:30 14-го, в Токио 01:30 уже 15-го
    expect(almaty.date('2026-09-14T16:30:00Z')).toBe('2026-09-14');
    expect(tokyo.date('2026-09-14T16:30:00Z')).toBe('2026-09-15');
    expect(tokyo.clock('2026-09-14T16:30:00Z')).toBe('01:30');
  });

  it('«сегодня», месяц и штамп печати — по часам объекта', () => {
    const now = new Date('2026-09-30T19:30:00Z'); // Алматы: 1 октября 00:30; Нью-Йорк: 30 сентября 15:30
    expect(almaty.today(now)).toBe('2026-10-01');
    expect(almaty.month(now)).toBe('2026-10');
    expect(almaty.printed(now)).toEqual({ date: '2026-10-01', stamp: '2026-10-01 00:30' });
    expect(newYork.today(now)).toBe('2026-09-30');
    expect(newYork.month(now)).toBe('2026-09');
    expect(newYork.printed(now)).toEqual({ date: '2026-09-30', stamp: '2026-09-30 15:30' });
  });

  it('форматы стойки прежние (DESIGN.md §14): сдвинулся только источник пояса', () => {
    const iso = '2026-09-17T04:05:09Z'; // Алматы 09:05:09
    expect(almaty.moment(iso)).toBe('17.09 09:05');
    expect(almaty.when(iso)).toBe('17.09 в 09:05');
    expect(almaty.clock(iso)).toBe('09:05');
    expect(almaty.stamp(iso)).toBe('2026-09-17 09:05');
    expect(almaty.full(iso)).toBe('17.09.2026 09:05');
    expect(almaty.local(iso)).toBe('17.09.2026, 09:05:09');
  });

  it('пусто и мусор — прочерк или пустая строка, а не «Invalid Date» и не падение', () => {
    expect(almaty.date('not-a-date')).toBe('');
    expect(almaty.moment('not-a-date')).toBe('—');
    expect(almaty.moment(null)).toBe('—');
    expect(almaty.when(undefined)).toBe('—');
    expect(almaty.stamp('not-a-date')).toBe('—');
    expect(almaty.clock('not-a-date')).toBe('—');
    expect(almaty.full(null)).toBe('—');
    expect(almaty.local(null)).toBe('—');
  });

  it('одни и те же часы на пояс: форматтеры не пересобираются на каждый вызов', () => {
    expect(propertyClock('Asia/Tokyo')).toBe(tokyo);
    expect(tokyo.timezone).toBe('Asia/Tokyo');
  });

  it('запасной пояс стойки — пояс платформы из домена, а не своя копия строки', () => {
    expect(FALLBACK_TIMEZONE).toBe(PLATFORM_TIMEZONE);
  });
});
