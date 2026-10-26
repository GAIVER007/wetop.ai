import { describe, expect, it } from 'vitest';
import { analyticsMonth } from './month';

/**
 * Период «Аналитики» салона и ресторана только месяцем (владелец 26.10.2026: «по выбору даты оставь только
 * переключатель месяцев удобный»). Текущий месяц до сегодня, прошлые целиком; сравнение с тем же отрезком
 * прошлого месяца. Старые ссылки `?from=&to=` открывают месяц своей даты.
 */
describe('месяц аналитики', () => {
  const today = '2026-10-26';
  it('без параметра: текущий месяц с 1-го по сегодня, сравнение с 1–26 сентября', () => {
    expect(analyticsMonth({}, today)).toEqual({
      month: '2026-10',
      from: '2026-10-01',
      to: '2026-10-26',
      prev: { from: '2026-09-01', to: '2026-09-26' },
      next: null,
      previousMonth: '2026-09',
    });
  });
  it('прошлый месяц целиком; сравнение с месяцем раньше, длина по короткому месяцу', () => {
    expect(analyticsMonth({ month: '2026-03' }, today)).toMatchObject({
      from: '2026-03-01',
      to: '2026-03-31',
      prev: { from: '2026-02-01', to: '2026-02-28' },
      next: '2026-04',
    });
  });
  it('будущий или битый месяц: текущий', () => {
    expect(analyticsMonth({ month: '2027-01' }, today).month).toBe('2026-10');
    expect(analyticsMonth({ month: '2026-13' }, today).month).toBe('2026-10');
    expect(analyticsMonth({ month: 'x' }, today).month).toBe('2026-10');
  });
  it('старая ссылка с датами открывает месяц даты «с»', () => {
    expect(analyticsMonth({ from: '2026-09-05', to: '2026-09-05' }, today).month).toBe('2026-09');
  });
});
