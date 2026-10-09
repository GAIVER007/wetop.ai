import { describe, expect, it } from 'vitest';
import { analyticsHref, dayPeriod, parseAnalyticsQuery } from './params';

/** Адрес «Обзора» (ADR-114): по умолчанию этот месяц, весь фонд, сравнение включено — в адрес не пишутся */
describe('адрес «Аналитики → Обзор»', () => {
  const today = '2026-09-27';

  it('по умолчанию — этот месяц целиком, весь фонд, со сравнением', () => {
    const q = parseAnalyticsQuery({}, today);
    expect(q.period).toMatchObject({ preset: 'month', from: '2026-09-01', to: '2026-09-30' });
    expect(q.fund).toBe('all');
    expect(q.compare).toBe(true);
    expect(analyticsHref(q)).toBe('/management/analytics');
  });

  it('тип фонда и сравнение переживают смену периода; неизвестный тип — весь фонд', () => {
    const q = parseAnalyticsQuery({ period: 'week', fund: 'beds', compare: '0' }, today);
    expect(q.period).toMatchObject({ from: '2026-09-21', to: '2026-09-27' });
    expect(
      analyticsHref(q, { period: { preset: 'last-month', from: q.period.from, to: q.period.to } }),
    ).toBe('/management/analytics?period=last-month&fund=beds&compare=0');
    expect(parseAnalyticsQuery({ fund: 'apartments' }, today).fund).toBe('all');
  });

  it('свой период — с датами в адресе; даты без пресета читаются как свой период', () => {
    const q = parseAnalyticsQuery({ from: '2026-07-01', to: '2026-07-31' }, today);
    expect(q.period).toMatchObject({ preset: 'custom', from: '2026-07-01', to: '2026-07-31' });
    expect(analyticsHref(q, { fund: 'rooms' })).toBe(
      '/management/analytics?period=custom&from=2026-07-01&to=2026-07-31&fund=rooms',
    );
  });
});

/** Вкладка «Загрузка» (срез AN2): по умолчанию сегодня; старый адрес «Статистики» `?date=` читается */
describe('адрес «Аналитики → Загрузка»', () => {
  const today = '2026-09-28';

  it('по умолчанию — сегодняшний день, весь фонд, со сравнением', () => {
    const q = parseAnalyticsQuery({}, today, 'occupancy');
    expect(q.period).toMatchObject({ preset: 'today', from: today, to: today });
    expect(q.tab).toBe('occupancy');
    expect(analyticsHref(q)).toBe('/management/analytics/occupancy');
    // готовый отрезок по умолчанию у вкладок свой: месяц «Загрузки» пишется в адрес, у «Обзора» — нет
    expect(analyticsHref(q, { period: { preset: 'month', from: '', to: '' } })).toBe(
      '/management/analytics/occupancy?period=month',
    );
    expect(
      analyticsHref(q, { tab: 'overview', period: { preset: 'month', from: '', to: '' } }),
    ).toBe('/management/analytics');
  });

  it('одна дата — `?date=`: так ссылаются Главная, обход стойки и старый адрес «Статистики»', () => {
    const q = parseAnalyticsQuery({ date: '2026-09-25' }, today, 'occupancy');
    expect(q.period).toMatchObject({ preset: 'custom', from: '2026-09-25', to: '2026-09-25' });
    expect(analyticsHref(q, { fund: 'beds' })).toBe(
      '/management/analytics/occupancy?date=2026-09-25&fund=beds',
    );
    // сегодняшняя дата — это «Сегодня», а не свой период
    expect(parseAnalyticsQuery({ date: today }, today, 'occupancy').period.preset).toBe('today');
    // свой период из одного дня тоже пишется одной датой
    const one = parseAnalyticsQuery(
      { period: 'custom', from: '2026-09-20', to: '2026-09-20' },
      today,
      'occupancy',
    );
    expect(analyticsHref(one)).toBe('/management/analytics/occupancy?date=2026-09-20');
  });

  it('некорректная дата — сегодняшний день и слова об ошибке', () => {
    const q = parseAnalyticsQuery({ date: '2026-13-45' }, today, 'occupancy');
    expect(q.period).toMatchObject({ preset: 'today', from: today, to: today });
    expect(q.period.error).toBe('Некорректная дата');
  });

  it('соседний день — для стрелок «‹ ›» у одного дня', () => {
    const q = parseAnalyticsQuery({ date: '2026-09-01' }, today, 'occupancy');
    expect(analyticsHref(q, { period: dayPeriod('2026-09-01', -1, today) })).toBe(
      '/management/analytics/occupancy?date=2026-08-31',
    );
    expect(analyticsHref(q, { period: dayPeriod('2026-09-27', 1, today) })).toBe(
      '/management/analytics/occupancy',
    );
  });
});

describe('те же вкладки под оболочкой «Отчёты» (RPT2.2c-1)', () => {
  const today = '2026-09-20';
  it('адреса вкладок строятся от /reports, умолчания в адрес не пишутся', () => {
    const o = parseAnalyticsQuery({}, today, 'overview', '/reports');
    expect(analyticsHref(o)).toBe('/reports/overview');
    expect(analyticsHref(o, { fund: 'rooms' })).toBe('/reports/overview?fund=rooms');
    const l = parseAnalyticsQuery({}, today, 'occupancy', '/reports');
    expect(analyticsHref(l)).toBe('/reports/occupancy');
    expect(analyticsHref(l, { compare: false })).toBe('/reports/occupancy?compare=0');
    expect(analyticsHref(parseAnalyticsQuery({}, today, 'units', '/reports'))).toBe(
      '/reports/units',
    );
  });
  it('без базы адреса прежние, вкладка «Аналитики» не уезжает', () => {
    expect(analyticsHref(parseAnalyticsQuery({}, today, 'overview'))).toBe('/management/analytics');
  });
});
