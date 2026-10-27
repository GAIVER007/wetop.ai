import { describe, expect, it } from 'vitest';
import { MONTH_MAX_SHOWN, MONTH_MIN_SHOWN, monthFit } from './month-fit';

/** Месяц журнала в один экран (владелец 27.10.2026): записей в клетке столько, сколько влезает по высоте строки */
describe('monthFit', () => {
  it('высокая строка: больше записей, но не больше потолка', () => {
    // 140 px строка, шапка 28, запись 22, промежуток 4: (140-28-4-26+4)/26 = 3
    expect(monthFit(140, 28, 22, 4)).toBe(3);
    expect(monthFit(200, 28, 22, 4)).toBe(5);
    expect(monthFit(1000, 28, 22, 4)).toBe(MONTH_MAX_SHOWN);
  });
  it('низкая строка: хотя бы одна запись и «ещё N»', () => {
    expect(monthFit(60, 28, 22, 4)).toBe(MONTH_MIN_SHOWN);
    expect(monthFit(0, 28, 22, 4)).toBe(MONTH_MIN_SHOWN);
  });
  it('шапка, записи и «ещё N» всегда помещаются в строку', () => {
    for (const row of [90, 110, 130, 150, 170]) {
      const n = monthFit(row, 28, 22, 4);
      expect(28 + n * 26 + 26).toBeLessThanOrEqual(row);
    }
  });
});
