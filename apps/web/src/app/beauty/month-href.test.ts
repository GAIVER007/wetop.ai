import { describe, expect, it } from 'vitest';
import { monthHref } from './month-href';

describe('«Этот месяц» журнала салона открывает список записей месяца', () => {
  it('с первого по последний день месяца, включая февраль високосного года', () => {
    expect(monthHref('2026-10-25')).toBe('/appointments?from=2026-10-01&to=2026-10-31');
    expect(monthHref('2028-02-10')).toBe('/appointments?from=2028-02-01&to=2028-02-29');
    expect(monthHref('2026-11-30')).toBe('/appointments?from=2026-11-01&to=2026-11-30');
  });
});
