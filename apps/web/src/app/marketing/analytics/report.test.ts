import { describe, expect, it } from 'vitest';
import type { MarketingBudgetView, MarketingResultsView } from '../../../lib/api';
import { analyticsCsv, buildAnalyticsReport } from './report';

const expense = (date: string, platform: string, baseAmount: string, countedInBudget = true) => ({
  id: `${date}-${platform}`,
  date,
  platform,
  campaign: null,
  category: 'Реклама',
  description: null,
  amount: baseAmount,
  currency: 'KZT',
  fxRate: '1',
  baseAmount,
  countedInBudget,
});

/** Прошлый месяц целиком: 30 дней; Meta 10 000 ₸ 02.09, сайт 2 000 ₸ 03.09, расход вне бюджета не считается */
const VIEW: MarketingBudgetView = {
  month: '2026-09',
  today: '2026-10-16',
  reportingCurrency: 'KZT',
  locationCurrency: 'KZT',
  plan: null,
  prevSpent: '0',
  lines: [],
  prevLines: [],
  expenses: [
    expense('2026-09-02', 'META', '1000000'),
    expense('2026-09-03', 'SITE', '200000'),
    expense('2026-09-03', 'GOOGLE', '999900', false),
  ],
};

const RESULTS: MarketingResultsView = {
  month: '2026-09',
  reportingCurrency: 'KZT',
  revenueCurrency: 'KZT',
  supported: true,
  channels: [{ channel: 'SITE', leads: 4, bookings: 1, revenue: '3000000' }],
  days: [{ date: '2026-09-03', leads: 4, bookings: 1, newGuests: 1, revenue: '3000000' }],
};

const lines = (csv: string) => csv.replace(/^\uFEFF/, '').split('\r\n');

describe('«Аналитика маркетинга» в CSV (МКТ-В6: отчёты и экспорт)', () => {
  it('два блока, как на экране: каналы с итогом и календарь по дням с итогом; деньги с запятой', () => {
    const csv = analyticsCsv(buildAnalyticsReport(VIEW, RESULTS));
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const l = lines(csv);
    expect(l[0]).toBe('Канал;Расход, KZT;Обращения;CPL, KZT;Брони;Стоимость брони, KZT;Выручка, KZT;ROMI, %');
    // сайт: 2 000 расхода, 4 обращения (CPL 500), 1 бронь, 30 000 выручки, ROMI +1400 %
    expect(l).toContain('Сайт;2000,00;4;500,00;1;2000,00;30000,00;1400');
    // Meta без кабинетов: только расход
    expect(l).toContain('Meta Ads;10000,00;;;;;;');
    expect(l).toContain('Итого;12000,00;4;3000,00;1;12000,00;30000,00;150');
    const day = l.indexOf('День;Расход, KZT;Лиды;CPL, KZT;Брони;Новые клиенты;Выручка, KZT;ROMI, %');
    expect(l[day - 1]).toBe('');
    expect(l.slice(day + 1, day + 4)).toEqual([
      '2026-09-01;0,00;0;;0;0;0,00;',
      '2026-09-02;10000,00;0;;0;0;0,00;-100',
      '2026-09-03;2000,00;4;500,00;1;1;30000,00;1400',
    ]);
    // сентябрь целиком: 30 дней и итог
    expect(l[day + 30]).toMatch(/^2026-09-30;/);
    expect(l[day + 31]).toBe('Итого;12000,00;4;3000,00;1;1;30000,00;150');
  });

  it('результаты не загрузились: расходы есть, обращения, брони и выручка пустые, а не нули', () => {
    const l = lines(analyticsCsv(buildAnalyticsReport(VIEW, 'error')));
    expect(l).toContain('Итого;12000,00;;;;;;');
    expect(l).toContain('2026-09-02;10000,00;;;;;;');
  });
});

describe('салон и ресторан без результатов каналов (аудит 17.10.2026, Д7)', () => {
  it('расход есть, выручки нет: ROMI недоступен, а не −100 %', () => {
    const r = buildAnalyticsReport(VIEW, { ...RESULTS, supported: false, revenueCurrency: null, channels: [], days: [] } as MarketingResultsView);
    expect(r.ok).toBe(false);
    expect(r.funnel.romiAvailable).toBe(false);
    expect(r.funnel.total.romiPct).toBeNull();
    expect(r.funnel.rows.map((f) => f.romiPct).filter((v) => v !== null)).toEqual([]);
    expect(r.calendar.total.romiPct).toBeNull();
    expect(r.calendar.rows.map((d) => d.romiPct).filter((v) => v !== null)).toEqual([]);
  });
});

