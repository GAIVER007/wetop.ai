import { describe, expect, it } from 'vitest';
import { directSaving, parseWhole } from '../../apps/site/src/lib/calculator';

/**
 * Калькулятор «прямая бронь против OTA» на wetop.ai (план `plans/direct-sales-pack-2026-09-29.md`, срез D3, Q-225).
 * Деньги — целые тенге, дробей и float нет (ADR-008): проценты целые, деление с округлением до целого.
 */
describe('directSaving', () => {
  it('считает комиссию OTA и то, что остаётся при переносе части броней на прямые', () => {
    expect(directSaving({ nights: 100, adr: 20_000, commissionPct: 18, shiftPct: 25 })).toEqual({
      commissionMonth: 360_000,
      savedMonth: 90_000,
      savedYear: 1_080_000,
    });
  });

  it('округляет до целого тенге, а год считает от округлённого месяца', () => {
    // 3 · 10 001 · 15 · 33 / 10 000 = 1 485,1485
    expect(directSaving({ nights: 3, adr: 10_001, commissionPct: 15, shiftPct: 33 })).toEqual({
      commissionMonth: 4_500,
      savedMonth: 1_485,
      savedYear: 17_820,
    });
  });

  it('нулевой перенос — экономии нет, комиссия показывается', () => {
    expect(directSaving({ nights: 100, adr: 20_000, commissionPct: 18, shiftPct: 0 })).toEqual({
      commissionMonth: 360_000,
      savedMonth: 0,
      savedYear: 0,
    });
  });

  it('не считает по нецелым, отрицательным и слишком большим значениям', () => {
    const ok = { nights: 100, adr: 20_000, commissionPct: 18, shiftPct: 25 };
    expect(directSaving({ ...ok, nights: -1 })).toBeNull();
    expect(directSaving({ ...ok, adr: 1.5 })).toBeNull();
    expect(directSaving({ ...ok, commissionPct: 101 })).toBeNull();
    expect(directSaving({ ...ok, shiftPct: 101 })).toBeNull();
    expect(directSaving({ ...ok, nights: 100_001 })).toBeNull();
    expect(directSaving({ ...ok, adr: 1_000_001 })).toBeNull();
    expect(directSaving({ ...ok, nights: Number.NaN })).toBeNull();
  });
});

describe('parseWhole', () => {
  it('принимает целое число, пробелы между разрядами убирает', () => {
    expect(parseWhole('12 500')).toBe(12_500);
    expect(parseWhole(' 7 ')).toBe(7);
    expect(parseWhole('0')).toBe(0);
  });

  it('пустое, дробное и записанное буквами не принимает', () => {
    expect(parseWhole('')).toBeNull();
    expect(parseWhole('12,5')).toBeNull();
    expect(parseWhole('1e3')).toBeNull();
    expect(parseWhole('-3')).toBeNull();
    expect(parseWhole('abc')).toBeNull();
  });
});
