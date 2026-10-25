import {
  MARKETING_PLATFORM_LABELS,
  buildMarketingDays,
  buildMarketingFunnel,
  type ChannelResult,
  type MarketingDays,
  type MarketingFunnel,
  type MarketingPlatform,
} from '@pms/domain';
import type { MarketingBudgetView, MarketingResultsView } from '../../../lib/api';
import { csvTenge } from '../../finance/csv';
import { msg, translator, type Translate } from '../../../i18n';

/**
 * Числа «Аналитики маркетинга» одним расчётом для экрана и выгрузки CSV (МКТ-В5a, МКТ-В6 «отчёты и экспорт»):
 * воронка по каналам и календарь по дням из журнала «Бюджета» и результатов каналов.
 */
export interface AnalyticsReport {
  month: string;
  /** Результаты каналов есть: false, когда не загрузились или у филиала нет броней гостиницы */
  ok: boolean;
  reportingCurrency: string;
  revenueCurrency: string;
  funnel: MarketingFunnel;
  calendar: MarketingDays;
}

export function buildAnalyticsReport(
  view: MarketingBudgetView,
  results: MarketingResultsView | 'error',
): AnalyticsReport {
  const rc = view.reportingCurrency;
  const ok = results !== 'error' && results.supported;
  const revenueCurrency = ok ? results.revenueCurrency : null;
  const spendByPlatform: Record<string, bigint> = {};
  const spendByDay: Record<string, bigint> = {};
  for (const e of view.expenses) {
    if (!e.countedInBudget) continue;
    spendByPlatform[e.platform] = (spendByPlatform[e.platform] ?? 0n) + BigInt(e.baseAmount);
    spendByDay[e.date] = (spendByDay[e.date] ?? 0n) + BigInt(e.baseAmount);
  }
  const channels: ChannelResult[] = ok
    ? results.channels.map((c) => ({ ...c, revenueMinor: BigInt(c.revenue) }))
    : [];
  // текущий месяц до сегодняшнего дня, прошлый целиком, будущий пуст
  const todayMonth = view.today.slice(0, 7);
  const lastDay =
    view.month === todayMonth ? Number(view.today.slice(8, 10)) : view.month > todayMonth ? 0 : undefined;
  return {
    month: view.month,
    ok,
    reportingCurrency: rc,
    revenueCurrency: revenueCurrency || rc,
    funnel: buildMarketingFunnel({ spendByPlatform, channels, reportingCurrency: rc, revenueCurrency }),
    calendar: buildMarketingDays({
      month: view.month,
      ...(lastDay === undefined ? {} : { lastDay }),
      days: ok
        ? results.days.map((d) => ({
            date: d.date,
            leads: d.leads,
            bookings: d.bookings,
            newGuests: d.newGuests,
            revenueMinor: BigInt(d.revenue),
          }))
        : [],
      spendByDay,
      reportingCurrency: rc,
      revenueCurrency,
    }),
  };
}

const money = (v: bigint | null) => (v === null ? '' : csvTenge(v.toString()));
const num = (v: number | null) => (v === null ? '' : String(v));

/**
 * Выгрузка в Excel (правила ADR-113: «;», UTF-8 с BOM, деньги с запятой): блок каналов и блок дней, каждый с
 * итогом, как на экране. Без результатов каналов обращения, брони и выручка пустые, а не нули.
 */
export function analyticsCsv(r: AnalyticsReport, vertical: string = 'HOSPITALITY', t: Translate = translator('ru')): string {
  // слова результата по направлению (аудит 21.10.2026 п. 16): у салона записи, у ресторана брони столов
  const [manyRu, costRu] =
    vertical === 'BEAUTY'
      ? [msg('Записи'), msg('Стоимость записи, {currency}')]
      : vertical === 'FOOD_SERVICE'
        ? [msg('Брони столов'), msg('Стоимость брони стола, {currency}')]
        : [msg('Брони'), msg('Стоимость брони, {currency}')];
  const many = t(manyRu);
  const rc = r.reportingCurrency;
  const rev = r.revenueCurrency;
  const spent = t('Расход, {currency}', { currency: rc });
  const cpl = t('CPL, {currency}', { currency: rc });
  const revenue = t('Выручка, {currency}', { currency: rev });
  const res = <T>(v: T) => (r.ok ? v : null);
  const romi = (v: number | null) => num(r.ok && r.funnel.romiAvailable ? v : null);
  const lines = [
    [t('Канал'), spent, t('Обращения'), cpl, many, t(costRu, { currency: rc }), revenue, 'ROMI, %'],
    ...r.funnel.rows.map((f) => [
      t(MARKETING_PLATFORM_LABELS[f.platform as MarketingPlatform] ?? f.platform),
      money(f.spendMinor),
      num(res(f.leads)),
      money(res(f.cplMinor)),
      num(res(f.bookings)),
      money(res(f.costPerBookingMinor)),
      money(res(f.revenueMinor)),
      romi(f.romiPct),
    ]),
  ];
  const total = r.funnel.total;
  lines.push([t('Итого'), money(total.spendMinor), num(res(total.leads)), money(res(total.cplMinor)), num(res(total.bookings)), money(res(total.costPerBookingMinor)), money(res(total.revenueMinor)), romi(total.romiPct)]);
  lines.push([]);
  lines.push([t('День'), spent, t('Лиды'), cpl, many, t('Новые клиенты'), revenue, 'ROMI, %']);
  const day = (label: string, d: MarketingDays['total']) => [
    label,
    money(d.spendMinor),
    num(res(d.leads)),
    money(res(d.cplMinor)),
    num(res(d.bookings)),
    num(res(d.newGuests)),
    money(res(d.revenueMinor)),
    romi(d.romiPct),
  ];
  for (const d of r.calendar.rows) lines.push(day(d.date, d));
  lines.push(day(t('Итого'), r.calendar.total));
  return `\uFEFF${lines.map((l) => l.join(';')).join('\r\n')}\r\n`;
}
