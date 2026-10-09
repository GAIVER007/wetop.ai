import { describe, expect, it } from 'vitest';
import { groupDaily } from './granularity';
import type { DashboardDailyPoint } from './metrics';

const day = (
  date: string,
  occupied: number,
  free: number,
  blocked: number,
  arrivals: number,
  rev: string,
): DashboardDailyPoint => ({
  date,
  occupied,
  free,
  blocked,
  percent: 0,
  arrivals,
  departures: 0,
  revenueMinor: rev,
});

describe('разбивка дней по неделям и месяцам (RPT2.2c-2)', () => {
  const week = [
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
  ].map((d) => day(d, 3, 6, 1, 2, '100000'));

  it('по дням ничего не меняется, проценты считаются из доступных ночей', () => {
    const g = groupDaily(week, 'day');
    expect(g).toHaveLength(7);
    expect(g[0]).toMatchObject({
      from: '2026-10-05',
      to: '2026-10-05',
      percent: 33.3,
      partial: false,
    });
  });

  it('неделя ISO идёт с понедельника, суммы целиком, процент от суммы ночей, а не среднее процентов', () => {
    const g = groupDaily(week, 'week');
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({
      from: '2026-10-05',
      to: '2026-10-11',
      occupied: 21,
      free: 42,
      blocked: 7,
      percent: 33.3,
      arrivals: 14,
      revenueMinor: '700000',
      partial: false,
    });
  });

  it('крайние неполные недели и месяцы помечаются, границы месяца не сливаются', () => {
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((d) =>
      day(d, 1, 1, 0, 1, '50'),
    );
    const m = groupDaily(days, 'month');
    expect(m.map((b) => [b.from, b.to, b.partial])).toEqual([
      ['2026-09-29', '2026-09-30', true],
      ['2026-10-01', '2026-10-02', true],
    ]);
    const w = groupDaily(days, 'week');
    // 29.09 вторник, 05.10 следующий понедельник: одна неделя 29.09-02.10, она неполная
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ from: '2026-09-29', to: '2026-10-02', partial: true });
  });

  it('полный месяц не помечается неполным, сумма корзин равна сумме дней', () => {
    const oct = Array.from({ length: 31 }, (_, i) =>
      day(`2026-10-${String(i + 1).padStart(2, '0')}`, 2, 8, 0, 1, '12345'),
    );
    const m = groupDaily(oct, 'month');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ partial: false, revenueMinor: String(12345 * 31), occupied: 62 });
    const total = groupDaily(oct, 'week').reduce((n, b) => n + BigInt(b.revenueMinor), 0n);
    expect(total).toBe(12345n * 31n);
  });

  it('пустые дни и ноль ночей не дают деления на ноль', () => {
    expect(groupDaily([], 'week')).toEqual([]);
    expect(groupDaily([day('2026-10-05', 0, 0, 0, 0, '0')], 'day')[0]?.percent).toBe(0);
  });
});
