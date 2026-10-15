import { describe, expect, it } from 'vitest';
import { birthdayOn } from './guest-marks';

describe('день рождения в день брони (§36)', () => {
  it('совпадает месяц и число, год неважен', () => {
    expect(birthdayOn('1990-10-12', '2026-10-12')).toBe(true);
    expect(birthdayOn('1990-10-13', '2026-10-12')).toBe(false);
    expect(birthdayOn(null, '2026-10-12')).toBe(false);
  });
  it('29 февраля: в невисокосный год 28-го, в високосный 29-го', () => {
    expect(birthdayOn('2000-02-29', '2026-02-28')).toBe(true);
    expect(birthdayOn('2000-02-29', '2028-02-28')).toBe(false);
    expect(birthdayOn('2000-02-29', '2028-02-29')).toBe(true);
  });
});
