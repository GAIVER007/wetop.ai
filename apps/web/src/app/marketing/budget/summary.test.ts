import { describe, expect, it } from 'vitest';
import type { MarketingCampaignView, MarketingResultsView } from '../../../lib/api';
import { budgetSummary } from './summary';

/**
 * Сводка «Бюджет и аналитика» (решение владельца 20.10.2026): ручной расход и расход кабинета раздельно,
 * заявки, цена заявки и ROMI по каналам. Деньги minor units, BigInt.
 */
const expense = (platform: string, baseAmount: string, countedInBudget = true) => ({
  id: `${platform}-${baseAmount}`,
  date: '2026-10-05',
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

const campaign = (over: Partial<MarketingCampaignView>): MarketingCampaignView => ({
  id: 'c1',
  platform: 'META',
  name: 'Кампания',
  status: 'ACTIVE',
  startsOn: null,
  endsOn: null,
  spend: '0',
  impressions: 0,
  clicks: 0,
  leads: 0,
  days: [],
  ...over,
});

const results = (over: Partial<MarketingResultsView> = {}): MarketingResultsView => ({
  month: '2026-10',
  reportingCurrency: 'KZT',
  revenueCurrency: 'KZT',
  supported: true,
  channels: [
    { channel: 'SITE', leads: 10, bookings: 4, revenue: '1200000' },
    { channel: 'WHATSAPP', leads: 3, bookings: 1, revenue: '100000' },
    { channel: 'INSTAGRAM', leads: 0, bookings: 0, revenue: '0' },
    { channel: 'PHONE', leads: 0, bookings: 0, revenue: '0' },
  ],
  days: [],
  ...over,
});

/** Месяц: сайт 4 000 ₸, WhatsApp 2 000 ₸, Meta в журнале 7 200 ₸, Google 4 800 ₸; вне бюджета не считается */
const view = {
  reportingCurrency: 'KZT',
  expenses: [
    expense('SITE', '400000'),
    expense('WHATSAPP', '200000'),
    expense('META', '720000'),
    expense('GOOGLE', '480000'),
    expense('INSTAGRAM', '120000', false),
  ],
};

/** Кабинет Meta: 120 $ и 45 лидов площадки за месяц; ручная кампания не кабинет */
const cabinet = [
  campaign({ id: 'k1', fromCabinet: true, cabinetSpend: '8000', cabinetCurrency: 'USD', leads: 20 }),
  campaign({ id: 'k2', fromCabinet: true, cabinetSpend: '4000', cabinetCurrency: 'USD', leads: 25 }),
  campaign({ id: 'm1', name: 'Ручная', spend: '720000', leads: 7, cabinetSpend: null, cabinetCurrency: null }),
];

describe('budgetSummary: итог месяца', () => {
  const s = budgetSummary({ view, campaigns: cabinet, results: results() });

  it('ручной расход: учтённые строки журнала в валюте отчётности', () => {
    expect(s.manualSpend).toEqual({ value: 1_800_000n, currency: 'KZT', reason: null });
  });

  it('расход кабинета: дни кабинета в его валюте, ручные кампании не входят, с ручным не складывается', () => {
    expect(s.cabinetSpend.value).toEqual([{ currency: 'USD', amountMinor: 12_000n, leads: 45 }]);
    expect(s.cabinetSpend.reason).toBeNull();
  });

  it('заявки: обращения каналов из своих данных; лиды площадки отдельно и в итог не входят', () => {
    expect(s.requests).toEqual({ value: 13, reason: null });
  });

  it('цена заявки: ручной расход на заявку, к ближайшему тиыну', () => {
    // 1 800 000 / 13 = 138 461,5 → 138 462
    expect(s.costPerRequest).toEqual({ value: 138_462n, currency: 'KZT', reason: null });
  });

  it('ROMI итога: выручка каналов к ручному расходу, как в «Аналитике»', () => {
    // (1 300 000 − 1 800 000) / 1 800 000 = −27,8 % → −28
    expect(s.romi).toEqual({ value: -28, reason: null });
    expect(s.revenue).toEqual({ value: 1_300_000n, currency: 'KZT', reason: null });
  });
});

describe('budgetSummary: каналы', () => {
  const s = budgetSummary({ view, campaigns: cabinet, results: results() });
  const row = (p: string) => s.channels.find((c) => c.platform === p)!;

  it('строки: каналы с выручкой первыми, затем реклама; канал без расхода и результата не показывается', () => {
    expect(s.channels.map((c) => c.platform)).toEqual(['SITE', 'WHATSAPP', 'META', 'GOOGLE']);
  });

  it('канал с выручкой: заявки, цена заявки и ROMI', () => {
    expect(row('SITE')).toMatchObject({
      manualSpendMinor: 400_000n,
      requests: { value: 10, reason: null },
      costPerRequest: { value: 40_000n, currency: 'KZT', reason: null },
      revenue: { value: 1_200_000n, reason: null },
      // (1 200 000 − 400 000) / 400 000 = 200 %
      romi: { value: 200, reason: null },
    });
    expect(row('WHATSAPP').romi).toEqual({ value: -50, reason: null });
  });

  it('Meta: ручной и кабинетный расход раздельно, заявки и цена заявки по кабинету в его валюте, ROMI нет данных', () => {
    const meta = row('META');
    expect(meta.manualSpendMinor).toBe(720_000n);
    expect(meta.cabinet).toEqual([{ currency: 'USD', amountMinor: 12_000n, leads: 45 }]);
    expect(meta.requests).toEqual({ value: 45, reason: null, platform: true });
    // 12 000 центов / 45 = 266,7 → 267
    expect(meta.costPerRequest).toEqual({ value: 267n, currency: 'USD', reason: null });
    expect(meta.revenue.value).toBeNull();
    expect(meta.romi.value).toBeNull();
    expect(meta.romi.reason).toMatch(/нет данных/);
  });

  it('реклама без кабинета: только расход, остальное нет данных с причиной', () => {
    const google = row('GOOGLE');
    expect(google.manualSpendMinor).toBe(480_000n);
    expect(google.cabinet).toEqual([]);
    expect(google.requests.value).toBeNull();
    expect(google.costPerRequest.value).toBeNull();
    expect(google.romi.value).toBeNull();
    expect(google.romi.reason).toMatch(/нет данных/);
  });
});

describe('budgetSummary: деление на ноль и пустые месяцы', () => {
  it('нет расходов: цена заявки и ROMI нет данных, а не ноль и не бесконечность', () => {
    const s = budgetSummary({ view: { reportingCurrency: 'KZT', expenses: [] }, campaigns: [], results: results() });
    expect(s.manualSpend.value).toBe(0n);
    expect(s.costPerRequest.value).toBeNull();
    expect(s.costPerRequest.reason).toMatch(/расхода/);
    expect(s.romi.value).toBeNull();
    expect(s.romi.reason).toMatch(/расхода/);
    // у канала с выручкой, но без расхода ROMI тоже нет
    expect(s.channels.find((c) => c.platform === 'SITE')!.romi.value).toBeNull();
  });

  it('нет заявок: цена заявки нет данных', () => {
    const empty = results({ channels: results().channels.map((c) => ({ ...c, leads: 0, bookings: 0, revenue: '0' })) });
    const s = budgetSummary({ view, campaigns: [], results: empty });
    expect(s.requests.value).toBe(0);
    expect(s.costPerRequest.value).toBeNull();
    expect(s.costPerRequest.reason).toMatch(/заявок/);
  });

  it('кабинет без лидов площадки: цена заявки кабинета нет данных', () => {
    const s = budgetSummary({
      view,
      campaigns: [campaign({ fromCabinet: true, cabinetSpend: '5000', cabinetCurrency: 'USD', leads: 0 })],
      results: results(),
    });
    expect(s.channels.find((c) => c.platform === 'META')!.costPerRequest.value).toBeNull();
  });

  it('кабинетов нет: расход кабинета пустой список без причины', () => {
    const s = budgetSummary({ view, campaigns: [cabinet[2]!], results: results() });
    expect(s.cabinetSpend).toEqual({ value: [], reason: null });
  });
});

describe('budgetSummary: валюты не складываются', () => {
  it('два кабинета в разных валютах: две суммы, цена заявки Meta нет данных', () => {
    const s = budgetSummary({
      view,
      campaigns: [
        campaign({ id: 'a', fromCabinet: true, cabinetSpend: '8000', cabinetCurrency: 'USD', leads: 10 }),
        campaign({ id: 'b', fromCabinet: true, cabinetSpend: '900000', cabinetCurrency: 'KZT', leads: 5 }),
      ],
      results: results(),
    });
    expect(s.cabinetSpend.value).toEqual([
      { currency: 'KZT', amountMinor: 900_000n, leads: 5 },
      { currency: 'USD', amountMinor: 8_000n, leads: 10 },
    ]);
    const meta = s.channels.find((c) => c.platform === 'META')!;
    expect(meta.costPerRequest.value).toBeNull();
    expect(meta.costPerRequest.reason).toMatch(/валют/);
    // ручной расход в тенге с кабинетом в тенге тоже не складывается
    expect(s.manualSpend.value).toBe(1_800_000n);
  });

  it('выручка в другой валюте: ROMI нет данных словами, цена заявки по ручному расходу остаётся', () => {
    const s = budgetSummary({ view, campaigns: [], results: results({ revenueCurrency: 'USD' }) });
    expect(s.romi.value).toBeNull();
    expect(s.romi.reason).toMatch(/USD/);
    expect(s.channels.find((c) => c.platform === 'SITE')!.romi.value).toBeNull();
    expect(s.costPerRequest.value).toBe(138_462n);
  });
});

describe('budgetSummary: источники не загрузились или не поддержаны', () => {
  it('результаты каналов упали: заявки, цена заявки и ROMI нет данных, расход есть', () => {
    const s = budgetSummary({ view, campaigns: cabinet, results: 'error' });
    expect(s.manualSpend.value).toBe(1_800_000n);
    expect(s.requests.value).toBeNull();
    expect(s.requests.reason).toMatch(/не загрузил/);
    expect(s.costPerRequest.value).toBeNull();
    expect(s.romi.value).toBeNull();
    // Meta по кабинету считается и без своих результатов
    expect(s.channels.find((c) => c.platform === 'META')!.costPerRequest.value).toBe(267n);
  });

  it('направление без результатов каналов (салон, ресторан): заявки нет данных, а не ноль', () => {
    const s = budgetSummary({
      view,
      campaigns: [],
      results: results({ supported: false, revenueCurrency: null, channels: [], days: [] }),
    });
    expect(s.requests.value).toBeNull();
    expect(s.requests.reason).toMatch(/нет данных/);
    expect(s.revenue.value).toBeNull();
    expect(s.romi.value).toBeNull();
    // каналы с ручным расходом всё равно видны
    expect(s.channels.map((c) => c.platform)).toEqual(['SITE', 'WHATSAPP', 'META', 'GOOGLE']);
    expect(s.channels[0]!.requests.value).toBeNull();
  });

  it('кампании не загрузились: расход кабинета нет данных с причиной', () => {
    const s = budgetSummary({ view, campaigns: 'error', results: results() });
    expect(s.cabinetSpend.value).toBeNull();
    expect(s.cabinetSpend.reason).toMatch(/не загрузил/);
  });
});
