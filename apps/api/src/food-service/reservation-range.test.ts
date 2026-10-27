import { describe, expect, it } from 'vitest';
import { reservationRange } from './reservation-range';

describe('диапазон броней ресторана (вид «Месяц» расписания)', () => {
  it('без dateTo это один день, как раньше', () => {
    expect(reservationRange('2026-10-12')).toEqual({ dateFrom: '2026-10-12', dateTo: '2026-10-12' });
  });
  it('сетка месяца: с понедельника по воскресенье, до 42 дней', () => {
    expect(reservationRange('2026-09-28', '2026-11-01')).toEqual({ dateFrom: '2026-09-28', dateTo: '2026-11-01' });
    expect(reservationRange('2026-02-23', '2026-04-05')).toEqual({ dateFrom: '2026-02-23', dateTo: '2026-04-05' });
  });
  it('конец раньше начала, больше 42 дней или не дата: отказ', () => {
    expect(() => reservationRange('2026-10-12', '2026-10-11')).toThrow('Нужна календарная дата');
    expect(() => reservationRange('2026-09-01', '2026-10-13')).toThrow('Нужна календарная дата');
    expect(() => reservationRange('2026-02-30')).toThrow('Нужна календарная дата');
    expect(() => reservationRange('2026-10-12', 'завтра')).toThrow('Нужна календарная дата');
    expect(() => reservationRange(42 as unknown as string)).toThrow('Нужна календарная дата');
  });
});
