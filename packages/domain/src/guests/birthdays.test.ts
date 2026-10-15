import { describe, expect, it } from 'vitest';
import { upcomingBirthday } from './birthdays';

describe('ближайший день рождения в окне (образец Lite PMS, Q-249 T0)', () => {
  it('сегодня — дата сегодня и исполняется лет', () => {
    expect(upcomingBirthday('1990-10-03', '2026-10-03', 7)).toEqual({ date: '2026-10-03', age: 36 });
  });
  it('через три дня — внутри недели', () => {
    expect(upcomingBirthday('1990-10-06', '2026-10-03', 7)).toEqual({ date: '2026-10-06', age: 36 });
  });
  it('вне окна и уже прошедший в этом году — нет', () => {
    expect(upcomingBirthday('1990-10-10', '2026-10-03', 7)).toBeNull();
    expect(upcomingBirthday('1990-10-02', '2026-10-03', 7)).toBeNull();
  });
  it('окно через Новый год', () => {
    expect(upcomingBirthday('2000-01-02', '2026-12-30', 7)).toEqual({ date: '2027-01-02', age: 27 });
  });
  it('29 февраля в невисокосный год празднуется 28-го', () => {
    expect(upcomingBirthday('2000-02-29', '2027-02-28', 1)).toEqual({ date: '2027-02-28', age: 27 });
    expect(upcomingBirthday('2000-02-29', '2028-02-29', 1)).toEqual({ date: '2028-02-29', age: 28 });
  });
  it('пустая или кривая дата — нет', () => {
    expect(upcomingBirthday(null, '2026-10-03', 7)).toBeNull();
    expect(upcomingBirthday('abc', '2026-10-03', 7)).toBeNull();
  });
});
