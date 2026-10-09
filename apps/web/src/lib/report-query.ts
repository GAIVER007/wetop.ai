import { type DashboardFund } from '@pms/domain';
import { parseAnalyticsQuery, type AnalyticsQuery } from '../app/management/analytics/params';

/** Детализация графиков и таблиц отчётов (Reports 2.0, `docs/metrics.md` §0) */
export type ReportGranularity = 'day' | 'week' | 'month';
const GRANULARITIES: ReportGranularity[] = ['day', 'week', 'month'];

/**
 * Единый запрос отчёта: период и сравнение разбирает тот же код, что у «Аналитики» (один пресет, одни границы,
 * предел 366 дней), сверху фонд, детализация и два текстовых фильтра. Всё живёт в адресе, чтобы отчётом можно
 * было поделиться внутри разрешённого пространства. Ничего не считает: числа берут серверные функции.
 */
export interface ReportQuery {
  period: AnalyticsQuery['period'];
  compare: boolean;
  fund: DashboardFund;
  granularity: ReportGranularity;
  source: string | null;
  category: string | null;
}

/** Сколько точек остаётся читаемым: до двух месяцев по дням, до полугода по неделям, дальше по месяцам */
export function autoGranularity(from: string, to: string): ReportGranularity {
  const days =
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  return days <= 62 ? 'day' : days <= 200 ? 'week' : 'month';
}

/** Текстовый фильтр из адреса: коротко и без управляющих символов, иначе его просто нет */
function cleanText(v: string | undefined): string | null {
  const s = v?.trim();
  // eslint-disable-next-line no-control-regex
  return s && s.length <= 64 && !/[\u0000-\u001f\u007f]/.test(s) ? s : null;
}

export function parseReportQuery(
  sp: Record<string, string | undefined>,
  today: string,
): ReportQuery {
  const base = parseAnalyticsQuery(sp, today, 'overview');
  const by = GRANULARITIES.find((g) => g === sp.by);
  return {
    period: base.period,
    compare: base.compare,
    fund: base.fund,
    granularity: by ?? autoGranularity(base.period.from, base.period.to),
    source: cleanText(sp.source),
    category: cleanText(sp.category),
  };
}

/** Адрес отчёта: значения по умолчанию в него не пишутся, период всегда явный (`from` и `to`) */
export function reportHref(path: string, q: ReportQuery, patch: Partial<ReportQuery> = {}): string {
  const next = { ...q, ...patch };
  const sp = new URLSearchParams();
  const p = next.period;
  if (p.preset !== 'month') {
    sp.set('period', 'custom');
    sp.set('from', p.from);
    sp.set('to', p.to);
  }
  if (!next.compare) sp.set('compare', '0');
  if (next.fund !== 'all') sp.set('fund', next.fund);
  if (next.granularity !== autoGranularity(p.from, p.to)) sp.set('by', next.granularity);
  if (next.source) sp.set('source', next.source);
  if (next.category) sp.set('category', next.category);
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}
