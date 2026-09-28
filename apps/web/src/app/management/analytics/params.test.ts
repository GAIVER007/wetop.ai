import { describe, expect, it } from 'vitest';
import { analyticsHref, parseAnalyticsQuery } from './params';

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
