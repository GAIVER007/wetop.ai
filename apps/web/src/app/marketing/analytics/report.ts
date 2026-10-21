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
export function analyticsCsv(r: AnalyticsReport, vertical: string = 'HOSPITALITY'): string {
  // слова результата по направлению (аудит 21.10.2026 п. 16): у салона записи, у ресторана брони столов
  const [many, one] =
    vertical === 'BEAUTY' ? ['Записи', 'записи'] : vertical === 'FOOD_SERVICE' ? ['Брони столов', 'брони стола'] : ['Брони', 'брони'];
  const rc = r.reportingCurrency;
  const rev = r.revenueCurrency;
  const res = <T>(v: T) => (r.ok ? v : null);
  const romi = (v: number | null) => num(r.ok && r.funnel.romiAvailable ? v : null);
  const lines = [
    ['Канал', `Расход, ${rc}`, 'Обращения', `CPL, ${rc}`, many, `Стоимость ${one}, ${rc}`, `Выручка, ${rev}`, 'ROMI, %'],
    ...r.funnel.rows.map((f) => [
      MARKETING_PLATFORM_LABELS[f.platform as MarketingPlatform] ?? f.platform,
      money(f.spendMinor),
      num(res(f.leads)),
      money(res(f.cplMinor)),
      num(res(f.bookings)),
      money(res(f.costPerBookingMinor)),
      money(res(f.revenueMinor)),
      romi(f.romiPct),
    ]),
  ];
  const t = r.funnel.total;
  lines.push(['Итого', money(t.spendMinor), num(res(t.leads)), money(res(t.cplMinor)), num(res(t.bookings)), money(res(t.costPerBookingMinor)), money(res(t.revenueMinor)), romi(t.romiPct)]);
  lines.push([]);
  lines.push(['День', `Расход, ${rc}`, 'Лиды', `CPL, ${rc}`, many, 'Новые клиенты', `Выручка, ${rev}`, 'ROMI, %']);
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
  lines.push(day('Итого', r.calendar.total));
  return `\uFEFF${lines.map((l) => l.join(';')).join('\r\n')}\r\n`;
}
