import { describe, expect, it } from 'vitest';
import { countryOf, currencyOptions, timezoneOptions } from './regions';

describe('regions', () => {
  it('offers only partner countries', () => {
    expect(currencyOptions().map((o) => o.value)).toEqual(['KZT', 'USD', 'AED', 'QAR']);
    expect(timezoneOptions().map((o) => o.value)).toEqual([
      'Asia/Almaty',
      'Asia/Dubai',
      'Asia/Qatar',
    ]);
  });
  it('keeps a saved value outside the list', () => {
    expect(currencyOptions('RUB')[0]).toEqual({ value: 'RUB', label: 'RUB' });
    expect(currencyOptions('KZT')).toHaveLength(4);
    expect(timezoneOptions('Europe/Moscow')[0]?.value).toBe('Europe/Moscow');
  });
  it('every zone is a real IANA zone', () => {
    for (const o of timezoneOptions())
      expect(() => new Intl.DateTimeFormat('ru', { timeZone: o.value })).not.toThrow();
  });
  it('country gives the zone and default currency', () => {
    expect(countryOf({ code: 'ae' })).toMatchObject({ zone: 'Asia/Dubai', currency: 'AED' });
    expect(countryOf({ zone: 'Asia/Qatar' })?.code).toBe('QA');
    expect(countryOf({ code: 'RU' })).toBeNull();
    expect(countryOf({ zone: 'Europe/Moscow' })).toBeNull();
  });
});
