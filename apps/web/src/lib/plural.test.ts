import { describe, expect, it } from 'vitest';
import { nightsBetween, pluralRu } from './plural';

describe('pluralRu', () => {
  it('1, 2–4, 5–20, 21, 111 — три формы', () => {
    const f: [string, string, string] = ['бронирование', 'бронирования', 'бронирований'];
    expect(pluralRu(1, f)).toBe('1 бронирование');
    expect(pluralRu(3, f)).toBe('3 бронирования');
    expect(pluralRu(5, f)).toBe('5 бронирований');
    expect(pluralRu(11, f)).toBe('11 бронирований');
    expect(pluralRu(21, f)).toBe('21 бронирование');
    expect(pluralRu(111, f)).toBe('111 бронирований');
    expect(pluralRu(121, f)).toBe('121 бронирование');
    expect(pluralRu(2, ['ночь', 'ночи', 'ночей'], false)).toBe('ночи');
  });
});

describe('nightsBetween', () => {
  it('считает ночи по датам проживания, мусор и обратный порядок дают 0', () => {
    expect(nightsBetween('2026-09-15', '2026-09-17')).toBe(2);
    expect(nightsBetween('2026-09-15', '2026-09-16')).toBe(1);
    expect(nightsBetween('2026-09-15', '2026-09-15')).toBe(0);
    expect(nightsBetween('2026-09-17', '2026-09-15')).toBe(0);
    expect(nightsBetween('bad', '2026-09-15')).toBe(0);
  });
});
