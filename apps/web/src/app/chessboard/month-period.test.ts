import { describe, expect, it } from 'vitest';
import { monthPeriod } from './month-period';

describe('calendar month boundaries', () => {
  it.each([
    ['2026-09-14', 0, '2026-09-01', '2026-09-30'],
    ['2026-10-31', -1, '2026-09-01', '2026-09-30'],
    ['2027-03-31', -1, '2027-02-01', '2027-02-28'],
    ['2028-03-31', -1, '2028-02-01', '2028-02-29'],
    ['2026-12-31', 1, '2027-01-01', '2027-01-31'],
    ['2027-01-01', -1, '2026-12-01', '2026-12-31'],
    ['2100-02-10', 0, '2100-02-01', '2100-02-28'],
  ])('%s, shift %i', (date, offset, from, to) => {
    expect(monthPeriod(date, offset)).toEqual({ from, to });
  });
});
