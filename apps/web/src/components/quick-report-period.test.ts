import { describe, expect, it } from 'vitest';
import { MAX_PERIOD_DAYS, periodDays, periodRange, periodTitle } from './quick-report-period';

describe('периоды быстрого отчёта', () => {
  it('день, неделя с понедельника, месяц и прошлый месяц считаются от даты журнала', () => {
    expect(periodRange('day', '2026-10-21')).toEqual({ from: '2026-10-21', to: '2026-10-21' });
    expect(periodRange('week', '2026-10-21')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(periodRange('week', '2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(periodRange('month', '2026-10-21')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('prevMonth', '2026-10-21')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('prevMonth', '2026-01-05')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(periodRange('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('список дней включает обе границы и отклоняет неверный или слишком длинный период', () => {
    expect(periodDays('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(periodDays('2026-10-05', '2026-10-01')).toBeNull();
    expect(periodDays('2026-10-01', 'нет')).toBeNull();
    expect(periodDays('2026-01-01', '2026-12-31')).toBeNull();
    expect(periodDays('2026-01-01', '2026-03-03')).toHaveLength(MAX_PERIOD_DAYS);
  });

  it('заголовок: один день и период', () => {
    expect(periodTitle('2026-10-21', '2026-10-21')).toBe('Статистика за 21 окт. 2026');
    expect(periodTitle('2026-10-19', '2026-10-25')).toBe('Статистика за 19–25 окт. 2026');
    expect(periodTitle('2026-09-28', '2026-10-04')).toBe('Статистика за 28 сент. – 4 окт. 2026');
  });
});
